/* global Agent */
// Actions the worker may ask the offscreen document to hand to the sandbox.
const ODH_SANDBOX_ACTIONS = ['loadScript', 'setScriptsOptions', 'findTerm', 'playAudio'];
class ODHBackground {
    constructor() {
        this.audios = {};
        this.sandboxWindow = document.getElementById('sandbox').contentWindow;
        this.agent = new Agent(this.sandboxWindow, ODH_SANDBOX_ACTIONS, 'offscreen');
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

        // Same action list as the other direction: the bridge stays narrow.
        if (!ODH_SANDBOX_ACTIONS.includes(action) || !params)
            return;

        if (action == 'playAudio') {
            let { url } = params
            this.playAudio(url)
            callback(url)
            return true;
        }
        
        this.sendtoSandbox(action, params).then(result => callback(result));
        return true;
    }

    async sendtoSandbox(action, params) {
        return new Promise((resolve, reject) => {
            try {
                this.agent.postMessage(action, params, result => resolve(result));
            } catch (err) {
                reject(null);
            }
        });
    }
    
    // message from sandbox to service worker
    async sendtoServiceworker(request){
        request.target='serviceworker';
        try {
            return await chrome.runtime.sendMessage(request);
        } catch (e) {
            return null
        }
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
            this.replyToSandbox(result, params.callbackId);
        } catch {
            this.replyToSandbox(null, params.callbackId);
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