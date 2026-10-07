/* global api, odhFail */
// Sandbox control-plane traffic lives here rather than on window.api: replies and
// the init trigger register no callback of their own, and window.api is reachable
// by user dictionary scripts, which must not be able to replace them.
const ODH_BACKGROUND_ORIGIN = '*'; // the manifest sandbox has an opaque origin

function replyToBackground(data, callbackId) {
    window.parent.postMessage({ action: 'callback', params: { data, callbackId } }, ODH_BACKGROUND_ORIGIN);
}

// Failures leave this document as an envelope so the offscreen can tell "no result" from
// "the dictionary failed". Success values stay raw, which keeps a peer that has not been
// migrated yet working: see the migration note in lib/envelope.js.
function replyOk(value, callbackId) {
    replyToBackground(value, callbackId);
}

function replyFail(kind, detail, callbackId) {
    replyToBackground(odhFail(kind, detail), callbackId);
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

        let scripttext;
        try {
            scripttext = await api.fetch(this.buildScriptURL(name));
        } catch (err) {
            console.error('Unable to fetch dictionary script:', name, err && err.message);
            replyFail('network', err, callbackId);
            return;
        }
        if (!scripttext) {
            replyFail('network', `Empty script body: ${name}`, callbackId);
            return;
        }

        try {
            let SCRIPT = eval(`(${scripttext})`);
            // WHY: a script evaluating to something without a callable constructor used
            // to leave the request unanswered, which hung the caller forever.
            if (!SCRIPT || !SCRIPT.name || typeof SCRIPT !== 'function') {
                console.error('Dictionary script has no valid constructor:', name);
                replyFail('missing-data', `Invalid dictionary script: ${name}`, callbackId);
                return;
            }
            let script = new SCRIPT();
            this.dicts[SCRIPT.name] = script;
            let displayname = typeof(script.displayName) === 'function' ? await script.displayName() : SCRIPT.name;
            replyOk({ name, result: { objectname: SCRIPT.name, displayname } }, callbackId);
        } catch (err) {
            // The caller only gets a failed reply, so keep the reason visible here.
            console.error('Unable to load dictionary script:', name, err && err.message);
            replyFail('handler-error', err, callbackId);
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
            replyOk(selected, callbackId);
            return;
        }
        replyFail('not-ready', `Dictionary not loaded: ${selected}`, callbackId);
    }

    async backend_findTerm(params) {
        let { expression, callbackId } = params;

        let dictionary = this.dicts[this.current];
        if (!dictionary || typeof(dictionary.findTerm) !== 'function') {
            replyFail('not-ready', `No selected dictionary: ${this.current}`, callbackId);
            return;
        }

        try {
            // NOTE: an empty result and a failure are still indistinguishable to callers
            // here; classifying "not found" is a separate, not yet decided change.
            let notes = await dictionary.findTerm(expression);
            replyOk(notes, callbackId);
        } catch (err) {
            // WHY: without this the exception left the request unanswered, so one broken
            // dictionary hung every lookup instead of reporting a failure.
            console.error('Dictionary threw during findTerm:', err && err.message);
            replyFail('handler-error', err, callbackId);
        }
    }
}

window.sandbox = new Sandbox();
document.addEventListener('DOMContentLoaded', () => {
    // One-shot init trigger owned by this document; the offscreen still gates it
    // once per document because sandbox code is not trusted to fire it repeatedly.
    window.parent.postMessage({ action: 'initBackend', params: {} }, ODH_BACKGROUND_ORIGIN);
}, false);