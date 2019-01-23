function switchTab(e) {
    for (const x of document.getElementsByClassName('tabcontent'))
        x.style.display = 'none';
    document.getElementById(e.target.dataset.contentid).style.display = 'block';
    for (const x of document.getElementsByClassName('tabmenu')) {
        x.className = 'tabmenu';
    }
    e.target.className = 'tabmenu active';
}

for (const menu of document.querySelectorAll('.tabmenu'))
    menu.addEventListener('click', switchTab, false);