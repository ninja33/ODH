const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// The envelope is the only shape that may cross a boundary, and odhUnwrap is the only way to
// read a reply: it returns the value or throws the classified failure. There is no raw-value
// fallback, so these cases pin both the shape and the strictness.
// NOTE: values built inside the VM realm have a different Object.prototype than this file's,
// so assert field by field for envelopes and only deep-compare realm-local results.
function envelopeRealm() {
    const warnings = [];
    const realmApi = loadClassic('src/lib/envelope.js', '({ odhOk, odhFail, odhIsEnvelope, odhUnwrap, odhError, odhWithTimeout, odhLog })', {
        console: { warn: (...args) => warnings.push(args), log() {}, error() {} }
    });
    return { ...realmApi, warnings };
}

// Reads the outcome without letting a throw escape, for cases that expect one.
function outcome(run) {
    try {
        return { returned: run() };
    } catch (error) {
        return { threw: error };
    }
}

test('a success envelope carries its value under a tagged shape', () => {
    const { odhOk, odhIsEnvelope, odhUnwrap } = envelopeRealm();
    const envelope = odhOk(['synthetic note']);
    assert.equal(envelope.__odhReply, true);
    assert.equal(envelope.ok, true);
    assert.equal(odhIsEnvelope(envelope), true);
    assert.deepEqual(Array.from(odhUnwrap(envelope)), ['synthetic note']);
});

// A produced null is still a produced value: the envelope is what distinguishes it from a
// failure, and deinflect/Builtin.findTerm both legitimately return null.
test('a success envelope carries null without turning it into a failure', () => {
    const { odhOk, odhUnwrap } = envelopeRealm();
    const result = outcome(() => odhUnwrap(odhOk(null)));
    assert.equal(result.threw, undefined, 'null must not be reported as a failure');
    assert.equal(result.returned, null);
});

test('a failure envelope carries a classified reason', () => {
    const { odhFail, odhIsEnvelope, odhUnwrap } = envelopeRealm();
    const envelope = odhFail('not-ready', 'initialization is still running');
    assert.equal(odhIsEnvelope(envelope), true);
    const result = outcome(() => odhUnwrap(envelope));
    assert.ok(result.threw, 'a failure envelope must throw');
    assert.equal(result.threw.kind, 'not-ready');
    assert.equal(result.threw.message, 'initialization is still running');
});

// Worker, offscreen and sandbox are separate realms, so an Error from another realm must
// still yield a readable message; this is why instanceof is not used.
test('odhFail reads a message from an error-like object without instanceof', () => {
    const { odhFail } = envelopeRealm();
    assert.equal(odhFail('network', { message: 'synthetic transport failure' }).error.message,
        'synthetic transport failure');
    assert.equal(odhFail('network', 'plain string detail').error.message, 'plain string detail');
    assert.equal(odhFail('network', undefined).error.message, '');
});

test('an unknown kind is reported and downgraded instead of breaking the reply', () => {
    const { odhFail, warnings } = envelopeRealm();
    const envelope = odhFail('synthetic-unknown-kind', 'detail');
    assert.equal(envelope.error.kind, 'unknown');
    assert.deepEqual(warnings.map(entry => entry[0]), ['Unknown envelope error kind:']);
});

// THE critical negative case: dictionary data is untrusted, so a payload that merely looks
// like an envelope must not be accepted as one, or a good result would become an error.
test('a business payload shaped like an envelope is rejected, not read as a reply', () => {
    const { odhIsEnvelope, odhUnwrap } = envelopeRealm();
    const impostor = { ok: false, error: { kind: 'not-found', message: 'synthetic' }, status: 200 };
    assert.equal(odhIsEnvelope(impostor), false);
    assert.equal(outcome(() => odhUnwrap(impostor)).threw.kind, 'unknown');

    const alsoImpostor = { ok: true, value: 'synthetic dictionary result' };
    assert.equal(odhIsEnvelope(alsoImpostor), false);
    assert.equal(outcome(() => odhUnwrap(alsoImpostor)).threw.kind, 'unknown');
});

