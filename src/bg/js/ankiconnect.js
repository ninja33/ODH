/* global odhLog */
class Ankiconnect {
    constructor() {
        this.url = 'http://127.0.0.1:8765'; //define default ankiconnect ip/port
    }

    async initConnection(options) {
        this.url = options.ankiconnecturl;
    }

    async ankiInvoke(action, params = {}, { timeout = 3000, quiet = false } = {}) {
        let version = 6;
        let request = { action, version, params };
        // WHY: the deadline bounds this request, not the caller's wait: a black-hole endpoint
        // used to hold the bridge's 8s reply budget instead of failing here. An abort makes
        // the in-flight fetch reject, so a timeout takes the existing catch below and the call
        // still settles as null, the contract every caller branches on. Callers therefore see
        // the same null for a request that timed out and for one that failed.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const rawResponse = await fetch(this.url, {
                method: 'POST',
                headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(request),
                signal: controller.signal
            });
            // WHY: a gateway or proxy error used to reach json() and surface as a parse failure,
            // so "the server answered 502" and "the body was not JSON" read the same in the log.
            // The status is read before parsing, and the throw carries the reason so the single
            // reporting path in the catch can name it. The endpoint stays out of the line.
            if (!rawResponse.ok) {
                throw { odhReason: 'http-status', message: `HTTP ${rawResponse.status}` };
            }
            const response = await rawResponse.json();

            if (Object.getOwnPropertyNames(response).length != 2) {
                throw 'response has an unexpected number of fields';
            }
            // WHY: response comes from a JSON payload, so its prototype is not
            // under our control. AnkiConnect always defines both fields, but the
            // prototype-free form below is correct hardening, not a style change.
            if (!Object.prototype.hasOwnProperty.call(response, 'error')) {
                throw 'response is missing required error field';
            }
            if (!Object.prototype.hasOwnProperty.call(response, 'result')) {
                throw 'response is missing required result field';
            }
            if (response.error) {
                // WHY: AnkiConnect answers 200 and reports its own failure in the payload, so this
                // is the branch that carries Anki's message. Tagging it keeps that message and
                // the reason on the same line; the text logged is unchanged.
                throw { odhReason: 'anki-error', message: response.error };
            }
            return response.result;
        } catch (error) {
            // WHY: every caller branches on a falsy value, so the call still settles as null and
            // the contract stays with the reliability task. A failed call is reported here, where
            // the reason is still known, unless the caller passed quiet: a presence probe gets
            // "Anki is not running" as a normal answer, and one line per lookup would bury the
            // rest of the console. The endpoint stays out of the line; AnkiConnect's own message
            // says enough.
            const aborted = Boolean(error && error.name === 'AbortError');
            // WHY: the deadline firing is named a timeout, and the two tagged throws and an
            // unparsable body name themselves. A refused connection keeps no label, as before:
            // its own message already says what happened. The name is compared rather than
            // `instanceof SyntaxError` because an injected error can come from another realm.
            const reason = aborted ? 'timeout'
                : (error && error.odhReason) ? error.odhReason
                    : (error && error.name === 'SyntaxError') ? 'invalid-json' : undefined;
            if (!quiet) {
                console.error('Anki request failed:', odhLog(action, error, reason));
            }
            return null;
        } finally {
            clearTimeout(timer);
        }

    }

    async addNote(note) {
        if (note)
            return await this.ankiInvoke('addNote', { note });
        else
            return Promise.resolve(null);
    }

    async getDeckNames() {
        return await this.ankiInvoke('deckNames');
    }

    async getModelNames() {
        return await this.ankiInvoke('modelNames');
    }

    async getModelFieldNames(modelName) {
        return await this.ankiInvoke('modelFieldNames', { modelName });
    }

    // WHY: this is the only connectivity signal the settings pages and the add-note button
    // have, so it is asked live. A cached snapshot still answered "connected" long after Anki
    // had stopped, and still answered "not connected" after it came back. It asks quietly: this
    // is a presence probe, not an operation the user requested.
    async getVersion() {
        return await this.ankiInvoke('version', {}, { quiet: true });
    }
}