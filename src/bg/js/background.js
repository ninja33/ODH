/* global Agent, odhOk, odhFail, odhUnwrap, odhWithTimeout, ODH_DEFAULT_REQUEST_TIMEOUT_MS, odhErrorMessage, odhError */
// Actions the worker may ask the offscreen document to hand to the sandbox. playAudio is
// deliberately absent: the offscreen plays it locally and never forwards it.
const ODH_SANDBOX_ACTIONS = ['loadScript', 'setScriptsOptions', 'findTerm'];
class ODHBackground {
    constructor() {
        this.audios = {};
        this.sandboxWindow = document.getElementById('sandbox').contentWindow;
        this.agent = new Agent(this.sandboxWindow);
        // add listener
        chrome.runtime.onMessage.addListener(this.onServiceMessage.bind(this));
        window.addEventListener('message', e => this.onSandboxMessage(e));
    }

    playAudio(url) {
        for (let key in this.audios) {
            this.audios[key].pause();
        }

        const audio = this.audios[url] || new Audio(url);
        audio.currentTime = 0;
        audio.play();
        this.audios[url] = audio;
    }
    // message exchange for both servicework and sandbox start from here ...
    
    // message from service worker to sandbox
    onServiceMessage(request, sender, callback) {
        // Only this extension may command the sandbox side; the browser supplies sender.id.
        if (!sender || sender.id !== chrome.runtime.id)
            return;

        const { action, params, target } = request;
        if (target != 'background')
            return;

        if (!params)
            return;

        // playAudio ends here: the offscreen document plays it itself, so it is not part of
        // the set that may be forwarded to the sandbox. Checked before that set so the two
        // concerns stay independent.
        if (action == 'playAudio') {
            let { url } = params
            this.playAudio(url)
            callback(odhOk(url))
            return true;
        }

        // Everything below is handed to the sandbox, so it must be one of the known actions.
        if (!ODH_SANDBOX_ACTIONS.includes(action))
            return;

        this.sendtoSandbox(action, params)
            .then(result => callback(odhOk(result)))
            .catch(error => callback(odhFail(error && error.kind ? error.kind : 'network', error)));
        return true;
    }

    async sendtoSandbox(action, params) {
        const reply = new Promise((resolve, reject) => {
            try {
                // Only the value crosses this relay: a failed reply becomes a thrown error.
                this.agent.postMessage(action, params, result => {
                    try {
                        resolve(odhUnwrap(result));
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
        // A sandbox that never answers must not keep the worker waiting.
        return odhWithTimeout(reply, action, ODH_DEFAULT_REQUEST_TIMEOUT_MS);
    }
    
    // message from sandbox to service worker
    async sendtoServiceworker(request){
        request.target='serviceworker';
        let result;
        try {
            result = await odhWithTimeout(chrome.runtime.sendMessage(request), request.action, ODH_DEFAULT_REQUEST_TIMEOUT_MS);
        } catch (e) {
            throw odhError('network', odhErrorMessage(e) || 'worker channel failed');
        }
        // Both directions hand back a plain value and throw on failure, so the envelope is
        // only built where a message actually crosses a boundary. A channel that closes
        // before the worker replies is a failure, not an empty success.
        return odhUnwrap(result);
    }
    async onSandboxMessage(e) {
        // Trust boundary: everything below this line was posted by the sandbox, whose
        // dictionary scripts are untrusted. Only the pinned window is checked here;
        // authority is decided entirely by the worker's source_action routing, so this
        // relay holds no action list and no state of its own.
        if (e.source !== this.sandboxWindow) return;
        const { action, params } = e.data || {};
        if (!params) return;

        // Replies are Agent business, not bridge traffic: agent.onMessage registered
        // first and already resolved the pending request.
        if (action === 'callback') return;

        try {
            const result = await this.sendtoServiceworker({ action, params });
            this.replyToSandbox(odhOk(result), params.callbackId);
        } catch (error) {
            this.replyToSandbox(odhFail(error && error.kind ? error.kind : 'network', error), params.callbackId);
        }
    }

    // Send an RPC reply back to a sandbox-originated request. The id belongs to the
    // sandbox's Agent (it registered it before sending), so no callback is
    // registered here: Agent.postMessage only does that for action != 'callback'.
    replyToSandbox(data, callbackId) {
        this.agent.postMessage('callback', { data, callbackId });
    }
}

window.odhbackground = new ODHBackground();