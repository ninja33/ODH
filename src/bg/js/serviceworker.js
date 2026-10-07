/* global Ankiconnect, Deinflector, Builtin, optionsLoad, optionsSave, odhFail, odhIsEnvelope, odhUnwrap, odhErrorMessage, odhError */
class ODHServiceworker {
    constructor() {

        this.options = null;
        this.initInFlight = null;

        this.ankiconnect = new Ankiconnect();
        this.target = null;

        //setup lemmatizer
        this.deinflector = new Deinflector();
        this.deinflector.loadData();

        //Setup builtin dictionary data
        this.builtin = new Builtin();
        this.builtin.loadData();

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
        chrome.commands.onCommand.addListener((command) => this.onCommand(command));
    }

    async onCommand(command) {
        if (command != 'enabled') return;
        this.options.enabled = !this.options.enabled;
        this.setFrontendOptions(this.options);
        try {
            await optionsSave(this.options);
        } catch {
            console.error('Unable to save shortcut settings.');
        }
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({ url: chrome.runtime.getURL('bg/guide.html') });
            return;
        }
        if (details.reason === 'update') {
            chrome.tabs.create({ url: chrome.runtime.getURL('bg/update.html') });
            return;
        }
    }

    onTabReady(tabId) {
        this.tabInvoke(tabId, {
            action:'setFrontendOptions', 
            params: { 
                options: this.options 
            }
        });
    }

    setFrontendOptions(options) {

        switch (options.enabled) {
            case false:
                chrome.action.setBadgeText({ text: 'off' });
                break;
            case true:
                chrome.action.setBadgeText({ text: '' });
                break;
        }
        this.tabInvokeAll({
            action:'setFrontendOptions',
            params: {
                options
            }
        });
    }

    checkLastError(){
        // NOP
    }

    tabInvokeAll(request) {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                this.tabInvoke(tab.id, request);
            }
        });
    }

    tabInvoke(tabId, request) {
        const callback = () => this.checkLastError(chrome.runtime.lastError);
        request.target = "frontend"
        chrome.tabs.sendMessage(tabId, request, callback);
    }

    formatNote(notedef) {
        let options = this.options;
        if (!options.deckname || !options.typename || !options.expression)
            return null;

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            options: { allowDuplicate: options.duplicate == '1' ? true : false },
            fields: {},
            tags: []
        };

        let fieldnames = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url'];
        for (const fieldname of fieldnames) {
            if (!options[fieldname]) continue;
            note.fields[options[fieldname]] = notedef[fieldname];
        }

        let tags = options.tags.trim();
        if (tags.length > 0) 
            note.tags = tags.split(' ');

        if (options.audio && notedef.audios.length > 0) {
            note.fields[options.audio] = '';
            let audionumber = Number(options.preferredaudio);
            audionumber = (audionumber && notedef.audios[audionumber]) ? audionumber : 0;
            let audiofile = notedef.audios[audionumber];
            note.audio = {
                'url': audiofile,
                'filename': `ODH_${options.dictSelected}_${encodeURIComponent(notedef.expression)}_${audionumber}.mp3`,
                'fields': [options.audio]
            };
        }

        return note;
    }

    // Message Hub and Handler start from here ...
    onMessage(request, sender, callback) {
        // Only this extension may drive the worker; the browser supplies sender.id.
        // NOTE: this stays silent on purpose. Replying would confirm the extension's
        // presence to a foreign sender, and there is no legitimate caller to inform.
        if (!sender || sender.id !== chrome.runtime.id)
            return;

        const { action, params, target} = request;

        // Not addressed to this listener: the sender may be waiting on another one.
        if (target != 'serviceworker')
            return;

        // Everything below this line is our own code's request, so it is answered exactly
        // once and a caller can never be left waiting on a channel that will not reply.
        const fail = (kind, detail) => callback(odhFail(kind, detail));

        if (!params || typeof params !== 'object') {
            // WHY: this used to throw on `params.callback = ...`, leaving the channel open.
            fail('unknown', `Missing params for action: ${action}`);
            return true;
        }

        // initBackend is a lifecycle trigger, not part of any source's action surface;
        // it has its own entry, so it is matched before source routing.
        if (action === 'initBackend') {
            params.callback = callback;
            this.initBackend(params);
            return true;
        }

        // Route by the sender's browser-supplied source: the handler name itself is
        // the permission surface (source_action), so no separate matrix is kept.
        const source = senderSource(sender);
        const method = source ? this[source + '_' + action] : undefined;

        if (typeof(method) !== 'function') {
            // Unroutable means this source may not call this action: refuse explicitly
            // instead of leaving the channel open.
            console.warn('UNAUTHORIZED', { source: source || 'unrecognized', action, url: sender.url, tab: Boolean(sender.tab) });
            fail('handler-error', `Action not allowed for source: ${action}`);
            return true;
        }

        params.callback = callback;
        try {
            method.call(this, params);
        } catch (error) {
            console.error('Handler threw:', action, error && error.message);
            fail('handler-error', error);
        }
        return true;
    }

    async sendtoBackground(request){
        request.target='background';
        let result;
        try {
            result = await chrome.runtime.sendMessage(request);
        } catch (error) {
            throw odhError('network', odhErrorMessage(error));
        }
        // Local callers get a plain value or a classified throw; the envelope only exists
        // where a message crosses a boundary. The offscreen signals its own failures with a
        // thrown Error carrying a kind, not with an envelope, so a failure can never be read
        // back as a success value. A channel that closes before the reply is also a failure.
        if (result && typeof result === 'object' && typeof result.kind === 'string' && !odhIsEnvelope(result)) {
            throw result;
        }
        return odhUnwrap(result);
    }

    // sandbox message handler
    async offscreen_Fetch(params) {
        let { url, callback } = params;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }
        
            const text = await response.text();
            callback(text);
        } catch (error) {
            // The dictionary adapter still sees null, but the reason is now classified.
            console.error('Dictionary fetch failed:', error && error.message);
            callback(odhFail('network', error));
        }
    }

    async offscreen_Deinflect(params) {
        let { word, callback } = params;
        if (!this.deinflector) {
            callback(odhFail('missing-data', 'Deinflector is not loaded'));
            return;
        }
        callback(this.deinflector.deinflect(word));
    }

    async offscreen_getBuiltin(params) {
        let { dict, word, callback } = params;
        if (!this.builtin || !this.builtin.dicts || !this.builtin.dicts[dict]) {
            // WHY: a failed data load used to make findTerm throw on an undefined dict,
            // which left the request unanswered.
            callback(odhFail('missing-data', `Builtin dictionary not loaded: ${dict}`));
            return;
        }
        callback(this.builtin.findTerm(dict, word));
    }

    async offscreen_getLocale(params) {
        let { callback } = params;
        try {
            callback(chrome.i18n.getUILanguage());
        } catch (error) {
            callback(odhFail('handler-error', error));
        }
    }

    async initBackend(params) {
        // Concurrent announcements must share one initialization: without this, two
        // in-flight calls would both pass the rebuild guard and load every dictionary
        // twice, then write the settings twice. The slot is released in finally, so a
        // later sandbox document can still initialize.
        this.initInFlight ??= (async () => {
            try {
                let options = await optionsLoad();
                // A sandbox document announces itself here, so this is the fresh-start
                // path: its dictionaries must be (re)built regardless of configuration.
                await this.optionsChanged(options, { rebuildScripts: true });
            } catch {
                console.error('Unable to initialize settings.');
            } finally {
                this.initInFlight = null;
            }
        })();
        await this.initInFlight;
        // The sandbox triggers this and ignores the value; keep the existing reply shape.
        params.callback(null);
    }

    // Frontend API
    async frontend_getTranslation(params) {
        let { expression, callback } = params;

        // Fix https://github.com/ninja33/ODH/issues/97
        if (expression.endsWith(".")) {
            expression = expression.slice(0, -1);
        }

        try {
            let result = await this.findTerm(expression);
            callback(result);
        } catch (error) {
            console.error('Translation lookup failed:', error && error.message);
            callback(odhFail('network', error));
        }
    }

    async frontend_addNote(params) {
        let { notedef, callback } = params;

        const note = this.formatNote(notedef);
        if (!this.target) {
            callback(odhFail('not-ready', 'No Anki service is configured'));
            return;
        }
        try {
            let result = await this.target.addNote(note);
            callback(result);
        } catch (err) {
            // NOTE: never retried automatically; a timed-out write may have succeeded.
            console.error(err);
            callback(odhFail('network', err));
        }
    }

    async frontend_playAudio(params) {
        let { url, callback } = params;

        try {
            let result = await this.playAudio(url);
            callback(result);
        } catch (error) {
            callback(odhFail('handler-error', error));
        }
    }

    // The Anki connection state is read by the content script (to draw the add-note
    // button) and by the action popup (to show the status line), so each source gets
    // its own named entry even though the implementation is shared.
    async frontend_getVersion(params) {
        return await this.options_getVersion(params);
    }

    async popup_getVersion(params) {
        return await this.options_getVersion(params);
    }

    // Option page and Brower Action page requests handlers.
    // rebuildScripts: the caller knows the sandbox side is new (or was reset), so the
    // scripts must be registered again even when the configuration itself is unchanged.
    // The difference belongs to the entry, not to options: the options page has no way
    // to know the sandbox's state, and must not be asked for it.
    async optionsChanged(options, { rebuildScripts = false } = {}) {
        this.setFrontendOptions(options);

        switch (options.services) {
            case 'none':
                this.target = null;
                break;
            case 'ankiconnect':
                this.target = this.ankiconnect;
                break;
            default:
                // Legacy 'ankiweb' values fall through: the service was removed.
                this.target = null;
        }
        if (this.target !== null && typeof(this.target.initConnection) === 'function')
            await this.target.initConnection(options);

        let defaultscripts = ['builtin_encn_Collins'];
        let newscripts = `${options.sysscripts},${options.udfscripts}`;
        let loadresults = null;
        // WHY: this.options lives in the worker while the loaded dictionaries live in the
        // sandbox document. A reset sandbox has lost its dicts while this.options is still
        // set, so comparing configurations alone would skip the rebuild and leave it empty.
        if (rebuildScripts || !this.options || (`${this.options.sysscripts},${this.options.udfscripts}` != newscripts)) {
            const scriptsset = Array.from(new Set(defaultscripts.concat(newscripts.split(',').filter(x => x).map(x => x.trim()))));
            loadresults = await this.loadScripts(scriptsset);
        }

        this.options = options;
        if (loadresults) {
            let namelist = loadresults.map(x => x.result.objectname);
            this.options.dictSelected = namelist.includes(options.dictSelected) ? options.dictSelected : namelist[0];
            this.options.dictNamelist = loadresults.map(x => x.result);
        }
        await this.setScriptsOptions(this.options);
        await optionsSave(this.options);
    }

    // Option pages API
    async options_optionsChanged(params) {
        let { options, callback } = params;
        try {
            await this.optionsChanged(options);
        } catch (error) {
            // NOTE: a failed save is reported, never retried: the write may be partial.
            console.error('Unable to save settings.');
            callback(odhFail('handler-error', error));
            return;
        }
        callback(this.options);
    }

    async options_getDeckNames(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(await this.target.getDeckNames());
        } catch (error) {
            callback(odhFail('network', error));
        }
    }

    async options_getModelNames(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(await this.target.getModelNames());
        } catch (error) {
            callback(odhFail('network', error));
        }
    }

    async options_getModelFieldNames(params) {
        let { modelName, callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(await this.target.getModelFieldNames(modelName));
        } catch (error) {
            callback(odhFail('network', error));
        }
    }

    async options_getVersion(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(await this.target.getVersion());
        } catch (error) {
            callback(odhFail('network', error));
        }
    }

    // The action popup loads the same options.js/OptionsAPI as the options page, so it
    // reaches the same settings and deck queries through its own named entries.
    async popup_optionsChanged(params) {
        return await this.options_optionsChanged(params);
    }

    async popup_getDeckNames(params) {
        return await this.options_getDeckNames(params);
    }

    // Sandbox API
    async loadScripts(list) {
        let promises = list.map((name) => this.loadScript(name));
        let results = await Promise.all(promises);
        return results.filter(x => { if (x.result) return x.result; });
    }

    async loadScript(name) {
        return await this.sendtoBackground({action:'loadScript', params:{name}});
    }

    async setScriptsOptions(options) {
        // Keep credentials and service endpoints out of the dictionary sandbox.
        const scriptOptions = { ...options };
        for (const field of ['id', 'password', 'ankiconnecturl']) {
            delete scriptOptions[field];
        }
        return await this.sendtoBackground({action:'setScriptsOptions', params:{options: scriptOptions}});
    }

    async findTerm(expression) {
        return await this.sendtoBackground({action:'findTerm', params:{expression}});
    }

    async playAudio(url) {
        return await this.sendtoBackground({action:'playAudio', params:{url}});
    }
}

// The source comes from browser-supplied sender fields, never from message payloads.
// A content script is identified by sender.tab (its url is the host page, which varies
// per site); extension pages by their exact url.
function senderSource(sender) {
    if (!sender || sender.id !== chrome.runtime.id) return null;
    if (sender.tab) return 'frontend';
    switch (sender.url) {
        case chrome.runtime.getURL('bg/background.html'): return 'offscreen';
        case chrome.runtime.getURL('bg/options.html'): return 'options';
        case chrome.runtime.getURL('bg/popup.html'): return 'popup';
        default: return null;
    }
}

importScripts('ankiconnect.js');
importScripts('builtin.js');
importScripts('deinflector.js');
importScripts('utils.js');
importScripts('../../lib/envelope.js');

setupOffscreenDocument('/bg/background.html');
globalThis.odh_serviceworker = new ODHServiceworker();

// according to woxxom's reply on below stackoverflow discussion
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
