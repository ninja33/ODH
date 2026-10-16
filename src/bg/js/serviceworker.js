/* global Ankiconnect, Deinflector, Builtin, optionsLoad, optionsSave, ODH_DICTIONARY_FETCH_TIMEOUT_MS, odhOk, odhFail, odhSendMessage, odhLog, TO_WORKER, TO_OFFSCREEN, TO_FRONTEND */
class ODHServiceworker {
    constructor() {

        this.options = null;
        this.initInFlight = null;

        this.ankiconnect = new Ankiconnect();
        this.target = null;

        //setup lemmatizer
        this.deinflector = new Deinflector();
        //Setup builtin dictionary data
        this.builtin = new Builtin();
        // NOTE: loadData settles null on failure, so this never rejects.
        this.dataReady = Promise.all([this.deinflector.loadData(), this.builtin.loadData()]);

        // WHY: loaded here, not on demand: a restarted worker must recover without
        // waiting for an announcement or a request (architecture defect 3).
        this.optionsReady = (async () => {
            try {
                let options = await optionsLoad();
                // WHY: a save that landed during the read is newer — do not overwrite it.
                if (this.options) return;
                await this.setupOptions(options);
                this.options = options;
            } catch (error) {
                console.error(`Unable to load settings: ${error && error.message}`);
            }
        })();

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
        chrome.commands.onCommand.addListener((command) => this.onCommand(command));
    }

    async onCommand(command) {
        if (command != 'enabled') return;
        // WHY: the constructor's read may still be in flight; toggling on null options
        // used to throw and leave the shortcut dead.
        if (!this.options) return;
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
        // WHY: a tab can become ready before the constructor's read lands; broadcasting
        // null options used to throw inside the content script's handler. The next tab
        // event carries the configuration.
        if (!this.options) return;
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
        request.target = TO_FRONTEND
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
        if (target != TO_WORKER)
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

    // sandbox message handler
    async offscreen_Fetch(params) {
        let { url, callback } = params;

        // WHY: the caller's reply budget (ODH_DEFAULT_REQUEST_TIMEOUT_MS) bounds waiting only;
        // without this shorter, fetch-side deadline a URL that never answers would keep running
        // here long after the caller had already failed with 'timeout'.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ODH_DICTIONARY_FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const text = await response.text();
            callback(odhOk(text));
        } catch (error) {
            // WHY: an abort is this deadline firing, not the network failing; without the
            // branch a dictionary that was merely slow would be flattened into 'network'.
            const kind = (error && error.name === 'AbortError') ? 'timeout' : (error && error.kind ? error.kind : 'network');
            // The dictionary adapter still sees null, but the reason is now classified.
            console.error('Dictionary fetch failed:', odhLog(url, error, kind));
            callback(odhFail(kind, error));
        } finally {
            clearTimeout(timer);
        }
    }

    async offscreen_Deinflect(params) {
        let { word, callback } = params;
        // WHY: a restarted worker's data load may still be running; answering now would
        // read the dataset before it exists.
        await this.dataReady;
        if (!this.deinflector) {
            callback(odhFail('missing-data', 'Deinflector is not loaded'));
            return;
        }
        callback(odhOk(this.deinflector.deinflect(word)));
    }

    async offscreen_getBuiltin(params) {
        let { dict, word, callback } = params;
        // WHY: same pending data load as offscreen_Deinflect — the dictionaries may still
        // be parsing.
        await this.dataReady;
        if (!this.builtin || !this.builtin.dicts || !this.builtin.dicts[dict]) {
            // WHY: a failed data load used to make findTerm throw on an undefined dict,
            // which left the request unanswered.
            callback(odhFail('missing-data', `Builtin dictionary not loaded: ${dict}`));
            return;
        }
        callback(odhOk(this.builtin.findTerm(dict, word)));
    }

    async offscreen_getLocale(params) {
        let { callback } = params;
        try {
            callback(odhOk(chrome.i18n.getUILanguage()));
        } catch (error) {
            callback(odhFail('handler-error', error));
        }
    }

