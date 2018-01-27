function onDomContentLoaded() {
    document.getElementsByClassName('abkl-createnote')[0].addEventListener('click', () => {
        window.parent.postMessage('createNote', '*');
    });
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
