function localizeHtmlPage() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}

function SwitchTab(e) {
    for (const x of document.getElementsByClassName("tabcontent"))
        x.style.display = 'none';
    document.getElementById(e.target.dataset.contentid).style.display = 'block';
    for (const x of document.getElementsByClassName("tabmenu")) {
        x.className = 'tabmenu';
    }
    e.target.className = 'tabmenu active';
}

for (const menu of document.querySelectorAll('.tabmenu'))
    menu.addEventListener('click', SwitchTab, false);