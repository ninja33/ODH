const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { loadClassic } = require('../helpers/load-classic.cjs');
const { fakeTimers, hangingFetch } = require('../helpers/abort-deadline.cjs');

// These cases cover the message entry gates added in B01: who may cross each
// seam, and which actions are accepted there. Stubs only stand in for the
// browser; they do not prove real Chrome sender/origin behaviour.

const RUNTIME_ID = 'synthetic-extension-id';

function windowStub() {
    const listeners = [];
    return {
        listeners,
        addEventListener(type, listener) {
            if (type === 'message') listeners.push(listener);
        },
        emit(event) {
            // A real window.postMessage is dispatched by the browser and keeps isTrusted;
            // dispatchEvent() forces it to false. Tests pass isTrusted: false explicitly to
            // stand in for a host-synthesized event.
            for (const listener of listeners.slice()) listener({ isTrusted: true, ...event });
        }
    };
}

// --- Agent: one peer window and one inbound action list ---------------------

function agentFixture() {
    const window = windowStub();
    const Agent = loadClassic('src/lib/agent.js', 'Agent', { window });
    const peer = { postMessage() {} };
    const agent = new Agent(peer);
    return { window, agent, peer };
}

// The agent has no action list any more: it consumes replies and ignores everything else,
// so any request shape from the peer is harmless here.
test('agent consumes replies and ignores other actions from its peer', () => {
    const { window, agent, peer } = agentFixture();
    const results = [];
    agent.callbacks['1'] = value => results.push(value);
    window.emit({ source: peer, data: { action: 'callback', params: { callbackId: '1', data: 'expected' } } });
    assert.deepEqual(results, ['expected']);
    assert.equal(Object.hasOwn(agent.callbacks, '1'), false);
});

test('agent consumes replies only from its own peer window', () => {
    const { window, agent, peer } = agentFixture();
    const results = [];
    agent.callbacks['1'] = value => results.push(value);

    window.emit({ source: {}, data: { action: 'callback', params: { callbackId: '1', data: 'forged' } } });
    assert.deepEqual(results, [], 'a message from another window must not resolve a callback');

    window.emit({ source: peer, data: { action: 'callback', params: { callbackId: '1', data: 'expected' } } });
    assert.deepEqual(results, ['expected']);
    assert.equal(Object.hasOwn(agent.callbacks, '1'), false, 'a consumed callback is removed');
});

// Requests, replies without an id, and malformed frames must all leave the registry alone:
// only a well-formed reply may consume a registration.
test('agent ignores requests and malformed frames from its peer', () => {
    const { window, agent, peer } = agentFixture();
    const results = [];
    agent.callbacks['1'] = value => results.push(value);

    window.emit({ source: peer, data: { action: 'setScriptsOptions', params: { callbackId: '1', data: 'x' } } });
    window.emit({ source: peer, data: { action: 'callback', params: {} } });
    window.emit({ source: peer, data: 'not an object' });
    assert.deepEqual(results, []);
    assert.equal(Object.hasOwn(agent.callbacks, '1'), true, 'none of these may consume the registration');
});

// A repeated callback id overwrites a pending callback and hangs that request,
// which is what stalled dictionary loading under a synchronous request burst.
test('agent gives every pending request its own callback id', () => {
    const { agent, peer } = agentFixture();
    peer.postMessage = () => {};
    const resolved = [];
    for (let index = 0; index < 12; index++)
        agent.postMessage('loadScript', { name: `synthetic_${index}` }, () => resolved.push(index));

    const ids = Object.keys(agent.callbacks);
    assert.equal(ids.length, 12, 'every concurrent request keeps its own callback');
    assert.equal(new Set(ids).size, 12, 'callback ids must not repeat');

    for (let index = 0; index < ids.length; index++) {
        const before = resolved.length;
        agent.onMessage({ source: peer, data: { action: 'callback', params: { callbackId: ids[index], data: 'ok' } } });
        assert.deepEqual(resolved.slice(before), [index], `reply for ${ids[index]} must resolve its own request`);
    }
    assert.deepEqual(resolved, Array.from({ length: 12 }, (value, index) => index));
    assert.equal(Object.keys(agent.callbacks).length, 0);
});

