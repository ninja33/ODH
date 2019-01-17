function getImageSource(id) {
    return document.querySelector(`#${id}`).src;
}

function registerAddNoteLinks() {
    for (let link of document.getElementsByClassName('odh-addnote')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            e.currentTarget.src = getImageSource('load');
            window.parent.postMessage({
                action: 'addNote',
                params: {
                    nindex: ds.nindex,
                    dindex: ds.dindex,
                    context: document.querySelector('#odh-context').value
                }
            }, '*');
        });
    }
}

function registerAudioLinks() {
    for (let link of document.getElementsByClassName('odh-playaudio')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({
                action: 'playAudio',
                params: {
                    nindex: ds.nindex,
                    dindex: ds.dindex
                }
            }, '*');
        });
    }
}

function registerSoundLinks() {
    for (let link of document.getElementsByClassName('odh-playsound')) {
        link.setAttribute('src', getImageSource('play'));
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({
                action: 'playSound',
                params: {
                    sound: ds.sound,
                }
            }, '*');
        });
    }
}

function onDomContentLoaded() {
    registerAddNoteLinks();
    registerAudioLinks();
    registerSoundLinks();
}

function onMessage(e) {
    const { action, params } = e.data;
    const method = window['api_' + action];
    if (typeof(method) === 'function') {
        method(params);
    }
}

function api_setActionState(result) {
    const { response, params } = result;
    const { nindex, dindex } = params;

    const match = document.querySelector(`.odh-addnote[data-nindex="${nindex}"].odh-addnote[data-dindex="${dindex}"]`);
    if (response)
        match.src = getImageSource('good');
    else
        match.src = getImageSource('fail');

    setTimeout(() => {
        match.src = getImageSource('plus');
    }, 1000);
}

function onMouseWheel(e) {
    document.querySelector('html').scrollTop -= e.wheelDeltaY / 3;
    document.querySelector('body').scrollTop -= e.wheelDeltaY / 3;
    e.preventDefault();
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
window.addEventListener('message', onMessage);
window.addEventListener('wheel', onMouseWheel);