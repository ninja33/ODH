/* global ODH_DEFAULT_REQUEST_TIMEOUT_MS, odhError, odhErrorMessage, odhUnwrap */
// The odh version of the two messaging calls Chrome already has, differing in one way: they
// wait for the reply under a deadline and hand back its value or a classified failure.
//   odhSendMessage  ~ chrome.runtime.sendMessage
//   odhPostMessage  ~ window.postMessage through Agent (our own window messaging)
// Both are named after what they wrap so reading a call site needs no lookup. envelope.js
// describes what a reply looks like; this file is how one is awaited.
//
// They are separate because the transports differ, not for symmetry's sake: the runtime call is
// a request/response API, while window messaging only posts a frame and needs a callback to be
// registered (Agent does that) before a reply can arrive.
//
// NOTE: every context that awaits a reply loads this file, including the sandbox, which uses
// odhPostMessage to call the worker through its own Agent. The sandbox never calls
// odhSendMessage, because a manifest sandbox has no chrome.runtime.

// Who a runtime message is addressed to. Every receiver of chrome.runtime.sendMessage shares
// one onMessage listener, so the sender has to say which one it means; these names read from the
// sender's side, so `odhSendMessage(TO_WORKER, ...)` says where the message is going. The values
// are on the wire and must match the receiver's check.
const TO_WORKER = 'serviceworker';   // the service worker
const TO_OFFSCREEN = 'offscreen';    // the offscreen document that hosts the sandbox
const TO_FRONTEND = 'frontend';      // a content script, reached through chrome.tabs.sendMessage

// The deadline both helpers use, and the whole timeout policy in one place, so no call site
// chooses it. The timer is injected so a test can drive it without waiting.
// NOTE: this bounds waiting only. It cannot stop a peer that is already stuck, and a request
// with side effects (writing a card, saving settings) must never be retried just because it
// timed out: the write may have succeeded.
function odhWithTimeout(promise, timeoutMs, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    if (!(timeoutMs > 0)) return promise;
    return new Promise((resolve, reject) => {
        const timer = setTimer(() => {
            // No action name here on purpose: the caller already knows which request it awaited
            // and names it through odhLog, so naming it here too would only print it twice.
            reject(odhError('timeout', `No reply within ${timeoutMs}ms`));
        }, timeoutMs);
        // The original request keeps running; a reply that arrives later is dropped by the
        // caller's own registry, which has already forgotten it.
        Promise.resolve(promise).then(
            value => { clearTimer(timer); resolve(value); },
            error => { clearTimer(timer); reject(error); }
        );
    });
}

// Awaits one runtime reply. The target is a parameter because it is the one thing every caller
// knows and currently spells out by hand: request.target = '<role>'.
// A transport that fails before a reply exists is classified as 'network'; a reply that carries
// a classification keeps it, so a timeout is never flattened into a channel error.
async function odhSendMessage(target, request) {
    request.target = target;
    let result;
    try {
        result = await odhWithTimeout(chrome.runtime.sendMessage(request), ODH_DEFAULT_REQUEST_TIMEOUT_MS);
    } catch (error) {
        throw (error && error.kind) ? error : odhError('network', odhErrorMessage(error));
    }
    return odhUnwrap(result);
}

// Awaits one window reply from a peer bound through Agent. Agent fills in the callback id and
// the reply arrives later as an 'callback' frame, so the wait has to be built here.
//
// No 'network' fallback here, unlike odhSendMessage. The two transports fail differently:
// chrome.runtime.sendMessage is owned by the browser, which knows nothing about our kinds and
// only reports channel trouble as free text, so its failures have to be translated. Window
// messaging is our own Agent, so every failure it can produce is already meaningful: a reply
// that fails carries its own kind, a silent peer ends as a timeout, and a synchronous throw
// means the message itself could not be posted (an unclonable payload, for instance), which is
// a fault here rather than a broken channel.
function odhPostMessage(agent, action, params) {
    const reply = new Promise((resolve, reject) => {
        try {
            agent.postMessage(action, params, result => {
                // A reply that failed keeps its own classification.
                try {
                    resolve(odhUnwrap(result));
                } catch (error) {
                    reject(error);
                }
            });
        } catch (error) {
            // The request never left, so this is our own failure rather than a reply's.
            reject(odhError('handler-error', odhErrorMessage(error)));
        }
    });
    return odhWithTimeout(reply, ODH_DEFAULT_REQUEST_TIMEOUT_MS);
}