// Two agents on the same window (offscreen and sandbox do share one) must not
// issue colliding callback ids, or one agent's reply consumes the other's
// pending entry: that is how a loadScript reply could resolve an offscreen call.
test('two agents on one window keep separate callback id namespaces', () => {
    const window = windowStub();
    const Agent = loadClassic('src/lib/agent.js', 'Agent', { window });
    const first = new Agent({ postMessage() {} });
    const second = new Agent({ postMessage() {} });

    for (let index = 0; index < 3; index++) {
        first.postMessage('loadScript', { name: `synthetic_${index}` }, () => {});
        second.postMessage('loadScript', { name: `synthetic_${index}` }, () => {});
    }

    const firstIds = Object.keys(first.callbacks);
    const secondIds = Object.keys(second.callbacks);
    assert.equal(firstIds.length, 3);
    assert.equal(secondIds.length, 3);
    assert.deepEqual(firstIds.filter(id => secondIds.includes(id)), [], 'ids must not overlap across agents');
    assert.deepEqual(new Set([...firstIds, ...secondIds]).size, 6);
});

// A duplicated reply is dropped for the same reason: the entry is consumed once.
test('agent delivers a duplicated reply only once', () => {
    const { agent, peer } = agentFixture();
    const delivered = [];
    agent.postMessage('loadScript', { name: 'synthetic' }, result => delivered.push(result));
    const callbackId = Object.keys(agent.callbacks)[0];
    const frame = { source: peer, data: { action: 'callback', params: { callbackId, data: 'ok' } } };
    agent.onMessage(frame);
    agent.onMessage(frame);
    assert.deepEqual(delivered, ['ok']);
});

// --- Worker: native runtime sender identity ---------------------------------

// fetch and the timers are overridable so the dictionary fetch deadline can be driven by hand:
// a URL that never answers must be settled on demand, not after a real wait.
function workerFixture({ fetch: fetchImpl, timers: timerPair } = {}) {
    const storage = { data: {}, writes: [], warnings: [] };
    const consoleStub = { error() {}, log() {}, warn(...args) { storage.warnings.push(args); } };
    const runtime = {
        id: RUNTIME_ID,
        lastError: undefined,
        getURL: path => `chrome-extension://${RUNTIME_ID}/${path}`,
        onMessage: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        sendMessage: async () => null
    };
    const chrome = {
        runtime,
        storage: {
            local: {
                get(keys, callback) { callback(structuredClone(storage.data)); },
                set(items, callback) { storage.writes.push(structuredClone(items)); callback(); }
            }
        },
        tabs: { onCreated: { addListener() {} }, onUpdated: { addListener() {} }, query(filter, callback) { callback([]); } },
        commands: { onCommand: { addListener() {} } },
        action: { setBadgeText() {} },
        i18n: { getUILanguage: () => 'en' }
    };
    const timers = timerPair || { setTimeout, clearTimeout };
    const Worker = loadClassic('src/bg/js/serviceworker.js', 'ODHServiceworker', {
        chrome,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        AbortController,
        URL,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
        loadOptions: async () => ({}),
        saveOptions: async () => {},
        console: consoleStub,
        Ankiconnect: class {},
        Builtin: class { loadData() {} },
        Deinflector: class { loadData() {} load(term) { this.term = term; } deinflect(term) { return [term]; } },
        importScripts() {},
        setupOffscreenDocument: async () => {},
        setInterval() {}
    }, null, ['src/lib/envelope.js', 'src/lib/message.js']);
    const worker = new Worker();
    worker.options = { services: 'none', enabled: true, sysscripts: '', udfscripts: '' };
    worker.setScriptsOptions = async () => null;
    return { worker, chrome, storage, warnings: storage.warnings };
}

// A failure reply is an envelope; assert in terms of the classified kind so a hang and a
// report are never confused. Success values stay raw, so they pass through unchanged.
function errorKindOf(entry) {
    return entry && entry.__odhReply === true && entry.ok === false ? entry.error.kind : null;
}

function runtimeRequest(worker, sender) {
    const responses = [];
    const kept = worker.onMessage(
        { action: 'initBackend', params: {}, target: 'serviceworker' },
        sender,
        value => responses.push(value)
    );
    return { responses, kept };
}

