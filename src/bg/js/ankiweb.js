let id = '';
let password = '';

async function connect() {
    return new Promise((resolve, reject) => {
        $.get('https://ankiuser.net/edit/', (result) => {
            let data = null;
            let title = $('h1', $(result));
            if (!title.length) return Promise.reject(false);
            switch (title[0].innerText) {
            case 'Add':
                //console.log('(connect) already login: get deck and model');
                data = getInfo(result);
                resolve({ action: 'edit', data });
                break;
            case 'Log in':
                //console.log('(connect) not login yet: try to get login token');
                data = $('input[name=csrf_token]', $(result)).val();
                resolve({ action: 'login', data });
                break;
            default:
                //console.log('(connect) failed!');
                reject(false);
            }

        });
    });
}

async function login(id, password, token) {
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
                //console.log('(login) success!');
                resolve(true);
            } else {
                //console.log('(login) failed!');
                reject(false);
            }
        });
    });
}

function getInfo(response) {
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
    return {decknames, modelnames, modelids, modelfieldnames, token};
}

async function save(note, info) {
    let fields = [];
    for (const field of info.modelfieldnames[note.modelName]) {
        fields.push(note.fields[field]);
    }

    let data = [fields, note.tags.join(' ')];
    return new Promise((resolve, reject) => {
        var dict = {
            csrf_token: info.token,
            data,
            mid: info.modelids[note.modelName],
            deck: note.deckName
        };
        $.post('https://ankiuser.net/edit/save', dict, (result) => {
            //TODO ...
        });
    });
}

async function checkAnkiweb() {
    let resp = await connect();
    switch (resp.action) {
    case 'edit':
        //console.log(resp.data);
        break;
    case 'login':
        if (await login(id, password, resp.data))
            resp = await connect();
        break;
    default:
    }
}

checkAnkiweb();

//--- Webrequest API.
const targetPage = ['https://ankiweb.net/account/login', 'https://ankiuser.net/edit/save'];
const userAgent = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36';
const filters = { urls: targetPage };
const extraInfoSpec = ['requestHeaders', 'blocking'];

function rewriteHeader(e) {
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
            e.requestHeaders.push({ name: 'origin', value: origin });
        if (!hasReferer)
            e.requestHeaders.push({ name: 'referer', value: referer });
    }

    return { requestHeaders: e.requestHeaders };
}

chrome.webRequest.onBeforeSendHeaders.addListener(rewriteHeader, filters, extraInfoSpec);