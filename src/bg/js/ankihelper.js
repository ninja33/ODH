class AnkiHelperBackEnd {
    constructor() {
        this.translator = null;
        this.target = new Ankiconnect();
        this.dictlib = new Dictlib();
        optionsLoad().then((opts)=>{
            this.api_updateOptions({options:opts});
        });
        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
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

    async api_updateOptions(params) {
        let {
            options,
            callback
        } = params;

        this.target.setOptions(options);
        this.dictlib.setOptions(options);
        let {dictlist, selected} = await this.dictlib.loadDict();
        this.translator = new dictlist[selected];
        let dictnames = Object.keys(dictlist);
        return callback? callback({dictnames,selected}) : null;
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

window.abkl_backend = new AnkiHelperBackEnd();