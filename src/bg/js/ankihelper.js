class AnkiHelperBackEnd{
    constructor(){
        this.options = {};

        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        loadOptions().then(opts => {
            this.setOptions(opts);
            this.translator = new Translator(opts);
            this.target = new Ankiconnect(opts);
        });
    }

    setOptions(opts){
        this.options = opts;
    }
    

    onMessage(request, sender, callback) {
        const {action, params} = request, method = this['api_' + action];

        if (typeof(method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }

        return true;
    }

    api_findTerm({word, callback}) {
        this.translator.getTranslation(word).then(result =>{
            callback(result);
        }).catch (error => {
            callback({error: error.toString ? error.toString() : error});
        });
    }

    api_addNote({noteinfo, callback}) {
        this.target.addNote(noteinfo).then(result =>{
            callback(result);
        }).catch (error => {
            callback({error: error.toString ? error.toString() : error});
        });
    }

}

window.abklbackend = new AnkiHelperBackEnd();
