// --- Sandbox communication agent (with callback support) ---
class Agent {
    constructor() {
        this.callbacks = {};
        this.sandbox = null;
        chrome.runtime.onMessage.addListener(this.onSandboxMessage.bind(this));
    }

    postMessage(action, params, callback) {
        if (callback) {
            params.callbackId = Math.random();
            this.callbacks[params.callbackId] = callback;
        }
        if (!this.sandbox)
            this.sandbox = document.getElementById('sandbox').contentWindow;
        this.sandbox.postMessage({ action, params, }, '*');
    }

    onSandboxMessage(request, sender, callback) {
        const {
            action,
            params,
        } = request;

        if (action != 'callback' || !params || !params.callbackId)
            return;
        // we are the sender getting the callback
        if (this.callbacks[params.callbackId] && typeof(this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
        }
    }
}