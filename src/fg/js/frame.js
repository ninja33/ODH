function hackTagsColor() {
    var colorMap = {
        'n.'     : '#e3412f',
        'a.'     : '#f8b002',
        'adj.'   : '#f8b002',
        'ad.'    : '#684b9d',
        'adv.'   : '#684b9d',
        'v.'     : '#539007',
        'vi.'    : '#539007',
        'vt.'    : '#539007',
        'prep.'  : '#04B7C9',
        'conj.'  : '#04B7C9',
        'pron.'  : '#04B7C9',
        'art.'   : '#04B7C9',
        'num.'   : '#04B7C9',
        'int.'   : '#04B7C9',
        'interj.': '#04B7C9',
        'modal.' : '#04B7C9',
        'aux.'   : '#04B7C9',
        'pl.'    : '#D111D3',
        'abbr.'  : '#D111D3',
        'phrase.': '#8A8A91'
    };
    
    [].forEach.call(document.querySelectorAll('.abkl-defs'), function(div) {
    div.innerHTML = div.innerHTML.replace(/\b[a-z]+\./g, function(symbol) {
            if(colorMap[symbol]) {
                return `<span class="highlight" style="background-color:${colorMap[symbol]}">${symbol}</span>`;
            } else {
                return symbol;
            }
        });
    });    
} 


function onDomContentLoaded() {
    hackTagsColor();
    document.getElementsByClassName('abkl-addnote')[0].addEventListener('click', () => {
        window.parent.postMessage({action: 'addNote', params: {}}, '*');
    });
}

document.addEventListener('DOMContentLoaded', onDomContentLoaded, false);
