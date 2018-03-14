// --- Sandbox communication agent (with callback support) ---
class BGAgent {
    constructor() {
        this.callbacks = {};
        this.sandbox = null;
        window.addEventListener('message', e => this.onBackendMessage(e));
    }

    onBackendMessage(e) {
        const { action, params } = e.data;

        if (action != 'callback' || !params || !params.callbackId)
            return;
        // we are the sender getting the callback
        if (this.callbacks[params.callbackId] && typeof(this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
        }
    }

    postBGMessage(action, params, callback) {
        if (action != 'callback' && callback) {
            params.callbackId = Math.random();
            this.callbacks[params.callbackId] = callback;
        }
        window.parent.postMessage({ action, params, }, '*');
    }

}