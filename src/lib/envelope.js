// Envelope for every internal RPC reply: exactly one shape crosses a boundary, so
// "no result" can no longer be confused with "the handler failed".
//   success: { __odhReply: true, ok: true,  value: <structured-cloneable> }
//   failure: { __odhReply: true, ok: false, error: { kind, message } }
//
// NOTE: a reply written by a peer that has not been migrated yet is still a raw value.
// odhRead() therefore treats anything without the tag as a success, so migration can
// happen one layer at a time without turning a good result into an error.
//
// The dictionary-facing api.* contract does NOT change: sandbox_api.js unwraps the
// envelope and adapts failures back to the legacy shapes (null / []).

// The tag keeps odhIsEnvelope from mistaking a business payload for a reply. It must
// stay obscure: dictionary-produced data (notes, fetched JSON) is untrusted input and
// would otherwise be able to impersonate an envelope. Real payloads never carry it.
const ODH_ENVELOPE_TAG = '__odhReply';

// Names only, no policy: which kinds a caller may see is decided by its own code.
const ODH_ERROR_KINDS = [
    'not-found',      // looked up but genuinely absent (词典没有该词)
    'not-ready',      // initialization unfinished / no dictionary selected yet
    'missing-data',   // a required data file did not load
    'network',        // fetch failed, or the runtime channel failed
    'handler-error',  // a handler threw (including inside a dictionary script)
    'timeout',        // reserved: the request timeout task
    'unknown'         // final fallback
];

// Reads a human-readable message without `instanceof`: worker, offscreen and sandbox
// are separate realms, so an Error from another realm fails an instanceof check.
function odhErrorMessage(errorOrMessage) {
    if (typeof errorOrMessage === 'string') return errorOrMessage;
    if (errorOrMessage && typeof errorOrMessage.message === 'string') return errorOrMessage.message;
    return '';
}

function odhOk(value) {
    return { [ODH_ENVELOPE_TAG]: true, ok: true, value };
}

function odhFail(kind, errorOrMessage) {
    let finalKind = kind;
    if (!ODH_ERROR_KINDS.includes(finalKind)) {
        // An unknown kind must stay visible, but must not break the reply itself.
        console.warn('Unknown envelope error kind:', kind);
        finalKind = 'unknown';
    }
    const error = { kind: finalKind, message: odhErrorMessage(errorOrMessage) };
    return { [ODH_ENVELOPE_TAG]: true, ok: false, error };
}

// Transport-level check. It answers "is this a reply envelope at all" and nothing about
// business meaning. A missing or negative tag means "not an envelope".
function odhIsEnvelope(value) {
    if (!value || typeof value !== 'object' || value[ODH_ENVELOPE_TAG] !== true) return false;
    if (value.ok === true) return true;
    return value.ok === false && Boolean(value.error) && typeof value.error.kind === 'string';
}

// Client-side adapter. Never throws: the caller decides what a failure means, and the
// failure value it receives is already the legacy shape it used before.
function odhRead(envelope) {
    if (!odhIsEnvelope(envelope)) return { ok: true, value: envelope };
    if (envelope.ok) return { ok: true, value: envelope.value };
    return { ok: false, error: envelope.error };
}

// Every failure that crosses a local boundary is a real Error carrying a `kind`, so a
// catcher can classify it with plain property access and never needs instanceof (which
// does not survive the realm boundaries between worker, offscreen and sandbox).
function odhError(kind, detail) {
    const error = new Error(odhErrorMessage(detail) || kind);
    error.kind = ODH_ERROR_KINDS.includes(kind) ? kind : 'unknown';
    return error;
}

// Bridge-side adapter: returns the success value and throws the classified failure, which
// is what a relay wants (it only passes values through; failures must propagate). A reply
// without the tag counts as a value for the same reason odhRead accepts it.
// Use odhRead instead when the caller must turn a failure into a legacy value.
function odhUnwrap(envelope) {
    const reply = odhRead(envelope);
    if (reply.ok) return reply.value;
    throw odhError(reply.error.kind, reply.error.message);
}