test('worker refuses runtime senders without this extension identity', () => {
    const { worker } = workerFixture();
    for (const sender of [undefined, null, {}, { id: 'other-extension-id' }]) {
        const { responses } = runtimeRequest(worker, sender);
        assert.deepEqual(responses, [], `sender ${JSON.stringify(sender)} must not reach a handler`);
    }
});

test('worker serves matching runtime senders exactly once', async () => {
    const { worker } = workerFixture();
    const { responses, kept } = runtimeRequest(worker, { id: RUNTIME_ID });
    assert.equal(kept, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(responses.length, 1, 'a matching sender reaches the handler once');
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, null);
});

// A content script is recognised by sender.tab and routed to frontend_*; the handler
// name itself is the permission surface, so no separate capability table is kept.
test('worker routes a content script sender to its frontend handler', async () => {
    const { worker } = workerFixture();
    const responses = [];
    worker.frontend_getTranslation = params => params.callback('TRANSLATED');
    const kept = worker.onMessage(
        { action: 'getTranslation', params: { expression: 'synthetic' }, target: 'serviceworker' },
        { id: RUNTIME_ID, tab: { id: 7 }, url: 'https://example.test/' },
        value => responses.push(value)
    );
    assert.equal(kept, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses, ['TRANSLATED']);
});

// An action with no handler for the sender's source is refused: the channel is
// answered with the project's failure value instead of being left open.
test('worker refuses an action that the sender source may not call', async () => {
    const fixture = workerFixture();
    const responses = [];
    // A content script asking for a settings write is the shape of an over-reach.
    let legacyCalled = false;
    fixture.worker['api_optionsChanged'] = params => { legacyCalled = true; params.callback('LEGACY'); };
    fixture.worker.onMessage(
        { action: 'optionsChanged', params: {}, target: 'serviceworker' },
        { id: RUNTIME_ID, tab: { id: 7 }, url: 'https://example.test/' },
        value => responses.push(value)
    );
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.warnings.length, 1, 'the refusal is reported once');
    assert.equal(fixture.warnings[0][0], 'UNAUTHORIZED');
    assert.equal(fixture.warnings[0][1].source, 'frontend');
    assert.deepEqual(responses.map(errorKindOf), ['handler-error'], 'the caller gets a classified failure, not a hang');
    assert.equal(legacyCalled, false, 'no legacy api_* fallback may serve the request');
});