// Strictness is the point of the current shape: there is no peer left that replies with a raw
// value, so a raw value means one side is out of step and must be reported rather than read.
test('any reply without the tag is a protocol error', () => {
    const { odhUnwrap } = envelopeRealm();
    for (const raw of [null, undefined, [], 'synthetic text', 0, false]) {
        const result = outcome(() => odhUnwrap(raw));
        assert.ok(result.threw, `a raw ${JSON.stringify(raw)} must not be read as a value`);
        assert.equal(result.threw.kind, 'unknown');
    }
});

test('a tagged envelope with a malformed body is not a reply', () => {
    const { odhIsEnvelope, odhUnwrap } = envelopeRealm();
    const malformed = [
        { __odhReply: true, ok: 'yes' },
        { __odhReply: true, ok: false },
        { __odhReply: true, ok: false, error: {} },
        { __odhReply: true, ok: false, error: { kind: 7 } }
    ];
    for (const candidate of malformed) {
        assert.equal(odhIsEnvelope(candidate), false);
        assert.ok(outcome(() => odhUnwrap(candidate)).threw, 'a malformed envelope must not be read');
    }
});

// --- odhWithTimeout: a request whose peer never answers must not wait forever ---------

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
    const { odhWithTimeout } = envelopeRealm();
    const clock = fakeClock();
    const value = await odhWithTimeout(Promise.resolve('synthetic value'), 'Fetch', 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    assert.equal(value, 'synthetic value');
    assert.equal(clock.scheduled.length, 1, 'one timer is scheduled per request');
});

test('odhWithTimeout rejects with a timeout failure when no reply arrives', async () => {
    const { odhWithTimeout } = envelopeRealm();
    const clock = fakeClock();
    const never = new Promise(() => {});
    const pending = odhWithTimeout(never, 'findTerm', 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    clock.fire(15000);
    const result = await pending.then(() => 'resolved', error => error);
    assert.notEqual(result, 'resolved', 'the request must not resolve');
    assert.equal(result.kind, 'timeout');
    assert.equal(result.message, 'No reply for "findTerm" within 15000ms');
});

// A peer that fails early must keep its own reason: the timeout is not a catch-all.
test('odhWithTimeout keeps the peer failure instead of reporting a timeout', async () => {
    const { odhWithTimeout, odhError } = envelopeRealm();
    const clock = fakeClock();
    const result = await odhWithTimeout(Promise.reject(odhError('network', 'synthetic')), 'Fetch', 15000, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    }).then(() => 'resolved', error => error);
    assert.equal(result.kind, 'network');
});

test('odhWithTimeout without a positive budget does not schedule anything', async () => {
    const { odhWithTimeout } = envelopeRealm();
    const clock = fakeClock();
    const value = await odhWithTimeout(Promise.resolve('synthetic'), 'playAudio', 0, {
        setTimer: clock.setTimer, clearTimer: clock.clearTimer
    });
    assert.equal(value, 'synthetic');
    assert.equal(clock.scheduled.length, 0);
});

// One phrasing for every reported failure: the action, its message, and the classification in
// parentheses. This case pins the shape so logs stay greppable across contexts.
test('odhLog reports the action, the message, and the kind in parentheses', () => {
    const { odhLog, odhFail, odhError } = envelopeRealm();
    assert.equal(odhLog('getTranslation', 'No reply for "getTranslation" within 3000ms', 'timeout'),
        'getTranslation No reply for "getTranslation" within 3000ms (timeout)');
    // An error object contributes its message, and a missing message falls back to the kind.
    assert.equal(odhLog('Fetch', odhError('network', 'synthetic transport failure'), 'network'),
        'Fetch synthetic transport failure (network)');
    assert.equal(odhLog('Fetch', odhFail('not-ready', undefined), 'not-ready'), 'Fetch not-ready (not-ready)');
    assert.equal(odhLog('Fetch', '', ''), 'Fetch failed');
});
