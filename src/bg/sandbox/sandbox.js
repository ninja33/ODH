class Sandbox {
    constructor() {
        this.dicts = {};
        this.current = null;
        window.addEventListener('message', e => this.onBackendMessage(e));
    }

    onBackendMessage(e) {
        const {
            action,
            params,
        } = e.data, method = this['backend_' + action];
        if (typeof (method) === 'function') {
            method.call(this, params);
        }
    }

    async backend_loadDictionary(params) {
        let {
            url,
            callbackId
        } = params;

        let script = await api.fetch(url);
        if (!script) {
            api.callback(null, callbackId);
            return;
        }

        let Dictionary = null;
        let displayname = null;
        try {
            Dictionary = eval(`(${script})`);
        } catch (err) {
            api.callback(null, callbackId);
            return;
        }

        if (Dictionary.name && typeof Dictionary === 'function') {
            let dictionary = new Dictionary();
            displayname = (typeof dictionary.displayName === 'function') ? await dictionary.displayName() : Dictionary.name;
            if (!this.dicts[displayname])
                this.dicts[displayname] = dictionary;
        }
        api.callback(displayname, callbackId);
    }

    backend_setDictOptions(params) {
        let {
            options,
            callbackId
        } = params;

        for (const [key, item] of Object.entries(this.dicts)) {
            item.setOptions(options);
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
        let {
            expression,
            callbackId
        } = params;

        if (this.dicts[this.current]) {
            let notes = await this.dicts[this.current].findTerm(expression);
            api.callback(notes, callbackId);
            return;
        }
        api.callback(null, callbackId);
    }
}

window.sandbox = new Sandbox();
document.addEventListener('DOMContentLoaded', () => {
    api.sandboxLoaded()
}, false);