// The content script and the action popup both read the Anki connection state, so each
// role has its own named entry; a missing one leaves isConnected() pending forever and
// the popup never appears.
test('worker serves getVersion for the content script and the action popup', async () => {
    const { worker } = workerFixture();
    for (const sender of [
        { id: RUNTIME_ID, tab: { id: 7 }, url: 'https://example.test/' },
        { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/bg/popup.html` }
    ]) {
        const responses = [];
        worker.onMessage({ action: 'getVersion', params: {}, target: 'serviceworker' }, sender, value => responses.push(value));
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(responses.map(errorKindOf), ['not-ready'],
            `getVersion must answer for ${sender.tab ? 'frontend' : 'popup'}`);
    }
});

// The certificate chain depended on the sandbox's own requests reaching api_
// dispatch with their callbackId intact: an initBackend dropped here leaves the
// dictionary sandbox empty and the popup never appears. Regression guard.
test('worker still serves sandbox-originated requests that carry a callbackId', async () => {
    const { worker } = workerFixture();
    const responses = [];
    const kept = worker.onMessage(
        { action: 'initBackend', params: { callbackId: 0.5 }, target: 'serviceworker' },
        { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/bg/offscreen.html` },
        value => responses.push(value)
    );
    assert.equal(kept, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(responses.length, 1, 'the offscreen relay must reach initBackend exactly once');
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, null);
});

// initBackend has its own entry (it is not part of any source's action surface), so it
// must stay reachable even though no source handler is named <source>_initBackend.
test('worker routes initBackend through its dedicated entry', async () => {
    const { worker } = workerFixture();
    const seen = [];
    worker.initBackend = params => { seen.push('initBackend'); params.callback(null); };
    worker.onMessage(
        { action: 'initBackend', params: {}, target: 'serviceworker' },
        { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/bg/offscreen.html` },
        () => {}
    );
    assert.deepEqual(seen, ['initBackend']);
});

// 'callback' has no handler for any source (replies are Agent business), so it is
// refused with a classified failure instead of being silently swallowed.
test('worker answers a stray callback frame with a classified failure', () => {
    const { worker } = workerFixture();
    const responses = [];
    const kept = worker.onMessage(
        { action: 'callback', params: { data: 'x', callbackId: 0.5 }, target: 'serviceworker' },
        { id: RUNTIME_ID },
        value => responses.push(value)
    );
    assert.deepEqual(responses.map(errorKindOf), ['handler-error']);
    assert.equal(kept, true);
});

test('worker ignores messages addressed to another target', () => {
    const { worker } = workerFixture();
    const responses = [];
    worker.onMessage(
        // A real address that belongs to the offscreen document, not to the worker.
        { action: 'initBackend', params: {}, target: 'offscreen' },
        { id: RUNTIME_ID },
        value => responses.push(value)
    );
    assert.deepEqual(responses, []);
});

// A failure that arrives from the offscreen must never be read back as a success value.
// The offscreen signals its own failures with a thrown Error carrying a kind, so this
// distinguishes "the reply is an error" from "the reply is a dictionary result that
// happens to be null".
test('a failed offscreen reply is treated as a failure, not as a result', async () => {
    const { worker, chrome } = workerFixture();
    const responses = [];
    chrome.runtime.sendMessage = async () => {
        const error = new Error('synthetic sandbox failure');
        error.kind = 'handler-error';
        throw error;
    };
    await worker.findTerm('synthetic').then(
        value => responses.push(`resolved:${value}`),
        error => responses.push(`rejected:${error.kind}`)
    );
    // The relay's own classification survives: it is not flattened into a channel error.
    assert.deepEqual(responses, ['rejected:handler-error'],
        'a channel failure must not resolve with the thrown error as its value');
});

// The offscreen can also answer with an explicit failure envelope (a nested relay).
test('a failure envelope from the offscreen does not resolve the request', async () => {
    const { worker, chrome } = workerFixture();
    const responses = [];
    chrome.runtime.sendMessage = async () => ({ __odhReply: true, ok: false, error: { kind: 'not-ready', message: 'synthetic' } });
    await worker.findTerm('synthetic').then(
        value => responses.push(`resolved:${value}`),
        error => responses.push(`rejected:${error.kind}`)
    );
    assert.deepEqual(responses, ['rejected:not-ready']);
});

// A timeout raised at one bridge must still be classified as a timeout when the handler relays
// it: flattening every failure into a channel error would leave the page unable to react.
test('a bridge timeout keeps its classification through the handler', async () => {
    const { worker, chrome } = workerFixture();
    const responses = [];
    chrome.runtime.sendMessage = async () => ({ __odhReply: true, ok: false, error: { kind: 'timeout', message: 'synthetic' } });
    await worker.frontend_getTranslation({ expression: 'synthetic', callback: value => responses.push(value) });
    assert.equal(responses.length, 1);
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, false);
    assert.equal(responses[0].error.kind, 'timeout', 'the classification must survive the relay');
});

// --- Content script: popup frame messages -----------------------------------

function frontendFixture() {
    const window = windowStub();
    // The WindowProxy a browser hands out has stable identity; host objects do
    // not keep identity across the VM boundary, so the popup window, the pinned
    // frame and the content script all live in one realm here.
    const realm = vm.createContext({ window, realm: null });
    vm.runInContext('globalThis.realm = globalThis;', realm);
    vm.runInContext(`
        globalThis.frameWin = { postMessage() {} };
        globalThis.pinnedFrame = { contentWindow: globalThis.frameWin };
        globalThis.Popup = class { constructor() { this.popup = globalThis.pinnedFrame; } hide() {} showNextTo() {} };
    `, realm);
    const frameWin = realm.frameWin;
    const calls = [];
    const chrome = {
        runtime: {
            id: RUNTIME_ID,
            getURL: path => `chrome-extension://${RUNTIME_ID}/${path}`,
            sendMessage: async () => null,
            onMessage: { addListener() {} }
        },
        i18n: { getMessage: key => key }
    };
    loadClassic('src/fg/js/frontend.js', '({ ODH_FRAME_ACTIONS })', {
        document: { addEventListener() {} },
        chrome,
        FrontendAPI: class { async addNote() { return null; } async playAudio() { return null; } },
        rangeFromPoint() { return { getBoundingClientRect: () => ({}) }; },
        TextSourceRange: class {},
        selectedText: () => 'synthetic',
        isEmpty: () => false,
        getSentence: () => 'synthetic sentence',
        isConnected: async () => false,
        addNote: async () => null,
        getTranslation: async () => null,
        playAudio: async () => null,
        isValidElement: () => true,
        Audio: class { play() {} pause() {} }
    }, realm);
    const frontend = realm.window.odh_frontend;
    frontend.api_addNote = params => calls.push(params);
    return { window, frontend, frameWin, calls };
}
// The content script pins the iframe element and compares event.source with its
// contentWindow, so the frame's identity here is that window, not the element.
test('content script accepts frame actions only from the pinned popup frame', () => {
    const { window, frameWin, calls } = frontendFixture();
    const params = { nindex: 0, dindex: 0, context: 'synthetic' };

    window.emit({ source: window, data: { action: 'addNote', params } });
    window.emit({ source: {}, data: { action: 'addNote', params } });
    window.emit({ source: { contentWindow: null }, data: { action: 'addNote', params } });
    assert.deepEqual(calls, [], 'only the pinned frame window may drive the content script');

    window.emit({ source: frameWin, data: { action: 'addNote', params } });
    assert.deepEqual(calls, [params]);
});

// isTrusted is what separates a browser-dispatched message from an event a script
// dispatches itself; the source alone does not, since either can name this window.
test('content script rejects a frame event the page dispatched itself', () => {
    const { window, frameWin, calls } = frontendFixture();
    const params = { nindex: 0, dindex: 0, context: 'synthetic' };

    window.emit({ isTrusted: false, source: frameWin, data: { action: 'addNote', params } });
    assert.deepEqual(calls, [], 'the source matches, but the event was not browser-dispatched');

    window.emit({ source: frameWin, data: { action: 'addNote', params } });
    assert.deepEqual(calls, [params], 'the real frame message is still accepted');
});

test('content script ignores frame actions outside its list', () => {
    const { window, frameWin, calls } = frontendFixture();
    window.emit({ source: frameWin, data: { action: 'optionsChanged', params: {} } });
    window.emit({ source: frameWin, data: { action: 'getTranslation', params: {} } });
    window.emit({ source: frameWin, data: 'not an object' });
    assert.deepEqual(calls, []);
});

// --- Popup frame: content script messages -----------------------------------

function frameFixture() {
    const window = windowStub();
    const parent = { postMessage() {} };
    window.parent = parent;
    const windowContext = Object.assign({}, window);
    windowContext.window = windowContext;
    const frame = loadClassic('src/fg/js/frame.js', '({ api_setActionState })', {
        window: windowContext,
        document: {
            addEventListener() {},
            getElementById() { return null; },
            querySelector: () => ({ src: 'synthetic-plus.png' }),
            getElementsByClassName: () => []
        },
        spell: () => ({})
    });
    const calls = [];
    windowContext.api_setActionState = params => calls.push(params);
    assert.equal(typeof(frame.api_setActionState), 'function');
    return { window, parent, calls };
}

const actionState = { response: true, params: { nindex: 0, dindex: 0 } };

test('popup frame accepts UI actions only from its parent window', () => {
    const { window, parent, calls } = frameFixture();

    window.emit({ source: {}, data: { action: 'setActionState', params: actionState } });
    assert.deepEqual(calls, [], 'another window must not drive the popup frame');

    window.emit({ source: parent, data: { action: 'setActionState', params: actionState } });
    assert.deepEqual(calls, [actionState]);
});

test('popup frame ignores actions outside its list, even from the parent', () => {
    const { window, parent, calls } = frameFixture();

    window.emit({ source: parent, data: { action: 'playSound', params: { sound: 'synthetic' } } });
    window.emit({ source: parent, data: { action: 'addNote', params: {} } });
    window.emit({ source: parent, data: 'not an object' });
    assert.deepEqual(calls, []);
});

// --- worker-side fetch deadlines --------------------------------------------------------
// The caller's reply budget bounds waiting only: it cannot stop a fetch that is already
// running. These cases pin the worker-side deadline that closes that gap for the one request
// shape with no deadline of its own.

// A URL that never answers used to keep running in the worker long after the caller had
// already failed with 'timeout'. Aborting here makes the classified reply arrive while the
// caller is still waiting.
test('a dictionary fetch that stops answering is aborted at the worker deadline', async () => {
    const seen = [];
    const timers = fakeTimers();
    const { worker } = workerFixture({ fetch: hangingFetch(seen), timers });
    const responses = [];

    const pending = worker.offscreen_Fetch({ url: 'https://black-hole.invalid/dict.js', callback: value => responses.push(value) });
    timers.fireAll();
    await pending;

    assert.equal(responses.length, 1, 'the handler answers exactly once');
    assert.equal(errorKindOf(responses[0]), 'timeout', 'a slow dictionary is a timeout, not a network failure');
    assert.equal(seen[0].init.signal.aborted, true, 'the deadline must abort the in-flight fetch');
});

test('a dictionary fetch that answers in time is not aborted', async () => {
    const seen = [];
    const timers = fakeTimers();
    const { worker } = workerFixture({
        fetch: async (url, init) => { seen.push({ url, init }); return { ok: true, text: async () => 'synthetic script' }; },
        timers
    });
    const responses = [];

    await worker.offscreen_Fetch({ url: 'https://dict.invalid/dict.js', callback: value => responses.push(value) });

    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, 'synthetic script');
    assert.equal(timers.pending.size, 0, 'the deadline must be cleared once the reply is in');
    assert.equal(seen[0].init.signal.aborted, false, 'a settled request must not be aborted');
});

// The ordering is what makes the classified reply observable: a deadline at or above the
// reply budget would let the caller time out first, and the abort would arrive too late.
// Both numbers live in message.js, the one place the timeout policy is declared.
test('the dictionary fetch deadline stays below the caller reply budget', () => {
    const { ODH_DEFAULT_REQUEST_TIMEOUT_MS, ODH_DICTIONARY_FETCH_TIMEOUT_MS } = loadClassic('src/lib/message.js',
        '({ ODH_DEFAULT_REQUEST_TIMEOUT_MS, ODH_DICTIONARY_FETCH_TIMEOUT_MS })', {
            console: { warn() {}, log() {}, error() {} }
        }, null, ['src/lib/envelope.js']);
    assert.ok(typeof ODH_DICTIONARY_FETCH_TIMEOUT_MS === 'number' && ODH_DICTIONARY_FETCH_TIMEOUT_MS > 0,
        'the deadline is a positive number of milliseconds');
    assert.ok(ODH_DICTIONARY_FETCH_TIMEOUT_MS < ODH_DEFAULT_REQUEST_TIMEOUT_MS,
        `the dictionary deadline (${ODH_DICTIONARY_FETCH_TIMEOUT_MS}) must stay below the reply budget (${ODH_DEFAULT_REQUEST_TIMEOUT_MS})`);
});

// --- dictionary fetch entry allowlist ---------------------------------------------------
// The script URL field and dictionary scripts both accept arbitrary text, so offscreen_Fetch
// is where a URL first becomes something concrete. These cases pin what it may reach.

// The reply is classified by kind like any other failure, and the request must not reach
// fetch at all: a refusal is decided before the network is touched.
async function fetchReplyFor(url, options = {}) {
    const seen = [];
    const timers = fakeTimers();
    const { worker } = workerFixture({
        fetch: async (called, init) => { seen.push({ url: called, init }); return { ok: true, text: async () => 'body' }; },
        timers,
        ...options
    });
    const responses = [];
    await worker.offscreen_Fetch({ url, callback: value => responses.push(value) });
    return { responses, seen, worker };
}

test('a dictionary fetch refuses protocols outside http, https and the extension origin', async () => {
    for (const url of ['file:///etc/passwd', 'data:text/html,x', 'javascript:alert(1)']) {
        const { responses, seen } = await fetchReplyFor(url);
        assert.equal(responses.length, 1, `${url} must be answered exactly once`);
        assert.equal(errorKindOf(responses[0]), 'network', `${url} is a classified refusal`);
        assert.deepEqual(seen, [], `${url} must not reach fetch`);
    }
});

// Another extension's resource is not one of ours, and '//host/x.js' lands on that same
// shape once it is resolved against the extension origin instead of becoming an http URL.
test('a dictionary fetch refuses chrome-extension URLs that are not this extension', async () => {
    for (const url of ['chrome-extension://other-extension-id/x.js', '//other-extension-id/x.js']) {
        const { responses, seen } = await fetchReplyFor(url);
        assert.equal(errorKindOf(responses[0]), 'network', `${url} must be refused`);
        assert.deepEqual(seen, [], `${url} must not reach fetch`);
    }
});

// The regression guard that matters most: every built-in dictionary script loads through
// this same call with a relative path, so refusing the extension origin would break all of
// them at once while every other case still passed.
test('a dictionary fetch allows this extension\'s own built-in script path', async () => {
    const { responses, seen } = await fetchReplyFor('/dict/cncn_Zdic.js');
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, true);
    assert.equal(seen.length, 1, 'a built-in script must reach fetch');
    assert.equal(seen[0].url, '/dict/cncn_Zdic.js', 'the path is passed through unchanged');
});

