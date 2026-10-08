/* global odhLog */
class Ankiconnect {
    constructor() {
        this.version = null;
        this.url = 'http://127.0.0.1:8765'; //define default ankiconnect ip/port
    }

    async initConnection(options) {
        this.url = options.ankiconnecturl;
        this.version = await this.ankiInvoke('version', {}, 100);
    }

    // WHY: the timeout parameter is part of the public call contract but is not
    // implemented - no AbortController, no request cancellation. initConnection()
    // passes 100ms. Behaviour is recorded in architecture section 7 and belongs
    // to the reliability task, not to this lint pass.
    // eslint-disable-next-line no-unused-vars
    async ankiInvoke(action, params = {}, timeout = 3000) {
        let version = 6;
        let request = { action, version, params };
        try {
            const rawResponse = await fetch(this.url, {
                method: 'POST',
                headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(request)
            });
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
                throw response.error;
            }
            return response.result;
        } catch (error) {
            // WHY: every caller branches on a falsy value, so the call still settles as null and
            // the contract stays with the reliability task. The failure must not vanish silently
            // either, so it is reported here, where the reason is still known. The endpoint is
            // deliberately not part of the line; AnkiConnect's own message says enough.
            console.error('Anki request failed:', odhLog(action, error));
            return null;
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

    async getVersion() {
        return this.version;
    }
}