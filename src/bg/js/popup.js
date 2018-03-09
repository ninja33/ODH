/* global odhback, localizeHtmlPage, utilAsync, optionsLoad, optionsSave */
async function populateAnkiDeckAndModel(opts) {
    let names = [];
    $('#deckname').empty();
    names = await odhback().opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', { value: name, text: name })));
    }
    $('#deckname').val(opts.deckname);
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', { value: name, text: name })));
}

async function updateAnkiStatus() {
    let version = await odhback().opt_getVersion();
    if (version === null) {
        $('.anki-options').hide();
    } else {
        $('.anki-options').show();
    }
}

async function onOptionChanged(e) {
    if (!e.originalEvent) return;

    let options = await optionsLoad();

    options.enabled = $('#enabled').prop('checked');
    options.hotkey = $('#hotkey').val();
    options.deckname = $('#deckname').val();
    options.dictSelected = $('#dict').val();
    odhback().opt_optionsChanged(options);
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
    $('#deckname').val(opts.deckname);
    populateDictionary(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#enabled').change(onOptionChanged);
    $('#hotkey').change(onOptionChanged);
    $('#deckname').change(onOptionChanged);
    $('#dict').change(onOptionChanged);
    $('#more').click(onMoreOptions);

    $('.anki-options').hide();
    updateAnkiStatus();
    populateAnkiDeckAndModel(opts);

}

$(document).ready(utilAsync(onReady));