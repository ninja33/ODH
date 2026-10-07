const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { loadClassic } = require('../helpers/load-classic.cjs');

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
            for (const listener of listeners.slice()) listener(event);
        }
    };
}

// --- Agent: one peer window and one inbound action list ---------------------

function agentFixture() {
    const window = windowStub();
    const Agent = loadClassic('src/bg/js/agent.js', 'Agent', { window });
    const peer = { postMessage() {} };
    // No 'callback' here on purpose: the Agent must add it itself, otherwise every
    // reply is dropped before its resolver runs (this broke dictionary loading).
    const agent = new Agent(peer, ['loadScript']);
    return { window, agent, peer };
}

test('agent always accepts the reply action even when the caller omits it', () => {
    const { window, agent, peer } = agentFixture();
    assert.deepEqual(agent.allowedActions, ['loadScript', 'callback']);

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

test('agent ignores actions outside its inbound list', () => {
    const { window, agent, peer } = agentFixture();
    const results = [];
    agent.callbacks['1'] = value => results.push(value);

    window.emit({ source: peer, data: { action: 'setScriptsOptions', params: { callbackId: '1', data: 'x' } } });
    window.emit({ source: peer, data: { action: 'callback', params: {} } });
    window.emit({ source: peer, data: 'not an object' });
    assert.deepEqual(results, []);
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
    const Agent = loadClassic('src/bg/js/agent.js', 'Agent', { window });
    const first = new Agent({ postMessage() {} }, ['callback'], 'offscreen');
    const second = new Agent({ postMessage() {} }, ['callback'], 'sandbox');

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

// --- Worker: native runtime sender identity ---------------------------------

function workerFixture() {
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
    const Worker = loadClassic('src/bg/js/serviceworker.js', 'ODHServiceworker', {
        chrome,
        optionsLoad: async () => ({}),
        optionsSave: async () => {},
        console: consoleStub,
        Ankiconnect: class {},
        Builtin: class { loadData() {} },
        Deinflector: class { loadData() {} load(term) { this.term = term; } deinflect(term) { return [term]; } },
        importScripts() {},
        setupOffscreenDocument() {},
        setInterval() {}
    });
    const worker = new Worker();
    worker.options = { services: 'none', enabled: true, sysscripts: '', udfscripts: '' };
    worker.setScriptsOptions = async () => null;
    return { worker, chrome, storage, warnings: storage.warnings };
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
    assert.deepEqual(responses, [null], 'a matching sender reaches the handler once');
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
    assert.deepEqual(responses, [null], 'the caller gets a bounded failure, not a hang');
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
        assert.deepEqual(responses, [null], `getVersion must answer for ${sender.tab ? 'frontend' : 'popup'}`);
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
        { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/bg/background.html` },
        value => responses.push(value)
    );
    assert.equal(kept, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses, [null], 'the offscreen relay must reach initBackend exactly once');
});

// initBackend has its own entry (it is not part of any source's action surface), so it
// must stay reachable even though no source handler is named <source>_initBackend.
test('worker routes initBackend through its dedicated entry', async () => {
    const { worker } = workerFixture();
    const seen = [];
    worker.initBackend = params => { seen.push('initBackend'); params.callback(null); };
    worker.onMessage(
        { action: 'initBackend', params: {}, target: 'serviceworker' },
        { id: RUNTIME_ID, url: `chrome-extension://${RUNTIME_ID}/bg/background.html` },
        () => {}
    );
    assert.deepEqual(seen, ['initBackend']);
});

// 'callback' has no handler for any source (replies are Agent business), so it is
// refused with the bounded failure value instead of being silently swallowed.
test('worker answers a stray callback frame with the bounded failure value', () => {
    const { worker } = workerFixture();
    const responses = [];
    const kept = worker.onMessage(
        { action: 'callback', params: { data: 'x', callbackId: 0.5 }, target: 'serviceworker' },
        { id: RUNTIME_ID },
        value => responses.push(value)
    );
    assert.deepEqual(responses, [null]);
    assert.equal(kept, true);
});

test('worker ignores messages addressed to another target', () => {
    const { worker } = workerFixture();
    const responses = [];
    worker.onMessage(
        { action: 'initBackend', params: {}, target: 'background' },
        { id: RUNTIME_ID },
        value => responses.push(value)
    );
    assert.deepEqual(responses, []);
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
