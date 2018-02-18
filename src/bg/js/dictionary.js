class Dictlib {
    constructor() {
        this.options = null;
        this.lastoptions = null;
        this.list = [];
        this.callbacks = {};
        chrome.runtime.onMessage.addListener(this.onSandboxMessage.bind(this));
    }

    setOptions(opts) {
        this.lastoptions = this.options;
        this.options = opts;
    }

    async loadDict() {
        let path = this.options.dictLibrary;
        if (this.pathChanged(path)) {
            const loadingpath = Array.from(new Set(['encn_Youdao'].concat(path.split(',').map(x => x.trim()))));
            this.list = await this.loadDictionaries(loadingpath.map(this.pathMapping));
        }
        let selected = this.options.dictSelected;
        selected = this.list.includes(selected) ? selected : 'encn_Youdao';
        await this.setCurrentDict(selected);
        this.options.dictSelected = selected;
        this.options.dictNamelist = this.list;
        await this.setDictOptions(this.options);
        return this.options;
    }

    pathMapping(path) {
        if ((path.indexOf('lib://') != -1) || (path.indexOf('git://') != -1)) {
            path = (path.indexOf('lib://') == -1) ? 'https://raw.githubusercontent.com/ninja33/ODH/master/src/dict/' + path.replace('lib://', '') : path;
            path = (path.indexOf('git://') == -1) ? 'https://raw.githubusercontent.com/' + path.replace('git://', '') : path;
        } else {
            path = chrome.runtime.getURL('dict/' + path);
        }
        path = (path.indexOf('.js') == -1) ? path + '.js' : path;
        return path;
    }

    pathChanged(remotelist) {
        return !this.lastoptions || (this.lastoptions.dictLibrary != remotelist);
    }

    // --- Sandbox communication start here ---
    sendMessage(action, params, callback) {
        if (callback) {
            params.callbackId = Math.random();
            this.callbacks[params.callbackId] = callback;
        }
        document.getElementById('sandbox').contentWindow.postMessage({
            action,
            params,
        }, '*');
    }

    onSandboxMessage(request, sender, callback) {
        const {
            action,
            params,
        } = request, method = this['sbx_' + action];
        if (typeof (method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }
        return true;
    }

    async loadDictionaries(list) {
        let promises = list.map((url) => this.loadDictionary(url));
        let results = await Promise.all(promises);
        return results.filter(x => x)
    }

    async loadDictionary(url) {
        return new Promise((resolve, reject) => {
            this.sendMessage('loadDictionary', {url}, result => resolve(result));
        })
    }

    async setCurrentDict(selected) {
        return new Promise((resolve, reject) => {
            this.sendMessage('setCurrentDict', {selected}, result => resolve(result));
        })
    }

    async setDictOptions(options) {
        return new Promise((resolve, reject) => {
            this.sendMessage('setDictOptions', {options}, result => resolve(result));
        });
    }

    async findTerm(expression) {
        return new Promise((resolve, reject) => {
            this.sendMessage('findTerm', {expression}, result => resolve(result));
        })
    }

    async makeRequest(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.timeout = 5000;
            xhr.onload = () => {
                resolve(xhr.response);
            };
            xhr.onerror = xhr.ontimeout = () => {
                reject(null);
            };
            xhr.send();
        });
    }


    async sbx_onlineQuery(params) {
        let {
            url,
            callback
        } = params;

        try {
            let data = await this.makeRequest(url);
            callback(data);
        } catch (err) {
            callback(null);
        }
    }

    sbx_callback(params) {
        if (!params || !params.callbackId)
            return;
        // we are the sender getting the callback
        if (this.callbacks[params.callbackId] && typeof (this.callbacks[params.callbackId]) === 'function') {
            this.callbacks[params.callbackId](params.data);
            delete this.callbacks[params.callbackId];
            return;
        }
    }

}