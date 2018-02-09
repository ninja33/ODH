function odhback() {
    return chrome.extension.getBackgroundPage().aodhback
}

function localizeHtmlPage() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', {
        value: name,
        text: name
    })));
}

async function onOptionChanged(e) {
    if (!e.originalEvent) {
        return;
    }

    let options = await optionsLoad();

    options.enabled = $('#enabled').prop('checked');
    options.hotkey = $('#hotkey').val();
    options.dictSelected = $('#dict').val();
    let request = {
        action: 'updateOptions',
        params: {
            options
        }
    };
    chrome.runtime.sendMessage(request, () => {
        optionsSave(options);
    });
}

function onMoreOptions() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
}

async function onReady() {
    localizeHtmlPage();
    let opts = await optionsLoad();
    $('#enabled').prop('checked', opts.enabled);
    $('#hotkey').val(opts.hotkey);
    populateDictionary(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#enabled').change(onOptionChanged);
    $('#hotkey').change(onOptionChanged);
    $('#dict').change(onOptionChanged);
    $('#more').click(onMoreOptions);
}

$(document).ready(utilAsync(onReady));

function utilAsync(func) {
    return function (...args) {
        func.apply(this, args);
    };
}