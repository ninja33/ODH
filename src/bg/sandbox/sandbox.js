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

        let script = await onlineQuery(url);
        if (script) {
            let obj = eval(`(${script})`)
            if (obj.name && typeof obj === 'function' && !this.dicts.hasOwnProperty(obj.name)) {
                this.dicts[obj.name] = new obj();
            }
            callback(obj.name, callbackId);
            return;
        }
        callback(null, callbackId);
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
            callback(selected, callbackId);
            return
        }
        callback(null, callbackId);
    }

    async backend_findTerm(params) {
        let {
            expression,
            callbackId
        } = params;

        if (this.dicts[this.current]) {
            let notes = await this.dicts[this.current].findTerm(expression);
            callback(notes, callbackId);
            return;
        }
        callback(null, callbackId);
    }
}

window.sandbox = new Sandbox();
document.addEventListener('DOMContentLoaded', sandboxLoaded, false);