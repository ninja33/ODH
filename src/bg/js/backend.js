/* global Ankiconnect, Deinflector, Builtin, Agent, optionsLoad, optionsSave */
class ODHBack {
    constructor() {
        this.options = null;
        this.lastoptions = null;

        this.target = new Ankiconnect();
        this.deinflector = new Deinflector();
        this.deinflector.loadData();
        //Setup builtin dictionary data
        this.builtin = new Builtin();
        this.builtin.loadData();

        this.list = [];
        this.agent = new Agent();

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        window.addEventListener('message', e => this.onSandboxMessage(e));
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({
                url: chrome.extension.getURL('bg/guide.html')
            });
            return;
        }
        if (details.reason === 'update') {
            chrome.tabs.create({
                url: chrome.extension.getURL('bg/update.html')
            });
            return;
        }
    }

    onTabReady(tabId) {
        this.tabInvoke(tabId, 'setOptions', {
            options: this.options
        });
    }

    setOptions(options) {
        this.lastoptions = this.options;
        this.options = options;

        switch (options.enabled) {
        case false:
            chrome.browserAction.setBadgeText({
                text: 'off'
            });
            break;
        case true:
            chrome.browserAction.setBadgeText({
                text: ''
            });
            break;
        }
        this.tabInvokeAll('setOptions', {
            options: this.options
        });
    }

    tabInvokeAll(action, params) {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                this.tabInvoke(tab.id, action, params);
            }
        });
    }

    tabInvoke(tabId, action, params) {
        chrome.tabs.sendMessage(tabId, {
            action,
            params
        }, () => null);
    }

    formatNote(notedef) {
        let options = this.options;
        if (!options.deckname || !options.typename || !options.expression)
            return null;

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            fields: {},
            tags: ['ODH']
        };

        let fieldnames = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url'];
        for (const fieldname of fieldnames) {
            if (!options[fieldname]) continue;
            note.fields[options[fieldname]] = notedef[fieldname];
        }

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

    async loadDict() {
        let defaultdict = ['builtin_encn_Collins'];
        let path = this.options.dictLibrary;
        //temporary path fix for v0.2
        if (path == 'encn_List') {
            path = 'builtin_encn_Collins, builtin_encn_Oxford, encn_Collins, encn_Oxford, encn_Cambridge, enen_Collins, cncn_Zdic';
            this.options.dictLibrary = path;
        }

        if (this.pathChanged(path)) {
            const loadingpath = Array.from(new Set(defaultdict.concat(path.split(',').filter(x => x).map(x => x.trim()))));
            this.list = await this.loadDictionaries(loadingpath.map(this.pathMapping));
        }
        let selected = this.options.dictSelected;
        selected = this.list.includes(selected) ? selected : this.list[0];
        this.options.dictSelected = selected;
        this.options.dictNamelist = this.list;
        await this.setDictOptions(this.options);
        return this.options;
    }


    pathMapping(path) {
        let gitbase = 'https://raw.githubusercontent.com/';

        let paths = {
            'loc://': 'http://127.0.0.1/',
            'lib://': gitbase + 'ninja33/ODH/master/src/dict/',
            'git://': gitbase,
        };

        //to shorten script URL.
        for (const key of Object.keys(paths)) {
            path = (path.indexOf(key) != -1) ? paths[key] + path.replace(key, '') : path;
        }
        //use local script if nothing specified in URL prefix.
        if ((path.indexOf('https://') == -1) && (path.indexOf('http://') == -1)) {
            path = chrome.runtime.getURL('dict/' + path);
        }
        //add .js suffix if missing.
        path = (path.indexOf('.js') == -1) ? path + '.js' : path;
        return path;
    }

    pathChanged(path) {
        return !this.lastoptions || (this.lastoptions.dictLibrary != path);
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
        if (typeof (method) === 'function') {
            method.call(this, params);
        }
    }

    async api_sandboxLoaded(params) {
        let options = await optionsLoad();
        this.opt_optionsChanged(options);
    }

    async api_Fetch(params) {
        let {
            url,
            callbackId
        } = params;

        let request = {
            url,
            type: 'GET',
            dataType: 'text',
            timeout: 2500,
            error: (xhr, status, error) => this.callback(null, callbackId),
            success: (data, status) => this.callback(data, callbackId)
        };
        $.ajax(request);
    }

    async api_Deinflect(params) {
        let {
            word,
            callbackId
        } = params;
        this.callback(this.deinflector.deinflect(word), callbackId);
    }

    async api_getCollins(params) {
        let {
            word,
            callbackId
        } = params;
        this.callback(this.builtin.getCollins(word), callbackId);
    }

    async api_getOxford(params) {
        let {
            word,
            callbackId
        } = params;
        this.callback(this.builtin.getOxford(word), callbackId);
    }

    async api_getLocale(params) {
        let {
            callbackId
        } = params;
        this.callback(chrome.i18n.getUILanguage(), callbackId);
    }

    async api_getTranslation(params) {
        let {
            expression,
            callback
        } = params;

        try {
            let result = await this.findTerm(expression);
            callback(result);
        } catch (err) {
            callback(null);
        }
    }

    api_addNote(params) {
        let {
            notedef,
            callback
        } = params;

        const note = this.formatNote(notedef);
        this.target.addNote(note).then(result => {
            callback(result);
        });
    }

    // Option page and Brower Action page requests handlers.
    async opt_optionsChanged(options) {
        this.setOptions(options);
        let newOptions = await this.loadDict();
        await optionsSave(newOptions);
        return newOptions;
    }

    async opt_getDeckNames() {
        return await this.target.getDeckNames();
    }

    async opt_getModelNames() {
        return await this.target.getModelNames();
    }

    async opt_getModelFieldNames(modelName) {
        return await this.target.getModelFieldNames(modelName);
    }

    async opt_getVersion() {
        return await this.target.getVersion();
    }

    // Sandbox communication start here
    async loadDictionaries(list) {
        let promises = list.map((url) => this.loadDictionary(url));
        let results = await Promise.all(promises);
        return results.filter(x => x);
    }

    async loadDictionary(url) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('loadDictionary', {
                url
            }, result => resolve(result));
        });
    }

    async setDictOptions(options) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('setDictOptions', {
                options
            }, result => resolve(result));
        });
    }

    async findTerm(expression) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('findTerm', {
                expression
            }, result => resolve(result));
        });
    }

    callback(data, callbackId) {
        this.agent.postMessage('callback', {
            data,
            callbackId
        });
    }


}

window.odhback = new ODHBack();