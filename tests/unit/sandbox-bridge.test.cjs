const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// The sandbox API is the adapter that keeps dictionary scripts on their legacy contract
// while the bridge carries envelopes. A missing unwrap here makes api.fetch() return an
// envelope object, which the dictionary loader then evaluates as script text: that failed
// in Chrome with "Unexpected identifier 'Object'" while every unit test stayed green.
// Mirrors the real sandbox: the API binds its Agent to window.parent (the offscreen
// document), and replies arrive as window messages from that same peer.
function sandboxBridge({ setTimer = setTimeout, timeoutMs = null } = {}) {
    const listeners = [];
    const parent = { postMessage() {} };
    const window = {
        parent,
        addEventListener(type, listener) {
            if (type === 'message') listeners.push(listener);
        }
    };
    const SandboxAPI = loadClassic('src/bg/sandbox/sandbox_api.js', 'SandboxAPI',
        { window, setTimeout: setTimer, clearTimeout, console: { warn() {}, log() {}, error() {} } }, null,
        ['src/lib/envelope.js', 'src/lib/agent.js']);
    const api = new SandboxAPI();
    // The production budget is 15s; overriding it here keeps a timeout case fast. The code
    // under test (odhWithTimeout) is unchanged.
    if (timeoutMs !== null) api.agent = Object.assign(api.agent, { timeoutMs });
    return {
        api,
        send: envelope => {
            const callbackId = Object.keys(api.agent.callbacks)[0];
            for (const listener of listeners.slice()) {
                listener({ source: parent, data: { action: 'callback', params: { callbackId, data: envelope } } });
            }
        }
    };
}

test('api.fetch resolves the raw script text carried in a success envelope', async () => {
    const bridge = sandboxBridge();
    const pending = bridge.api.fetch('https://example.test/dict.js');
    // What the offscreen sends down is the Agent envelope, not the bare value.
    bridge.send({ __odhReply: true, ok: true, value: 'const script = 1;' });
    assert.equal(await pending, 'const script = 1;');
});

// Replies are envelopes now, so a raw value is a protocol error rather than a result. The
// dictionary still sees null: the adapter reports the fault and keeps the legacy contract.
test('a raw reply is reported as a protocol error, not read as a value', async () => {
    const bridge = sandboxBridge();
    const pending = bridge.api.fetch('https://example.test/dict.js');
    bridge.send('const legacy = 1;');
    assert.equal(await pending, null);
});

// A failure must not be handed to the dictionary as data; the legacy shapes are null and
// [] so existing scripts keep working without an error API.
test('a failed dictionary request resolves null instead of the error object', async () => {
    const bridge = sandboxBridge();
    const pending = bridge.api.fetch('https://example.test/dict.js');
    bridge.send({ __odhReply: true, ok: false, error: { kind: 'network', message: 'synthetic' } });
    assert.equal(await pending, null);
});

test('api.deinflect resolves the raw array from a success envelope', async () => {
    const bridge = sandboxBridge();
    const pending = bridge.api.deinflect('synthetic');
    bridge.send({ __odhReply: true, ok: true, value: ['synthetic'] });
    assert.deepEqual(Array.from(await pending), ['synthetic']);
});

// A silent peer must settle the caller. The timer is injected so the production timeout path
// (the default setTimer inside odhWithTimeout) fires at once instead of after 15 seconds.
test('a sandbox that never replies settles the caller instead of hanging', async () => {
    const bridge = sandboxBridge({ setTimer: callback => { callback(); return 0; } });
    const pending = bridge.api.fetch('https://example.test/dict.js');
    // The caller settles; that is what this case is about. A deliberate limitation: the Agent's
    // registry entry is not released by the timeout, because postMessage is fire-and-forget and
    // only the owner of a request may drop its record. The residue is one closure per request
    // whose peer never answers, and a late reply is still dropped (the entry is ignored once
    // the request is settled). Deliberately not asserted either way.
    assert.equal(await pending, null, 'the dictionary contract stays null on a timeout');
});
