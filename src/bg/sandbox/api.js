/*global Agent */
class SandboxAPI {
    constructor() {
        this.agent = new Agent(window.parent);
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

    async getCollins(word) {
        return await this.postMessage('getCollins', { word });
    }

    async getOxford(word) {
        return await this.postMessage('getOxford', { word });
    }

    async locale() {
        return await this.postMessage('getLocale', {});
    }

    callback(data, callbackId) {
        this.postMessage('callback', { data, callbackId });
    }

    initBackend() {
        this.postMessage('initBackend', {});
    }

}

window.api = new SandboxAPI();