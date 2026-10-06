// --- Sandbox communication agent (with callback support) ---
// Each instance is bound to one peer WindowProxy and one inbound action list,
// so page scripts that can post to the same window get no side effects here.
class Agent {
    constructor(target, allowedActions = ['callback'], tag = 'agent') {
        this.callbacks = {};
        this.target = target;
        // 'callback' is the RPC reply action every instance must accept; call sites
        // list only their application actions, so a missing 'callback' would drop
        // every reply before its resolver runs.
        const inbound = Array.isArray(allowedActions) ? allowedActions : [];
        this.allowedActions = inbound.includes('callback') ? inbound : inbound.concat('callback');
        this.tag = tag;
        window.addEventListener('message', e => this.onMessage(e));
    }

    onMessage(e) {
        if (e.source !== this.target) return;
        const { action, params } = e.data || {};
        if (!this.allowedActions.includes(action)) return;
        // This instance only consumes replies; other actions are not its business.
        if (action !== 'callback' || !params || !params.callbackId) return;
        // we are the sender getting the callback
        if (this.callbacks[params.callbackId] && typeof(this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
        }
    }

    postMessage(action, params, callback) {
        if (action != 'callback' && callback) {
            // Callback ids must be unique per Agent: Math.random() can repeat
            // under a synchronous burst, and a repeat silently overwrites a
            // pending callback, hanging its request forever.
            this.callbackCounter = (this.callbackCounter || 0) + 1;
            params.callbackId = `${this.tag}-${this.callbackCounter}`;
            this.callbacks[params.callbackId] = callback;
        }
        // Target '*' because the manifest sandbox has an opaque origin, which no
        // concrete origin string can match; credibility comes from this.target.
        if (this.target)
            this.target.postMessage({ action, params }, '*');
    }

}
