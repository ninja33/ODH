/*global BGAgent */
class SandboxAPI {
    constructor() {
        this.bgagent = new BGAgent();
    }

    async postBGMessage(action, params) {
        return new Promise((resolve, reject) => {
            try {
                this.bgagent.postBGMessage(action, params, result => resolve(result));
            } catch (err) {
                reject(null);
            }
        });
    }

    async deinflect(word) {
        return await this.postBGMessage('Deinflect', {
            word
        });
    }

    async fetch(url) {
        return await this.postBGMessage('Fetch', {
            url
        });
    }

    async getCollins(word) {
        return await this.postBGMessage('getCollins', {
            word
        });
    }

    async getOxford(word) {
        return await this.postBGMessage('getOxford', {
            word
        });
    }
    
    async locale() {
        return await this.postBGMessage('getLocale', {});
    }

    callback(data, callbackId) {
        this.postBGMessage('callback', {
            data,
            callbackId
        });
    }

    sandboxLoaded() {
        this.postBGMessage('sandboxLoaded', {});
    }

}

window.api = new SandboxAPI();