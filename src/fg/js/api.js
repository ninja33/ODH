async function sendToBackend(request) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(request, (result) => {
            resolve(result);
        });
    });
}

async function isConnected() {
    try {
        return await sendToBackend({ action: 'isConnected', params: {} });
    } catch (err) {
        return null;
    }
}

async function getTranslation(expression) {
    // console.log('Step 2');
    try {
        return await sendToBackend({
            action: 'getTranslation',
            params: { expression },
        });
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function addNote(notedef) {
    try {
        return await sendToBackend({ action: 'addNote', params: { notedef } });
    } catch (err) {
        return null;
    }
}

async function playAudio(url) {
    try {
        return await sendToBackend({ action: 'playAudio', params: { url } });
    } catch (err) {
        return null;
    }
}
