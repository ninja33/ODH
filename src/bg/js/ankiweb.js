class Ankiweb {
    constructor() {
        this.profile = null;
        this.version = 'web';
        this.id = '';
        this.password = '';
        chrome.webRequest.onBeforeSendHeaders.addListener(
            this.rewriteHeader, 
            {urls: ['https://ankiweb.net/account/login', 'https://ankiuser.net/edit/save']}, 
            ['requestHeaders', 'blocking']
        );
    }

    async setUser(option) {
        this.id = option.id;
        this.password = option.password;
    }

    async addNote(note) {
        return (note && this.profile) ? await this.saveNote(note) : Promise.resolve(null);
    }

    async getDeckNames() {
        return this.profile ? this.profile.decknames : null;
    }

    async getModelNames() {
        return this.profile ? this.profile.modelnames : null;
    }

    async getModelFieldNames(modelName) {
        return this.profile ? this.profile.modelfieldnames[modelName] : null;
    }

    async getVersion() {
        this.profile = await this.getDeckModel();
        return this.profile ? this.version : null;
    }

    // --- Ankiweb API
    async api_connect() {
        return new Promise((resolve, reject) => {
            $.get('https://ankiuser.net/edit/', (result) => {
                let title = $('h1', $(result));
                if (!title.length) return Promise.reject(false);
                switch (title[0].innerText) {
                case 'Add':
                    resolve({
                        action: 'edit',
                        data: this.parseData(result)
                    });
                    break;
                case 'Log in':
                    resolve({
                        action: 'login',
                        data: $('input[name=csrf_token]', $(result)).val()
                    });
                    break;
                default:
                    reject(false);
                }
            });
        });
    }

    async api_login(id, password, token) {
        return new Promise((resolve, reject) => {
            let info = {
                submitted: '1',
                username: id,
                password: password,
                csrf_token: token
            };
            $.post('https://ankiweb.net/account/login', info, (result) => {
                let title = $('h1', $(result));
                if (!title.length) return Promise.reject(false);
                if (title[0].innerText == 'Decks') {
                    resolve(true);
                } else {
                    reject(false);
                }
            });
        });
    }

    async api_save(note, profile) {
        let fields = [];
        for (const field of profile.modelfieldnames[note.modelName]) {
            let fielddata = note.fields[field] ? note.fields[field] : '';
            fields.push(fielddata);
        }

        let data = [fields, note.tags.join(' ')];
        return new Promise((resolve, reject) => {
            let dict = {
                csrf_token: profile.token,
                data: JSON.stringify(data),
                mid: profile.modelids[note.modelName],
                deck: note.deckName
            };
            $.post('https://ankiuser.net/edit/save', dict, (result) => {
                resolve(result);
            });
        });
    }

    async getDeckModel(retry = 2) {
        try {
            let resp = await this.api_connect();
            if (resp.action == 'edit') {
                return resp.data;
            } else if (retry > 0 && await this.api_login(this.id, this.password, resp.data)) {
                return this.getDeckModel(retry - 1);
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    async saveNote(note, retry = 2) {
        try {
            let resp = await this.api_connect();
            if (resp.action == 'edit') {
                return this.api_save(note, resp.data);
            } else if (retry > 0 && await this.api_login(this.id, this.password, resp.data)) {
                return this.saveNote(note, retry - 1);
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    parseData(response) {
        //return {deck:'default', model:'basic'};
        const token = /editor\.csrf_token2 = \'(.*)\';/.exec(response)[1];
        const models = JSON.parse(/editor\.models = (.*}]);/.exec(response)[1]); //[0] = the matching text, [1] = first capture group (what's inside parentheses)
        const decks = JSON.parse(/editor\.decks = (.*}});/.exec(response)[1]);

        let decknames = [];
        let modelnames = [];
        let modelids = {};
        let modelfieldnames = {};

        for (const deck of Object.values(decks)) {
            decknames.push(deck.name);
        }

        for (const model of models) {
            modelnames.push(model.name);
            modelids[model.name] = model.id;

            let fieldnames = [];
            for (let field of model.flds) {
                fieldnames.push(field.name);
            }
            modelfieldnames[model.name] = fieldnames;
        }
        return {
            decknames,
            modelnames,
            modelids,
            modelfieldnames,
            token
        };
    }

    rewriteHeader(e) {
        const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36';

        for (let header of e.requestHeaders) {
            if (header.name.toLowerCase() == 'user-agent') {
                header.value = userAgent;
            }
        }
        if (e.method == 'POST') {
            let origin = 'https://ankiweb.net';
            let referer = 'https://ankiweb.net';
            if (e.url == 'https://ankiweb.net/account/login') {
                origin = 'https://ankiweb.net';
                referer = 'https://ankiweb.net/account/login';
            }
            if (e.url == 'https://ankiuser.net/edit/save') {
                origin = 'https://ankiuser.net';
                referer = 'https://ankiuser.net/edit/';
            }
            let hasOrigin = false;
            let hasReferer = false;
            for (let header of e.requestHeaders) {
                if (header.name.toLowerCase() == 'origin') {
                    header.value = origin;
                    hasOrigin = true;
                }
                if (header.name.toLowerCase() == 'referer') {
                    header.value = referer;
                    hasReferer = true;
                }
            }
            if (!hasOrigin)
                e.requestHeaders.push({
                    name: 'origin',
                    value: origin
                });
            if (!hasReferer)
                e.requestHeaders.push({
                    name: 'referer',
                    value: referer
                });
        }

        return {
            requestHeaders: e.requestHeaders
        };
    }
}