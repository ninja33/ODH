class ODHBack {
    constructor() {
        this.options = null;
        this.lastoptions = null;

        this.target = new Ankiconnect();
        this.deinflector = new Deinflector();
        this.deinflector.loadData();

        this.list = [];
        this.agent = new Agent();

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
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

    onMessage(request, sender, callback) {
        const {
            action,
            params
        } = request, method = this['api_' + action];

        if (typeof (method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }
        return true;
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
        if (!options.deckname || !options.typename || !options.expression || !options.definition)
            return null;

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            fields: {},
            tags: ['anki-helper']
        };

        let fieldnames = ['expression', 'reading', 'extrainfo', 'definition', 'sentence']
        for (const fieldname of fieldnames) {
            if (!options[fieldname]) continue;
            note.fields[options[fieldname]] = notedef[fieldname];
        }
        return note;
    }

    async loadDict() {
        let path = this.options.dictLibrary;
        if (this.pathChanged(path)) {
            const loadingpath = Array.from(new Set(['encn_Youdao'].concat(path.split(',').filter(x => x).map(x => x.trim()))));
            this.list = await this.loadDictionaries(loadingpath.map(this.pathMapping));
        }
        let selected = this.options.dictSelected;
        selected = this.list.includes(selected) ? selected : 'encn_Youdao';
        this.options.dictSelected = selected;
        this.options.dictNamelist = this.list;
        await this.setDictOptions(this.options);
        return this.options;
    }


    pathMapping(path) {
        let gitbase = 'https://raw.githubusercontent.com/';

        if ((path.indexOf('lib://') != -1) || (path.indexOf('git://') != -1)) {
            path = (path.indexOf('lib://') != -1) ? gitbase + 'ninja33/ODH/master/src/dict/' + path.replace('lib://', '') : path;
            path = (path.indexOf('git://') != -1) ? gitbase + path.replace('git://', '') : path;
        } else {
            path = chrome.runtime.getURL('dict/' + path);
        }
        path = (path.indexOf('.js') == -1) ? path + '.js' : path;
        return path;
    }

    pathChanged(path) {
        return !this.lastoptions || (this.lastoptions.dictLibrary != path);
    }

    async api_sandboxLoaded(params) {
        let options = await optionsLoad();
        this.opt_optionsChanged(options);
    }

    async api_onlineQuery(params) {
        let {
            url,
            callback
        } = params;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 5000;
        xhr.onload = () => {
            callback(xhr.response);
        };
        xhr.onerror = xhr.ontimeout = () => {
            callback(null);
        };
        xhr.send();
    }

    async api_deInflect(params) {
        let {
            word,
            callback
        } = params;
        callback(this.deinflector.deinflect(word));
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
        return results.filter(x => x)
    }

    async loadDictionary(url) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('loadDictionary', {
                url
            }, result => resolve(result));
        })
    }

    async setCurrentDict(selected) {
        return new Promise((resolve, reject) => {
            this.agent.postMessage('setCurrentDict', {
                selected
            }, result => resolve(result));
        })
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
        })
    }

}

window.odhback = new ODHBack();