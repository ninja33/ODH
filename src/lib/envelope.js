// Envelope for every internal RPC reply: exactly one shape crosses a boundary, so
// "no result" can no longer be confused with "the handler failed".
//   success: { __odhReply: true, ok: true,  value: <structured-cloneable> }
//   failure: { __odhReply: true, ok: false, error: { kind, message } }
//
// NOTE: every internal reply is an envelope; there is no raw-value fallback. A reply
// without the tag is a protocol error rather than a value, so it can never be read as a
// result by mistake.
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

// Every failure that crosses a local boundary is a real Error carrying a `kind`, so a
// catcher can classify it with plain property access and never needs instanceof (which
// does not survive the realm boundaries between worker, offscreen and sandbox).
function odhError(kind, detail) {
    const error = new Error(odhErrorMessage(detail) || kind);
    error.kind = ODH_ERROR_KINDS.includes(kind) ? kind : 'unknown';
    return error;
}

// The only way to read a reply: return its value, or throw the classified failure. Bridges
// let that failure propagate; the adapters catch it to preserve the dictionary/page contract
// (a bare value, or null / [] on failure). Strict on purpose: a reply without the tag means
// one side is out of step, and reporting that beats reading it as data.
function odhUnwrap(envelope) {
    if (!odhIsEnvelope(envelope)) {
        throw odhError('unknown', `Reply is not an envelope: ${typeof envelope}`);
    }
    if (envelope.ok) return envelope.value;
    throw odhError(envelope.error.kind, envelope.error.message);
}
