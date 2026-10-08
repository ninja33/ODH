const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// message.js owns the two transports that await a reply and the deadline every wait uses. It
// builds on envelope.js, so each realm loads both, in load order, with the globals it needs.
// NOTE: values built inside the VM realm have a different Object.prototype than this file's,
// so assert field by field for envelopes and only deep-compare realm-local results.

// A realm with a stub transport. This is the only place chrome.runtime.sendMessage is faked,
// which is what makes the helper testable without a browser.
function runtimeRealm(behaviour) {
    const calls = [];
    const chrome = {
        runtime: {
            sendMessage(request) {
                calls.push(request);
                return behaviour(request);
            }
        }
    };
    const load = globals => loadClassic('src/lib/message.js',
        '({ odhWithTimeout, odhSendMessage, odhPostMessage })', globals, null,
        ['src/lib/envelope.js']);
    const helpers = load({ chrome, setTimeout, clearTimeout, console: { warn() {}, log() {}, error() {} } });
    return { ...helpers, calls, chrome, load };
}

// A realm that only needs the timeout, so the timer can be injected.
function timerRealm() {
    return loadClassic('src/lib/message.js',
        '({ odhWithTimeout, odhSendMessage, odhPostMessage, odhLog, odhError })',
        { chrome: { runtime: { sendMessage: () => Promise.resolve(null) } }, setTimeout, clearTimeout,
            console: { warn() {}, log() {}, error() {} } },
        null, ['src/lib/envelope.js']);
}

// The timer is injected so these cases need no real waiting and cannot be flaky.
function fakeClock() {
    const scheduled = [];
    return {
        scheduled,
        setTimer(callback, ms) { scheduled.push({ callback, ms }); return scheduled.length; },
        clearTimer() {},   // nothing to release in this stub
        fire(ms) {
            for (const entry of scheduled.splice(0)) {
                if (entry.ms === ms) entry.callback();
            }
        }
    };
}