    async initBackend(params) {
        // Concurrent announcements must share one initialization: without this, two
        // in-flight calls would both load every dictionary twice, then write the
        // settings twice. The slot is released in finally, so a later sandbox document
        // can still initialize.
        this.initInFlight ??= (async () => {
            try {
                let options = await optionsLoad();
                // A sandbox document announces itself here, so this is the fresh-start
                // path: its dictionaries must be (re)built regardless of configuration.
                // WHY: loaded here rather than through the save path, whose reload is
                // conditional on a configuration change.
                await this.setupScripts(options);
                this.options = options;
                await this.setScriptsOptions(this.options);
                await optionsSave(this.options);
            } catch {
                console.error('Unable to initialize settings.');
            } finally {
                this.initInFlight = null;
            }
        })();
        await this.initInFlight;
        // The sandbox ignores this reply, but the relay that carries it still reads it, and
        // after the strict change a bare value would be a protocol error there.
        params.callback(odhOk(null));
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
            callback(odhOk(result));
        } catch (error) {
            // WHY: the action is logged, never the expression. A looked-up term is page content,
            // and a diagnostic line must not carry it.
            console.error('Translation lookup failed:', odhLog('getTranslation', error, error && error.kind));
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
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
            callback(odhOk(result));
        } catch (error) {
            // NOTE: never retried automatically; a timed-out write may have succeeded.
            // WHY: log the action and its classification rather than the error object, whose
            // message may carry the card's payload or the configured endpoint.
            console.error('Add note failed:', odhLog('addNote', error, error && error.kind));
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
        }
    }

    async frontend_playAudio(params) {
        let { url, callback } = params;

        try {
            let result = await this.playAudio(url);
            callback(odhOk(result));
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
    // NOTE: applies only — the caller records this.options as its closing step.
    async setupOptions(options) {
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
    }

    // NOTE: no flags — loading is the caller's condition, and the caller records
    // this.options. Fixups land in place, on the passed options.
    async setupScripts(options) {
        let defaultscripts = ['builtin_encn_Collins'];
        let newscripts = `${options.sysscripts},${options.udfscripts}`;
        const scriptsset = Array.from(new Set(defaultscripts.concat(newscripts.split(',').filter(x => x).map(x => x.trim()))));
        let { loaded, failed } = await this.loadScripts(scriptsset);

        let namelist = loaded.map(x => x.result.objectname);
        if (namelist.length > 0 && !namelist.includes(options.dictSelected)) {
            // WHY: the selection moves without any UI signal, so the console names the
            // dictionary that could not be selected and the one that took over.
            let reason = failed.some(x => x.name === options.dictSelected) ? 'failed to load' : 'is no longer configured';
            console.info(`Dictionary ${options.dictSelected} ${reason}, switching to ${namelist[0]}`);
            options.dictSelected = namelist[0];
        }
        options.dictNamelist = loaded.map(x => x.result);
    }

    async optionsChanged(options) {
        // WHY: this.options lives in the worker while the loaded dictionaries live in the
        // sandbox document. A reset sandbox has lost its dicts while this.options is still
        // set, so comparing configurations alone would skip the rebuild and leave it empty.
        // WHY: !this.options covers a constructor load that failed or is still in flight
        // — a popup toggle is itself the event that wakes the worker — so the first save
        // forces a full rebuild.
        const scriptsChanged = !this.options
            || (`${this.options.sysscripts},${this.options.udfscripts}` != `${options.sysscripts},${options.udfscripts}`);
        await this.setupOptions(options);
        if (scriptsChanged) await this.setupScripts(options);
        this.options = options;
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
        callback(odhOk(this.options));
    }

    async options_getDeckNames(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(odhOk(await this.target.getDeckNames()));
        } catch (error) {
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
        }
    }

    async options_getModelNames(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(odhOk(await this.target.getModelNames()));
        } catch (error) {
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
        }
    }

    async options_getModelFieldNames(params) {
        let { modelName, callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(odhOk(await this.target.getModelFieldNames(modelName)));
        } catch (error) {
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
        }
    }

    async options_getVersion(params) {
        let { callback } = params;
        if (!this.target) { callback(odhFail('not-ready', 'No Anki service is configured')); return; }
        try {
            callback(odhOk(await this.target.getVersion()));
        } catch (error) {
            callback(odhFail(error && error.kind ? error.kind : 'network', error));
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
        const settled = await Promise.allSettled(list.map((name) => this.loadScript(name)));
        return settled.reduce((acc, result, index) => {
            if (result.status === 'fulfilled')
                acc.loaded.push(result.value);
            else
                acc.failed.push({ name: list[index], reason: result.reason });
            return acc;
        }, { loaded: [], failed: [] });
    }

    async loadScript(name) {
        return await odhSendMessage(TO_OFFSCREEN, {action:'loadScript', params:{name}});
    }

    async setScriptsOptions(options) {
        // Keep credentials and service endpoints out of the dictionary sandbox.
        const scriptOptions = { ...options };
        for (const field of ['id', 'password', 'ankiconnecturl']) {
            delete scriptOptions[field];
        }
        return await odhSendMessage(TO_OFFSCREEN, {action:'setScriptsOptions', params:{options: scriptOptions}});
    }

    async findTerm(expression) {
        return await odhSendMessage(TO_OFFSCREEN, {action:'findTerm', params:{expression}});
    }

    async playAudio(url) {
        return await odhSendMessage(TO_OFFSCREEN, {action:'playAudio', params:{url}});
    }
}

// The source comes from browser-supplied sender fields, never from message payloads.
// A content script is identified by sender.tab (its url is the host page, which varies
// per site); extension pages by their exact url.
function senderSource(sender) {
    if (!sender || sender.id !== chrome.runtime.id) return null;
    if (sender.tab) return 'frontend';
    switch (sender.url) {
        case chrome.runtime.getURL('bg/offscreen.html'): return 'offscreen';
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
importScripts('../../lib/message.js');

// WHY: a failed creation must not become an unhandled rejection at worker startup; the
// offscreen document is recreated on demand, so only the reason is logged here.
setupOffscreenDocument('/bg/offscreen.html').catch(error => {
    console.error('Unable to create the offscreen document:', error && error.message);
});
globalThis.odh_serviceworker = new ODHServiceworker();

// according to woxxom's reply on below stackoverflow discussion
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
