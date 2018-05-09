urls = {
    edit   : 'https://ankiweb.net/edit/',
    save   : 'https://ankiweb.net/edit/save'
}

//Ankiweb API
async function Logout(){
    return new Promise((resolve, reject)=>{
        let request = {
            url: 'https://ankiweb.net/account/logout',
            type: 'GET',
            timeout: 3000,
            error: (xhr, status, error) => reject(error),
            success: (data, status) => {
                let token = $('input[name=csrf_token]', $(data)).val();
                if (token)
                    resolve(token);
                else
                    reject(false);
            }
        };
        console.log("Logout to AnkiWeb");
        $.ajax(request);
    });
}

async function Login(ID, Password, Token){
    return new Promise((resolve, reject)=>{
        let data = {
            submitted  : "1",
            csrf_token : Token,
            username   : ID,
            password   : Password
        }
        let request = {
            url: 'https://ankiweb.net/account/login',
            type: 'POST',
            data,
            timeout: 3000,
            error: (xhr, status, error) => reject(error),
            success: (data, status) => {
                let media = $("a[href$='/media/manage']", $(data)).length;
                if (media) {
                    console.log("Login Success");
                    resolve(true);
                }
                else {
                    console.log("Login Failed");
                    reject(false);
                }
            }
        };
        console.log("Logging... to AnkiWeb");
        $.ajax(request);
    });
}

async function connect(){
    ID = 'test@example.com';
    Password = 'Secret';
    let Token = await Logout();
    if (Token)
        setTimeout(async ()=>{
            await Login(ID, Password, Token);
        }, 2000);

}

connect();

function retrieve(callback) {
    var currentXhr = $.get(this.urls['edit'], (data, textStatus) => {
        if (textStatus == 'error') {
            this.connected = false;
            callback(false);
        } else {
            const models = jQuery.parseJSON(/editor\.models = (.*}]);/.exec(data)[1]); //[0] = the matching text, [1] = first capture group (what's inside parentheses)
            const decks = jQuery.parseJSON(/editor\.decks = (.*}});/.exec(data)[1]);

            var decknames = [];
            for (let d in decks) {
                if (!(d == 1 && decks[d].mid == null && Object.keys(decks).length > 1)) {
                    decknames.push(decks[d].name);
                }
            }
            decknames.sort();
            this.decks = decknames;

            var modelnames = [];
            var modelids = {};
            for (let m in models) {
                modelnames.push(models[m].name);
                modelids[models[m].name] = models[m].id;
            }
            this.models = modelnames;
            this.mids = modelids;

            var modelfieldnames = {};
            for (let m in models) {
                var fieldnames = [];
                for (let f in models[m].flds) {
                    fieldnames.push(models[m].flds[f].name);
                }
                modelfieldnames[models[m].name] = fieldnames;
            }
            this.modelfields = modelfieldnames;
            this.connected = true;
            console.log("decks & models data loaded success");
            callback(true);
        }
    });
}


function save(note, callback){

    var fields = [];
    for (let f of this.modelfields[note.modelName]){
        fields.push(note.fields[f])
    }

    var note_data = [fields, note.tags.join(' ')];

    var currentXhr = $.get(this.urls['edit'], (data, textStatus) => {
        if (textStatus == 'error') {
            this.connected = false;
            callback(null);
        } else {
            const csrf_token_string = /editor\.csrf_token = \'(.*)\';/.exec(data)[1];

            var dict = {
                csrf_token: csrf_token_string,
                data: JSON.stringify(note_data),
                mid: this.mids[note.modelName],
                deck: note.deckName
            };

            var currentXhr = $.post(this.urls['save'], dict, (data, textStatus) => {
                if (textStatus == 'error') {
                    callback(null);
                }
                callback(true);
                console.log("save to ankiweb");
            });
        }
    });
}

//Webrequest API.
const targetPage = "https://putsreq.com/*";
const ua = "Opera/9.80 (X11; Linux i686; Ubuntu/14.10) AnkiHelper 0.6.1";
const filters = {urls: [targetPage]};
const extraInfoSpec = ["blocking", "requestHeaders"];

function rewriteUserAgentHeader(e) {
  e.requestHeaders.forEach(function(header){
    if (header.name.toLowerCase() == "user-agent") {
      header.value = ua;
    }
  });
  return {requestHeaders: e.requestHeaders};
}

function rewriteRefererHeader(e){
    var newValue = "http://example.com/path";
    for(let header of e.requestHeaders){
        if (header.name.toLowerCase() == "user-agent") {
            header.value = ua;
        }
    }
    e.requestHeaders.push({name:"origin",value:newValue});
    e.requestHeaders.push({name:"referrer",value:newValue});
    return {requestHeaders:e.requestHeaders};
}

chrome.webRequest.onBeforeSendHeaders.addListener(rewriteRefererHeader, filters, extraInfoSpec);
