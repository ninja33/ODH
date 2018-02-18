var dicts = {};
var current = null;
var callbacks = {};
window.addEventListener('message', onMainMessage);
document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);

function onMainMessage(e) {
    const {
        action,
        params,
    } = e.data, method = window['main_' + action];
    if (typeof (method) === 'function') {
        method(params);
    }
}

async function sendMessage(action, params, callback) {
    return new Promise((resolve, reject)=>{
        try {
            chrome.runtime.sendMessage({action, params},result=>resolve(result));
        } catch (err) {
            reject(null);
        }
    });
}

async function onlineQuery(url) {
    return await sendMessage("onlineQuery", {url});
}

function callback(data, callbackId) {
    sendMessage("callback", {
        data,
        callbackId
    }, null);
}

async function main_loadDictionary(params) {
    let {
        url,
        callbackId
    } = params;

    let script = await onlineQuery(url);
    if (script) {
        let obj = eval(`(${script})`)
        if (obj.name && typeof obj === 'function' && !dicts.hasOwnProperty(obj.name)) {
            dicts[obj.name] = new obj();
        }
        callback(obj.name, callbackId);
        return;
    }
    callback(null, callbackId);
}

function main_setCurrentDict(params) {
    let {
        selected,
        callbackId
    } = params;

    if (dicts[selected]) {
        current = selected;
        callback(current, callbackId);
        return
    }
    callback(null, callbackId);
}

function main_setDictOptions(params) {
    let {
        options,
        callbackId
    } = params;

    for (const [key, item] of Object.entries(dicts)) {
        item.setOptions(options);
    }
    callback(null, callbackId);
}

async function main_findTerm(params) {
    let {
        expression,
        callbackId
    } = params;

    if (dicts[current]) {
        let notes = await dicts[current].findTerm(expression);
        callback(notes, callbackId);
        return;
    }
    callback(null, callbackId);
}

function onDomContentLoaded() {
    sendMessage("sandboxLoaded", {});
}
