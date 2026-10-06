/*global Agent */
class SandboxAPI {
    constructor() {
        // Only dictionary capabilities live here. Replies and the init trigger are
        // sandbox control-plane traffic and are written directly in sandbox.js, so
        // a user dictionary script cannot replace them through window.api.
        this.agent = new Agent(window.parent, [], 'sandbox');
    }

    async postMessage(action, params) {
        return new Promise((resolve, reject) => {
            try {
                this.agent.postMessage(action, params, result => resolve(result));
            } catch (err) {
                reject(null);
            }
        });
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