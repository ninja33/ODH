// --- Peer messaging agent (with callback support) ---
// Each instance is bound to one peer WindowProxy. Credibility comes from that binding:
// only messages whose source is the bound peer are looked at.
class Agent {
    constructor(target) {
        this.callbacks = {};
        this.target = target;
        window.addEventListener('message', e => this.onMessage(e));
    }

    onMessage(e) {
        if (e.source !== this.target) return;
        const { action, params } = e.data || {};
        // This instance only consumes replies; every other action belongs to whoever
        // handles requests on that peer.
        if (action !== 'callback' || !params || !params.callbackId) return;
        if (this.callbacks[params.callbackId] && typeof(this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
        }
    }

    postMessage(action, params, callback) {
        if (action != 'callback' && callback) {
            // The id only has to be free within this instance's own registry. A collision
            // would overwrite a pending callback, so a UUID-style generator would be
            // stricter; this matches the original behaviour and has not been the cause of
            // an observed failure.
            params.callbackId = Math.random();
            this.callbacks[params.callbackId] = callback;
        }
        // Target '*' because the manifest sandbox has an opaque origin, which no
        // concrete origin string can match; credibility comes from this.target.
        if (this.target)
            this.target.postMessage({ action, params }, '*');
    }

}
