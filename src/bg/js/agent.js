// --- Sandbox communication agent (with callback support) ---
class Agent {
    constructor(target) {
        this.callbacks = {};
        this.target = target;
        window.addEventListener('message', e => this.onMessage(e));
    }

    onMessage(e) {
        const { action, params } = e.data;
        if (action != 'callback' || !params || !params.callbackId)
            return;
        // we are the sender getting the callback
        if (this.callbacks[params.callbackId] && typeof(this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
        }
    }

    postMessage(action, params, callback) {
        if (action != 'callback' && callback) {
            params.callbackId = Math.random();
            this.callbacks[params.callbackId] = callback;
        }
        if (this.target)
            this.target.postMessage({ action, params }, '*');
    }

}