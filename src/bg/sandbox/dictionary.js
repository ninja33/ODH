class Dictionary {
    constructor() {
        this.dicts = {};
        this.current = null;
        window.addEventListener('message', e => this.onBackendMessage(e));
    }

    onBackendMessage(e) {
        const { action, params } = e.data;
        const method = this['backend_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }
    }

    async backend_loadDictionary(params) {
        let { url, callbackId } = params;

        let script = await api.fetch(url);
        if (!script) {
            api.callback(null, callbackId);
            return;
        }

        let DictObject = null;
        let displayname = null;
        try {
            DictObject = eval(`(${script})`);
        } catch (err) {
            api.callback(null, callbackId);
            return;
        }

        if (DictObject.name && typeof DictObject === 'function') {
            let dictionary = new DictObject();
            displayname = typeof(dictionary.displayName) === 'function' ? await dictionary.displayName() : DictObject.name;
            if (!this.dicts[displayname])
                this.dicts[displayname] = dictionary;
        }
        api.callback(displayname, callbackId);
    }

    backend_setDictOptions(params) {
        let { options, callbackId } = params;

        for (const [key, dictionary] of Object.entries(this.dicts)) {
            if (typeof(dictionary.setOptions) === 'function')
                dictionary.setOptions(options);
        }

        let selected = options.dictSelected;
        if (this.dicts[selected]) {
            this.current = selected;
            api.callback(selected, callbackId);
            return
        }
        api.callback(null, callbackId);
    }

    async backend_findTerm(params) {
        let { expression, callbackId } = params;

        if (this.dicts[this.current] && typeof(this.dicts[this.current].findTerm) === 'function') {
            let notes = await this.dicts[this.current].findTerm(expression);
            api.callback(notes, callbackId);
            return;
        }
        api.callback(null, callbackId);
    }
}

window.sandbox = new Dictionary();
document.addEventListener('DOMContentLoaded', () => {
    api.sandboxLoaded()
}, false);