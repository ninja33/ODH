/* global localizeHtmlPage, loadOptions */

// WHY: an empty select and a select on its empty option both read as "", but only the first
// means "no choice was made". The stored configuration must keep its old value in that case.
function readSelectValue(el) {
    return el.selectedIndex < 0 ? null : el.value;
}

// WHY: assigning null leaves a select unselected instead of selecting its empty option, which
// would then read back as null rather than "" through readSelectValue.
function setSelectValue(el, value) {
    el.value = value === null ? '' : value;
}

async function populateAnkiDeckAndModel(options) {
    const deck = document.getElementById('deckname');
    deck.replaceChildren();
    let names = await options_api.getDeckNames();
    // WHY: a failed query means Anki is unreachable, so the list stays empty rather than
    // reading names[0] off null and rejecting unhandled.
    if (names === null) return;
    names.forEach(name => deck.append(new Option(name, name)));

    let deckName = options.deckname ? options.deckname : names[0];
    deck.value = deckName;
}

function populateDictionary(dicts) {
    const dict = document.getElementById('dict');
    dict.replaceChildren();
    dicts.forEach(item => dict.append(new Option(item.displayname, item.objectname)));
}

async function updateServiceStatus(options) {
    for (const panel of document.querySelectorAll('.service-options'))
        panel.hidden = true;
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
    const profile = document.getElementById('service-options-ankiprofile');
    if (version === null) {
        profile.hidden = true;
    } else {
        await populateAnkiDeckAndModel(options);
        profile.hidden = false;
    }
}

async function onOptionChanged() {
    document.getElementById('save-status').textContent = '';
    try {
        let options = await loadOptions();

        options.enabled = document.getElementById('enabled').checked;
        options.mouseselection = document.getElementById('mouseselection').checked;
        options.hotkey = readSelectValue(document.getElementById('hotkey'));

        options.dictSelected = readSelectValue(document.getElementById('dict'));

        options.deckname = readSelectValue(document.getElementById('deckname'));
        options.tags = document.getElementById('tags').value;
        const newOptions = await options_api.optionsChanged(options);
        if (!newOptions) {
            throw new Error('Settings were not confirmed.');
        }
    } catch {
        document.getElementById('save-status').textContent = chrome.i18n.getMessage('msgSaveFailed');
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
    let options = await loadOptions();
    document.getElementById('enabled').checked = options.enabled;
    document.getElementById('mouseselection').checked = options.mouseselection;
    setSelectValue(document.getElementById('hotkey'), options.hotkey);
    populateDictionary(options.dictNamelist);
    setSelectValue(document.getElementById('dict'), options.dictSelected);
    setSelectValue(document.getElementById('deckname'), options.deckname);
    document.getElementById('tags').value = options.tags;

    document.getElementById('enabled').addEventListener('change', onOptionChanged);
    document.getElementById('mouseselection').addEventListener('change', onOptionChanged);
    document.getElementById('hotkey').addEventListener('change', onOptionChanged);
    document.getElementById('dict').addEventListener('change', onOptionChanged);

    document.getElementById('deckname').addEventListener('change', onOptionChanged);
    document.getElementById('tags').addEventListener('change', onOptionChanged);

    document.getElementById('more').addEventListener('click', onMoreOptions);

    updateServiceStatus(options);

}

document.addEventListener('DOMContentLoaded', () => onReady());
const options_api = new OptionsAPI();