test('odhWithTimeout passes a value through without firing the timer', async () => {
    const { odhWithTimeout } = timerRealm();
    const clock = fakeClock();
    const value = await odhWithTimeout(Promise.resolve('synthetic value'), 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    assert.equal(value, 'synthetic value');
    assert.equal(clock.scheduled.length, 1, 'one timer is scheduled per request');
});

test('odhWithTimeout rejects with a timeout failure when no reply arrives', async () => {
    const { odhWithTimeout } = timerRealm();
    const clock = fakeClock();
    const pending = odhWithTimeout(new Promise(() => {}), 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    clock.fire(15000);
    const result = await pending.then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved', 'the request must not resolve');
    assert.equal(result.kind, 'timeout');
    // The action is deliberately absent: odhLog names it, so naming it here would print twice.
    assert.equal(result.message, 'No reply within 15000ms');
});

// A peer that fails early must keep its own reason: the timeout is not a catch-all.
test('odhWithTimeout keeps the peer failure instead of reporting a timeout', async () => {
    const { odhWithTimeout, odhError } = timerRealm();
    const clock = fakeClock();
    const result = await odhWithTimeout(Promise.reject(odhError('network', 'synthetic')), 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    }).then(() => 'resolved', error => error);
    assert.equal(result.kind, 'network');
});

test('odhWithTimeout without a positive budget does not schedule anything', async () => {
    const { odhWithTimeout } = timerRealm();
    const clock = fakeClock();
    const value = await odhWithTimeout(Promise.resolve('synthetic'), 0, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    assert.equal(value, 'synthetic');
    assert.equal(clock.scheduled.length, 0);
});

// The pairing that motivated keeping the action out of the message: odhLog names the action,
// the timeout message does not, so the action appears exactly once.
test('a timed-out request names its action once, through odhLog', async () => {
    const realm = timerRealm();
    const clock = fakeClock();
    const pending = realm.odhWithTimeout(new Promise(() => {}), 3000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    clock.fire(3000);
    const error = await pending.then(() => null, failure => failure);
    const line = realm.odhLog('getTranslation', error, error.kind);
    assert.equal(line, 'getTranslation No reply within 3000ms (timeout)');
    assert.equal(line.split('getTranslation').length - 1, 1, 'the action must appear once');
});

// --- odhSendMessage: runtime messaging ------------------------------------------------

test('odhSendMessage sets the target, unwraps the reply, and returns its value', async () => {
    const realm = runtimeRealm(() => Promise.resolve({ __odhReply: true, ok: true, value: 'synthetic decks' }));
    const request = { action: 'getDeckNames', params: {} };
    const value = await realm.odhSendMessage('serviceworker', request);
    assert.equal(value, 'synthetic decks');
    assert.equal(request.target, 'serviceworker', 'the helper owns the target field, not the caller');
    assert.equal(realm.calls.length, 1);
    assert.equal(realm.calls[0].action, 'getDeckNames');
});

test('odhSendMessage throws the classified failure a reply carries', async () => {
    const realm = runtimeRealm(() => Promise.resolve(
        { __odhReply: true, ok: false, error: { kind: 'not-ready', message: 'synthetic' } }));
    const result = await realm.odhSendMessage('offscreen', { action: 'findTerm', params: {} })
        .then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved', 'a failure reply must not resolve');
    assert.equal(result.kind, 'not-ready', 'the reply keeps its own classification');
});

// A transport that fails before any reply exists has no classification of its own, so this is
// the one place that decides it is a channel failure.
test('odhSendMessage classifies a transport failure as network', async () => {
    const realm = runtimeRealm(() => Promise.reject(new Error('synthetic transport failure')));
    const result = await realm.odhSendMessage('serviceworker', { action: 'getVersion', params: {} })
        .then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved');
    assert.equal(result.kind, 'network');
    assert.equal(result.message, 'synthetic transport failure');
});

// A timeout must survive the transport instead of being rewritten as a channel failure. The
// production budget is 8s; the realm's timer is replaced so the case stays instant.
test('odhSendMessage keeps a timeout instead of flattening it into network', async () => {
    const calls = [];
    const chrome = {
        runtime: {
            sendMessage(request) {
                calls.push(request);
                return new Promise(() => {});   // the peer never answers
            }
        }
    };
    // An immediate timer runs the production timeout path without waiting.
    const helpers = loadClassic('src/lib/message.js',
        '({ odhSendMessage })',
        { chrome, setTimeout: callback => { callback(); return 0; }, clearTimeout, console: { warn() {}, log() {}, error() {} } },
        null, ['src/lib/envelope.js']);
    const result = await helpers.odhSendMessage('offscreen', { action: 'findTerm', params: {} })
        .then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved');
    assert.equal(result.kind, 'timeout', 'the wait must end as a timeout, not as a channel error');
});

// --- odhPostMessage: window messaging ------------------------------------------------

// A stub peer that records what was posted and lets the test deliver a reply frame.
function postRealm({ onPost } = {}) {
    const posted = [];
    const agent = {
        postMessage(action, params, callback) {
            posted.push({ action, params, callback });
            if (onPost) onPost(action, params, callback);
        }
    };
    return { agent, posted };
}

test('odhPostMessage posts through the agent and unwraps the reply', async () => {
    const realm = timerRealm();
    const { agent, posted } = postRealm();
    const pending = realm.odhPostMessage(agent, 'Fetch', { url: 'https://example.test/dict.js' });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].action, 'Fetch');
    posted[0].callback({ __odhReply: true, ok: true, value: 'const script = 1;' });
    assert.equal(await pending, 'const script = 1;');
});

test('odhPostMessage throws the classified failure a reply carries', async () => {
    const realm = timerRealm();
    const { agent, posted } = postRealm();
    const pending = realm.odhPostMessage(agent, 'getBuiltin', { dict: 'collins', word: 'x' });
    posted[0].callback({ __odhReply: true, ok: false, error: { kind: 'not-found', message: 'synthetic' } });
    const result = await pending.then(() => 'resolved', error => error);
    assert.equal(result.kind, 'not-found', 'a reply keeps its own classification');
});

// The asymmetry with odhSendMessage is deliberate: a window message that cannot be posted is a
// fault on this side, not a broken channel, so it is never labelled 'network'.
test('odhPostMessage labels a message that could not be posted as handler-error', async () => {
    const realm = timerRealm();
    const { agent } = postRealm({ onPost() { throw new Error('params could not be cloned'); } });
    const result = await realm.odhPostMessage(agent, 'Fetch', { url: 'https://example.test/dict.js' })
        .then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved');
    assert.equal(result.kind, 'handler-error');
    assert.equal(result.message, 'params could not be cloned');
});
