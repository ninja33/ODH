/*  global api, 
    builtin_encn_Collins,
    general_Makenotes,
    cncn_Zdic,
    encn_Collins,
    encn_Cambridge,
    encn_Cambridge_tc,
    encn_Oxford,
    encn_Youdao,
    encn_Baicizhan,
    enen_Collins,
    enfr_Cambridge,
    enfr_Collins,
    fren_Cambridge,
    fren_Collins,
    esen_Spanishdict,
    decn_Eudict,
    escn_Eudict,
    frcn_Eudict,
    rucn_Qianyi
*/

class Sandbox {
    constructor() {
        this.dicts = {
            builtin_encn_Collins: new builtin_encn_Collins(),
            general_Makenotes: new general_Makenotes(),
            cncn_Zdic: new cncn_Zdic(),
            encn_Collins: new encn_Collins(),
            encn_Cambridge: new encn_Cambridge(),
            encn_Cambridge_tc: new encn_Cambridge_tc(),
            encn_Oxford: new encn_Oxford(),
            encn_Youdao: new encn_Youdao(),
            encn_Baicizhan: new encn_Baicizhan(),
            enen_Collins: new enen_Collins(),
            enfr_Cambridge: new enfr_Cambridge(),
            enfr_Collins: new enfr_Collins(),
            fren_Cambridge: new fren_Cambridge(),
            fren_Collins: new fren_Collins(),
            esen_Spanishdict: new esen_Spanishdict(),
            decn_Eudict: new decn_Eudict(),
            escn_Eudict: new escn_Eudict(),
            frcn_Eudict: new frcn_Eudict(),
            rucn_Qianyi: new rucn_Qianyi()
        };
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

    buildScriptURL(name) {
        let gitbase = 'https://raw.githubusercontent.com/ninja33/ODH/master/src/dict/';
        let url = name;

        //build remote script url with gitbase(https://) if prefix lib:// existing.
        url = (url.indexOf('lib://') != -1) ? gitbase + url.replace('lib://', '') : url;

        //use local script if nothing specified in URL prefix.
        if ((url.indexOf('https://') == -1) && (url.indexOf('http://') == -1)) {
            url = '/dict/' + url;
        }
        //add .js suffix if missing.
        url = (url.indexOf('.js') == -1) ? url + '.js' : url;
        return url;
    }

    async backend_loadScript(params) {
        let { name, callbackId } = params;
        let script = null;
        if (this.dicts.hasOwnProperty(name)) {
            script = this.dicts[name];
            let displayname = typeof(script.displayName) === 'function' ? await script.displayName() : name;
            api.callback({ name, result: { objectname: name, displayname } }, callbackId);

        } else {
            api.callback({ name, result: null }, callbackId);
            return;
        }
    }

    backend_setScriptsOptions(params) {
        let { options, callbackId } = params;

        for (const dictionary of Object.values(this.dicts)) {
            if (typeof(dictionary.setOptions) === 'function')
                dictionary.setOptions(options);
        }

        let selected = options.dictSelected;
        if (this.dicts[selected]) {
            this.current = selected;
            api.callback(selected, callbackId);
            return;
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

window.sandbox = new Sandbox();
document.addEventListener('DOMContentLoaded', () => {
    api.initBackend();
}, false);