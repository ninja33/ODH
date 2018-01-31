function onDomContentLoaded() {
    document.getElementsByClassName('odh-createnote')[0].addEventListener('click', () => {
        window.parent.postMessage('createNote', '*');
    });
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
