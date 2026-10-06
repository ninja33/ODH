/* global api */
// Sandbox control-plane traffic lives here rather than on window.api: replies and
// the init trigger register no callback of their own, and window.api is reachable
// by user dictionary scripts, which must not be able to replace them.
const ODH_BACKGROUND_ORIGIN = '*'; // the manifest sandbox has an opaque origin

function replyToBackground(data, callbackId) {
    window.parent.postMessage({ action: 'callback', params: { data, callbackId } }, ODH_BACKGROUND_ORIGIN);
}

class Sandbox {
    constructor() {
        this.audios = {};
        this.dicts = {};
        this.current = null;
        window.addEventListener('message', e => this.onBackgroundMessage(e));
    }

    onBackgroundMessage(e) {
        const { action, params } = e.data;
        const method = this['backend_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }
    }

    buildScriptURL(name) {
        let gitbase = 'https://raw.githubusercontent.com/ninja33/ODH/master/src/dict/';
        let url = name;

        if (url.indexOf('://') == -1) {
            url = '/dict/' + url;
        } else {
            //build remote script url with gitbase(https://) if prefix lib:// existing.
            url = (url.indexOf('lib://') != -1) ? gitbase + url.replace('lib://', '') : url;            
        }

        //add .js suffix if missing.
        url = (url.indexOf('.js') == -1) ? url + '.js' : url;
        return url;
    }

    async backend_loadScript(params) {
        let { name, callbackId } = params;

        let scripttext = await api.fetch(this.buildScriptURL(name));
        if (!scripttext) replyToBackground({ name, result: null }, callbackId);
        try {
            let SCRIPT = eval(`(${scripttext})`);
            if (SCRIPT.name && typeof SCRIPT === 'function') {
                let script = new SCRIPT();
                //if (!this.dicts[SCRIPT.name]) 
                this.dicts[SCRIPT.name] = script;
                let displayname = typeof(script.displayName) === 'function' ? await script.displayName() : SCRIPT.name;
                replyToBackground({ name, result: { objectname: SCRIPT.name, displayname } }, callbackId);
            }
        } catch (err) {
            // The caller only gets a null result, so keep the reason visible here.
            console.error('Unable to load dictionary script:', name, err && err.message);
            replyToBackground({ name, result: null }, callbackId);
            return;
        }
    }

    backend_setScriptsOptions(params) {
        let { options, callbackId } = params;

        for (const dictionary of Object.values(this.dicts)) {
            if (typeof(dictionary.setOptions) === 'function')
                dictionary.setOptions(options);
        }

        let selected = options.dictSelected;
        if (this.dicts[selected]) {
            this.current = selected;
            replyToBackground(selected, callbackId);
            return;
        }
        replyToBackground(null, callbackId);
    }

    async backend_findTerm(params) {
        let { expression, callbackId } = params;

        if (this.dicts[this.current] && typeof(this.dicts[this.current].findTerm) === 'function') {
            let notes = await this.dicts[this.current].findTerm(expression);
            replyToBackground(notes, callbackId);
            return;
        }
        replyToBackground(null, callbackId);
    }
}

window.sandbox = new Sandbox();
document.addEventListener('DOMContentLoaded', () => {
    // One-shot init trigger owned by this document; the offscreen still gates it
    // once per document because sandbox code is not trusted to fire it repeatedly.
    window.parent.postMessage({ action: 'initBackend', params: {} }, ODH_BACKGROUND_ORIGIN);
}, false);