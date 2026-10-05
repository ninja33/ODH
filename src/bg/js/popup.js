/* global localizeHtmlPage, utilAsync, optionsLoad */
async function populateAnkiDeckAndModel(options) {
    $('#deckname').empty();
    let names = await options_api.getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', { value: name, text: name })));
    }
    let deckName = options.deckname ? options.deckname : names[0]; 
    $('#deckname').val(deckName);
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(item => $('#dict').append($('<option>', { value: item.objectname, text: item.displayname })));
}

async function updateServiceStatus(options) {
    $('.service-options').hide();
    switch (options.services) {
        case 'none':
            break;
        case 'ankiconnect':
            updateAnkiProfile(options) 
            break;
        default:
            break;
    }
}

async function updateAnkiProfile(options) {
    let version = await options_api.getVersion();
    if (version === null) {
        $('#service-options-ankiprofile').hide();
    } else {
        populateAnkiDeckAndModel(options);
        $('#service-options-ankiprofile').show();
    }
}

async function onOptionChanged(e) {
    if (!e.originalEvent) return;

    $('#save-status').text('');
    try {
        let options = await optionsLoad();

        options.enabled = $('#enabled').prop('checked');
        options.mouseselection = $('#mouseselection').prop('checked');
        options.hotkey = $('#hotkey').val();

        options.dictSelected = $('#dict').val();

        options.deckname = $('#deckname').val();
        options.tags = $('#tags').val();
        const newOptions = await options_api.optionsChanged(options);
        if (!newOptions) {
            throw new Error('Settings were not confirmed.');
        }
    } catch {
        $('#save-status').text(chrome.i18n.getMessage('msgSaveFailed'));
    }
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
    let options = await optionsLoad();
    $('#enabled').prop('checked', options.enabled);
    $('#mouseselection').prop('checked', options.mouseselection);
    $('#hotkey').val(options.hotkey);
    populateDictionary(options.dictNamelist);
    $('#dict').val(options.dictSelected);
    $('#deckname').val(options.deckname);
    $('#tags').val(options.tags);

    $('#enabled').change(onOptionChanged);
    $('#mouseselection').change(onOptionChanged);
    $('#hotkey').change(onOptionChanged);
    $('#dict').change(onOptionChanged);

    $('#deckname').change(onOptionChanged);
    $('#tags').change(onOptionChanged);

    $('#more').click(onMoreOptions);

    updateServiceStatus(options);

}

$(document).ready(utilAsync(onReady));
const options_api = new OptionsAPI();
