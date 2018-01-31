//function onDomContentLoaded() {
//    document.getElementsByClassName('odh-createnote')[0].addEventListener('click', () => {
//        window.parent.postMessage('createNote', '*');
//    });
//}

function registerAddNoteLinks() {
    for (let link of document.getElementsByClassName('odh-createnote')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({action: 'createNote', params: ds.index}, '*');
        });
    }
}

function registerAudioLinks() {
    for (let link of document.getElementsByClassName('odh-playaudio')) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            window.parent.postMessage({action: 'playAudio', params: ds.index}, '*');
        });
    }
}

function onDomContentLoaded() {
    registerAddNoteLinks();
    registerAudioLinks();
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
