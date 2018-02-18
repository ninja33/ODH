class AODHBack {
    constructor() {
        this.options = null;
        this.target = new Ankiconnect();
        this.dictlib = new Dictlib();

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

    async api_sandboxLoaded(params) {
        let opts = await optionsLoad();
        this.api_updateOptions({
            options: opts,
            callback: newOptions => optionsSave(newOptions),
        });
    }

    async api_updateOptions(params) {
        let {
            options,
            callback
        } = params;

        this.setOptions(options);
        this.dictlib.setOptions(options);
        let newOptions = await this.dictlib.loadDict();
        callback(newOptions);
    }

    async api_getTranslation(params) {
        let {
            expression,
            callback
        } = params;

        try {
            let result = await this.dictlib.findTerm(expression);
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