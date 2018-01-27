class AODHBack {
    constructor() {
        this.options = null;
        this.translator = null;
        this.target = new Ankiconnect();
        this.dictlib = new Dictlib();
        optionsLoad().then((opts) => {
            this.api_updateOptions({
                options: opts,
                callback: () => null
            });
        });
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
        this.tabInvoke(tabId, 'setOptions', {options:this.options});
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
        this.tabInvokeAll('setOptions', {options:this.options});
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


    async api_updateOptions(params) {
        let {
            options,
            callback
        } = params;

        this.setOptions(options);
        this.target.setOptions(options);
        this.dictlib.setOptions(options);
        let {
            dictlist,
            selected
        } = await this.dictlib.loadDict();
        this.translator = new dictlist[selected];
        let dictnames = Object.keys(dictlist);
        callback({
            dictnames,
            selected
        });
    }

    api_getTranslation(params) {
        let {
            word,
            callback
        } = params;

        this.translator.findTerm(word).then(result => {
            callback(result);
        }).catch(error => {
            callback(null);
        });
    }

    api_createNote(params) {
        let {
            note,
            callback
        } = params;

        this.target.createNote(note).then(result => {
            callback(result);
        }).catch(error => {
            callback(result);
        });
    }

}

window.aodhback = new AODHBack();