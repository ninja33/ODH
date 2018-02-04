function registerAddNoteLinks() {
    for (let link of document.getElementsByClassName('odh-createnote')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({action: 'createNote', params: {nindex:ds.nindex,dindex:ds.dindex}}, '*');
        });
    }
}

function registerAudioLinks() {
    for (let link of document.getElementsByClassName('odh-playaudio')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({action: 'playAudio', params: {nindex:ds.nindex,dindex:ds.dindex}}, '*');
        });
    }
}

function onDomContentLoaded() {
    registerAddNoteLinks();
    registerAudioLinks();
}

function onMessage(e) {
    const {action, params} = e.data, method = window['api_' + action];
    if (typeof(method) === 'function') {
        method(params);
    }
}

function onMouseWheel(e){
    document.querySelector('html').scrollTop -= e.wheelDeltaY / 3; 
    e.preventDefault();
}

function api_setActionState(params) {
    return null;
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
window.addEventListener('message', onMessage);
window.addEventListener('wheel', onMouseWheel);