test('a dictionary fetch refuses cloud metadata endpoints', async () => {
    const blocked = [
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.0.23/latest/meta-data/',
        // The same host spelled as one decimal integer and as hex: URL parsing normalizes
        // both, so the comparison never has to understand them.
        'http://2852039166/latest/meta-data/',
        'http://0xA9FEA9FE/latest/meta-data/',
        'http://100.100.100.200/latest/meta-data/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://metadata.tencentyun.com/latest/meta-data/',
        // A trailing dot is the same host to DNS.
        'http://metadata.google.internal./computeMetadata/v1/'
    ];
    for (const url of blocked) {
        const { responses, seen } = await fetchReplyFor(url);
        assert.equal(errorKindOf(responses[0]), 'network', `${url} must be refused`);
        assert.deepEqual(seen, [], `${url} must not reach fetch`);
    }
});

// IPv6 is not a supported form anywhere in this project, so it is refused rather than
// decoded. The mapped spelling is the one that would otherwise reach a blocked IPv4 host.
test('a dictionary fetch refuses IPv6 addresses outright', async () => {
    for (const url of ['http://[::1]/x.js', 'http://[::ffff:169.254.169.254]/x.js', 'http://[fe80::1]/x.js']) {
        const { responses, seen } = await fetchReplyFor(url);
        assert.equal(errorKindOf(responses[0]), 'network', `${url} must be refused`);
        assert.deepEqual(seen, [], `${url} must not reach fetch`);
    }
});

