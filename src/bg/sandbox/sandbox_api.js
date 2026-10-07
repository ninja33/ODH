/*global Agent, odhRead */
class SandboxAPI {
    constructor() {
        // Only dictionary capabilities live here. Replies and the init trigger are
        // sandbox control-plane traffic and are written directly in sandbox.js, so
        // a user dictionary script cannot replace them through window.api.
        this.agent = new Agent(window.parent);
    }

    async postMessage(action, params) {
        // Never rejects: old dictionaries only branch on the value, so a failure settles
        // with null and the reason stays in the console.
        return new Promise(resolve => {
            try {
                this.agent.postMessage(action, params, result => {
                    // The bridge wraps every reply, so unwrap here: dictionary scripts keep
                    // the legacy contract (a bare value, or null / [] on failure).
                    const reply = odhRead(result);
                    if (reply.ok) {
                        resolve(reply.value);
                        return;
                    }
                    console.warn('Dictionary request failed:', action, reply.error.kind, reply.error.message);
                    resolve(null);
                });
            } catch (err) {
                console.warn('Dictionary request could not be sent:', action, err && err.message);
                resolve(null);
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