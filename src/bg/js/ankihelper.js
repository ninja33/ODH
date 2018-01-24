class AnkiHelperBackEnd {
    constructor() {
        this.options = null;
        this.dictionary = {};

        optionsLoad((opts) => {
            this.options = opts;
            this.dictionary = new Dictionary(opts);
            this.translator = new Translator(opts);
            this.target = new Ankiconnect(opts);
            this.dictionary.loadLibrary();
            this.translator.setDictionary(this.dictionary.getCurrentDict());
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

    api_getTranslation(params) {
        let {
            word,
            callback
        } = params;

        this.translator.getTranslation(word).then(result => {
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