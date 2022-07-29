/* global Ankiconnect, Ankiweb, Deinflector, Builtin, Agent, optionsLoad, optionsSave */
class ODHBack {
    constructor() {
        this.audios = {};
        this.options = null;

        this.ankiconnect = new Ankiconnect();
        this.ankiweb = new Ankiweb();
        this.target = null;

        //setup lemmatizer
        this.deinflector = new Deinflector();
        this.deinflector.loadData();

        //Setup builtin dictionary data
        this.builtin = new Builtin();
        this.builtin.loadData();

        this.agent = new Agent(document.getElementById('sandbox').contentWindow);

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        window.addEventListener('message', e => this.onSandboxMessage(e));
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
        chrome.commands.onCommand.addListener((command) => this.onCommand(command));

    }

    onCommand(command) {
        if (command != 'enabled') return;
        this.options.enabled = !this.options.enabled;
        this.setFrontendOptions(this.options);
        optionsSave(this.options);
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({ url: chrome.extension.getURL('bg/guide.html') });
            return;
        }
        if (details.reason === 'update') {
            chrome.tabs.create({ url: chrome.extension.getURL('bg/update.html') });
            return;
        }
    }

    onTabReady(tabId) {
        this.tabInvoke(tabId, 'setFrontendOptions', { options: this.options });
    }

    setFrontendOptions(options) {

        switch (options.enabled) {
            case false:
                chrome.browserAction.setBadgeText({ text: 'off' });
                break;
            case true:
                chrome.browserAction.setBadgeText({ text: '' });
                break;
        }
        this.tabInvokeAll('setFrontendOptions', {
            options
        });
    }

    checkLastError(){
        // NOP
    }

    tabInvokeAll(action, params) {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                this.tabInvoke(tab.id, action, params);
            }
        });
    }

    tabInvoke(tabId, action, params) {
        const callback = () => this.checkLastError(chrome.runtime.lastError);
        chrome.tabs.sendMessage(tabId, { action, params }, callback);
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
        const { action, params } = request;
        const method = this['api_' + action];

        if (typeof(method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }
        return true;
    }

    onSandboxMessage(e) {
        const {
            action,
            params
        } = e.data;
        const method = this['api_' + action];
        if (typeof(method) === 'function')
            method.call(this, params);

    }

    async api_initBackend(params) {
        let options = await optionsLoad();
        this.ankiweb.initConnection(options);

        //to do: will remove it late after all users migrate to new version.
        if (options.dictLibrary) { // to migrate legacy scripts list to new list.
            options.sysscripts = options.dictLibrary;
            options.dictLibrary = '';
        }
        this.opt_optionsChanged(options);
    }

    async api_Fetch(params) {
        let { url, callbackId } = params;

        let request = {
            url,
            type: 'GET',
            dataType: 'text',
            timeout: 3000,
            error: (xhr, status, error) => this.callback(null, callbackId),
            success: (data, status) => this.callback(data, callbackId)
        };
        $.ajax(request);
    }

    async api_Deinflect(params) {
        let { word, callbackId } = params;
        this.callback(this.deinflector.deinflect(word), callbackId);
    }

    async api_getBuiltin(params) {
        let { dict, word, callbackId } = params;
        this.callback(this.builtin.findTerm(dict, word), callbackId);
    }

    async api_getLocale(params) {
        let { callbackId } = params;
        this.callback(chrome.i18n.getUILanguage(), callbackId);
    }

    // front end message handler
    async api_isConnected(params) {
        let callback = params.callback;
        callback(await this.opt_getVersion());
    }

    async api_getTranslation(params) {
        let { expression, callback } = params;

        // Fix https://github.com/ninja33/ODH/issues/97
        if (expression.endsWith(".")) {
            expression = expression.slice(0, -1);
        }

        try {
            let result = await this.findTerm(expression);
            callback(result);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    async api_addNote(params) {
        let { notedef, callback } = params;

        const note = this.formatNote(notedef);
        try {
            let result = await this.target.addNote(note);
            callback(result);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    async api_playAudio(params) {
        let { url, callback } = params;
        
        for (let key in this.audios) {
            this.audios[key].pause();
        }

        try {
            const audio = this.audios[url] || new Audio(url);
            audio.currentTime = 0;
            audio.play();
            this.audios[url] = audio;
            callback(true);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    // Option page and Brower Action page requests handlers.
    async opt_optionsChanged(options) {
        this.setFrontendOptions(options);

        switch (options.services) {
            case 'none':
                this.target = null;
                break;
            case 'ankiconnect':
                this.target = this.ankiconnect;
                break;
            case 'ankiweb':
                this.target = this.ankiweb;
                break;
            default:
                this.target = null;
        }

        let defaultscripts = ['builtin_encn_Collins'];
        let newscripts = `${options.sysscripts},${options.udfscripts}`;
        let loadresults = null;
        if (!this.options || (`${this.options.sysscripts},${this.options.udfscripts}` != newscripts)) {
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
        optionsSave(this.options);
        return this.options;
    }


    async opt_getDeckNames() {
        return this.target ? await this.target.getDeckNames() : null;
    }

    async opt_getModelNames() {
        return this.target ? await this.target.getModelNames() : null;
    }

    async opt_getModelFieldNames(modelName) {
        return this.target ? await this.target.getModelFieldNames(modelName) : null;
    }

    async opt_getVersion() {
        return this.target ? await this.target.getVersion() : null;
    }

    // Sandbox communication start here
    async loadScripts(list) {
        let promises = list.map((name) => this.loadScript(name));
        let results = await Promise.all(promises);
        return results.filter(x => { if (x.result) return x.result; });
    }

    async loadScript(name) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('loadScript', { name }, result => resolve(result));
        });
    }

    async setScriptsOptions(options) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('setScriptsOptions', { options }, result => resolve(result));
        });
    }

    async findTerm(expression) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('findTerm', { expression }, result => resolve(result));
        });
    }

    callback(data, callbackId) {
        this.agent.postMessage('callback', { data, callbackId });
    }


}

window.odhback = new ODHBack();