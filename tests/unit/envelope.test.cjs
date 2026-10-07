const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// The envelope is the only shape that may cross a boundary, so its tag and its
// "not an envelope means success" adapter are contract, not implementation detail.
// NOTE: values built inside the VM realm have a different Object.prototype than this
// file's, so assert field by field for envelopes and only deep-compare realm-local results.
function envelopeRealm() {
    const warnings = [];
    const realmApi = loadClassic('src/lib/envelope.js', '({ odhOk, odhFail, odhIsEnvelope, odhRead, odhUnwrap })', {
        console: { warn: (...args) => warnings.push(args), log() {}, error() {} }
    });
    return { ...realmApi, warnings };
}

test('a success envelope carries its value under a tagged shape', () => {
    const { odhOk, odhIsEnvelope, odhRead } = envelopeRealm();
    const envelope = odhOk(['synthetic note']);
    assert.equal(envelope.__odhReply, true);
    assert.equal(envelope.ok, true);
    assert.equal(odhIsEnvelope(envelope), true);
    const read = odhRead(envelope);
    assert.equal(read.ok, true);
    assert.deepEqual(Array.from(read.value), ['synthetic note']);
});

test('a failure envelope carries a classified reason', () => {
    const { odhFail, odhIsEnvelope, odhRead } = envelopeRealm();
    const envelope = odhFail('not-ready', 'initialization is still running');
    assert.equal(odhIsEnvelope(envelope), true);
    const read = odhRead(envelope);
    assert.equal(read.ok, false);
    assert.equal(read.error.kind, 'not-ready');
    assert.equal(read.error.message, 'initialization is still running');
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
// like an envelope must not be treated as one, otherwise a good result becomes an error.
test('a business payload shaped like an envelope is not mistaken for a reply', () => {
    const { odhIsEnvelope, odhRead } = envelopeRealm();
    const impostor = { ok: false, error: { kind: 'not-found', message: 'synthetic' }, status: 200 };
    assert.equal(odhIsEnvelope(impostor), false);
    assert.equal(odhRead(impostor).ok, true);
    assert.equal(odhRead(impostor).value, impostor);

    const alsoImpostor = { ok: true, value: 'synthetic dictionary result' };
    assert.equal(odhIsEnvelope(alsoImpostor), false);
    assert.equal(odhRead(alsoImpostor).value, alsoImpostor);
});

// Phase-migration rule: a peer that has not been migrated still replies with a raw value.
test('a raw value from an unmigrated peer counts as a success', () => {
    const { odhRead } = envelopeRealm();
    assert.equal(odhRead(null).ok, true);
    assert.equal(odhRead(null).value, null);
    assert.equal(odhRead('synthetic text').value, 'synthetic text');
    assert.equal(odhRead(undefined).ok, true);
    const list = odhRead([]);
    assert.equal(list.ok, true);
    assert.equal(list.value.length, 0);
});

test('a tagged envelope with a malformed body is not accepted as a reply', () => {
    const { odhIsEnvelope } = envelopeRealm();
    assert.equal(odhIsEnvelope({ __odhReply: true, ok: 'yes' }), false);
    assert.equal(odhIsEnvelope({ __odhReply: true, ok: false }), false);
    assert.equal(odhIsEnvelope({ __odhReply: true, ok: false, error: {} }), false);
    assert.equal(odhIsEnvelope({ __odhReply: true, ok: false, error: { kind: 7 } }), false);
});

// The bridge-side form: return the value, throw the classified failure. Callers that must
// degrade a failure into a legacy value use odhRead instead.
test('odhUnwrap returns a success value and throws a classified failure', () => {
    const { odhOk, odhFail, odhUnwrap } = envelopeRealm();
    assert.equal(odhUnwrap(odhOk('synthetic value')), 'synthetic value');

    let thrown = null;
    try {
        odhUnwrap(odhFail('not-ready', 'initialization is still running'));
    } catch (error) {
        thrown = error;
    }
    assert.ok(thrown, 'a failure envelope must throw');
    assert.equal(thrown.kind, 'not-ready');
    assert.equal(thrown.message, 'initialization is still running');
});

// Same migration rule as odhRead: a peer that has not been migrated still sends raw values.
// A tagged-but-malformed body is also treated as a value, so the bridge cannot turn it into
// a failure that the sending side never intended.
test('odhUnwrap passes through values that are not failure envelopes', () => {
    const { odhUnwrap } = envelopeRealm();
    assert.equal(odhUnwrap('synthetic text'), 'synthetic text');
    assert.equal(odhUnwrap(null), null);
    assert.deepEqual(Array.from(odhUnwrap([])), []);
    const malformed = { __odhReply: true, ok: false, error: {} };
    assert.equal(odhUnwrap(malformed), malformed);
});
