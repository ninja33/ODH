/*global Agent, odhPostMessage, odhLog */
class SandboxAPI {
    constructor() {
        // Only dictionary capabilities live here. Replies and the init trigger are
        // sandbox control-plane traffic and are written directly in sandbox.js, so
        // a user dictionary script cannot replace them through window.api.
        this.agent = new Agent(window.parent);
    }

    // Never rejects: old dictionaries only branch on the value, so a failure settles with null
    // and the classified reason stays in the console. A worker that never answers must not hang
    // a dictionary either, so the wait is bounded in the transport.
    async postMessage(action, params) {
        try {
            return await odhPostMessage(this.agent, action, params);
        } catch (error) {
            console.warn('Dictionary request failed:', odhLog(action, error, error && error.kind));
            return null;
        }
    }

    async deinflect(word) {
        return await this.postMessage('Deinflect', { word });
    }

    async fetch(url) {
        return await this.postMessage('Fetch', { url });
    }

    async getBuiltin(dict, word) {
        return await this.postMessage('getBuiltin', { dict, word });
    }

    async locale() {
        return await this.postMessage('getLocale', {});
    }

}

window.api = new SandboxAPI();