// The other half of the same decision: a self-hosted dictionary service is a stated use,
// so loopback and private ranges must stay reachable.
test('a dictionary fetch allows loopback, private ranges and public hosts', async () => {
    const allowed = ['http://127.0.0.1:8000/entry', 'http://192.168.1.10/x.js', 'http://10.0.0.5/x.js', 'https://example.test/x.js'];
    for (const url of allowed) {
        const { responses, seen } = await fetchReplyFor(url);
        assert.equal(responses[0].ok, true, `${url} must be allowed`);
        assert.equal(seen.length, 1, `${url} must reach fetch`);
    }
});

// Every refusal shares the kind 'network' — from the caller's side the data simply could
// not be fetched — so the reason has to survive in the message. Four layers collapsing
// into one text would make the refusal undiagnosable, which is the whole point of naming it.
test('each refusal layer keeps its own reason in the message', async () => {
    const reasons = [
        'http://',                                                        // unparseable ('http://' has no host)
        'file:///etc/passwd',                                             // protocol
        'chrome-extension://other-extension-id/x.js',                     // foreign extension
        'http://[::1]/x.js',                                              // IPv6
        'http://169.254.169.254/latest/meta-data/'                        // metadata
    ];
    const messages = [];
    for (const url of reasons) {
        const { responses } = await fetchReplyFor(url);
        assert.equal(errorKindOf(responses[0]), 'network', `${url} is refused as a network failure`);
        messages.push(responses[0].error.message);
    }
    assert.equal(new Set(messages).size, messages.length, 'no two layers may share one message');
    assert.match(messages[0], /Not a usable URL/);
    assert.match(messages[1], /Unsupported protocol/);
    assert.match(messages[2], /another extension/);
    assert.match(messages[3], /IPv6/);
    assert.match(messages[4], /metadata/);
});
