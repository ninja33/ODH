class SandboxAPI {
    constructor() {

    }

    async sendBGMessage(action, params) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage({ action, params }, result => resolve(result));
            } catch (err) {
                reject(null);
            }
        });
    }

    async deinflect(word) {
        return await this.sendBGMessage("Deinflect", { word });
    }

    async fetch(url) {
        return await this.sendBGMessage("Fetch", { url });
    }

    async locale() {
        return await this.sendBGMessage("getLocale", {})
    }

    callback(data, callbackId) {
        this.sendBGMessage("callback", { data, callbackId });
    }

    sandboxLoaded() {
        this.sendBGMessage("sandboxLoaded", {});
    }

}

window.api = new SandboxAPI();