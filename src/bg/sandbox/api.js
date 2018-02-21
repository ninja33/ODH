async function sendBGMessage(action, params) {
    return new Promise((resolve, reject)=>{
        try {
            chrome.runtime.sendMessage({action, params},result=>resolve(result));
        } catch (err) {
            reject(null);
        }
    });
}

async function deInflect(word) {
    return await sendBGMessage("deInflect", {word});
}

async function onlineQuery(url) {
    return await sendBGMessage("onlineQuery", {url});
}

function callback(data, callbackId) {
    sendBGMessage("callback", {data, callbackId});
}

function sandboxLoaded() {
    sendBGMessage("sandboxLoaded", {});
}
