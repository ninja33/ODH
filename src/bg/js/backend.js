class AODHBack {
    constructor() {
        this.options = null;
        this.translator = null;
        this.target = new Ankiconnect();
        this.dictlib = new Dictlib();
        optionsLoad().then((opts) => {
            this.api_updateOptions({
                options: opts,
                callback: newOptions => 
                    optionsSave(newOptions),
            });
        });
        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({url: chrome.extension.getURL('bg/guide.html')});
            return;
        }
        if (details.reason === 'update') {
            chrome.tabs.create({url: chrome.extension.getURL('bg/update.html')});
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
        if (!options.expression || !options.definition)
            return null;

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            fields: {},
            tags: ['anki-helper']
        };

        note.fields[options.expression] = notedef.expression;
        if (!options.sentence) {
            note.fields[options.definition] = notedef.definition;
        } else if (options.sentence == options.definition) {
            notedef.definition += `<hr>${notedef.sentence}`;
            note.fields[options.definition] = notedef.definition;
        } else {
            note.fields[options.definition] = notedef.definition;
            note.fields[options.sentence] = notedef.sentence;
        }
        return note;
    }

    async api_updateOptions(params) {
        let {
            options,
            callback
        } = params;

        this.setOptions(options);
        this.dictlib.setOptions(options);
        let newOptions = await this.dictlib.loadDict();
        let dictionaries = this.dictlib.dicts;
        let selected = newOptions.dictSelected;
        this.translator = new dictionaries[selected](newOptions);
        callback(newOptions);
    }

    api_getTranslation(params) {
        let {
            expression,
            callback
        } = params;

        this.translator.findTerm(expression).then(result => {
            callback(result);
        }).catch(error => {
            callback(null);
        });
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

    async api_getDeckNames() {
        return await this.target.getDeckNames();
    }

    async api_getModelNames() {
        return await this.target.getModelNames();
    }

    async api_getModelFieldNames(modelName) {
        return await this.target.getModelFieldNames(modelName);
    }

    async api_getVersion() {
        return await this.target.getVersion();
    }

}

window.aodhback = new AODHBack();