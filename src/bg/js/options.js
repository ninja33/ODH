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

// options.html has no #id / #password inputs; the stored credentials are carried over as-is.
function readOptionalValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : undefined;
}

function hideAllGifs() {
    for (const gif of document.querySelectorAll('.gif')) gif.hidden = true;
}

async function populateAnkiDeckAndModel(options) {
    const deck = document.getElementById('deckname');
    deck.replaceChildren();
    let names = await options_api.getDeckNames();
    // WHY: a failed query means Anki is unreachable, so the lists stay empty rather than
    // reading names[0] off null and rejecting unhandled.
    if (names === null) return;
    names.forEach(name => deck.append(new Option(name, name)));

    let deckName = options.deckname ? options.deckname : names[0];
    setSelectValue(deck, deckName);

    const type = document.getElementById('typename');
    type.replaceChildren();
    names = await options_api.getModelNames();
    if (names === null) return;
    names.forEach(name => type.append(new Option(name, name)));

    let typeName = options.typename ? options.typename: names[0];
    setSelectValue(type, typeName);
}

async function populateAnkiFields(options) {
    const modelName = readSelectValue(document.getElementById('typename')) || options.typename;
    if (modelName === null) return;

    let names = await options_api.getModelFieldNames(modelName);
    if (names == null) return;

    let fields = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        const el = document.getElementById(field);
        el.replaceChildren();
        el.append(new Option('', ''));
        names.forEach(name => el.append(new Option(name, name)));
        setSelectValue(el, options[field]);
    });
}

async function updateServiceStatus(options) {
    for (const panel of document.querySelectorAll('.service-options'))
        panel.hidden = true;
    document.getElementById('services-status').textContent = chrome.i18n.getMessage('msgFailed');
    switch (options.services) {
        case 'none':
            break;
        case 'ankiconnect':
            document.getElementById('service-options-ankiconnect').hidden = false;
            updateAnkiProfile(options) 
            break;
        default:
            break;
    }
}

async function updateAnkiProfile(options) {
    const profile = document.getElementById('service-options-ankiprofile');
    const status = document.getElementById('services-status');
    profile.hidden = true;
    status.textContent = chrome.i18n.getMessage('msgConnecting');
    
    let version = await options_api.getVersion();
    if (version === null) {
        status.textContent = chrome.i18n.getMessage('msgFailed');
    } else {
        // WHY: the field list reads the model select, so it has to run after that select is
        // filled. Awaiting both also keeps a failed query from rejecting unhandled.
        await populateAnkiDeckAndModel(options);
        await populateAnkiFields(options);
        status.textContent = chrome.i18n.getMessage('msgSuccess', [version]);
        profile.hidden = false;
        if (options.services == 'ankiconnect')
            document.getElementById('duplicate-option').hidden = false;
        else {
            document.getElementById('duplicate-option').hidden = true;
        }
    }
}

function populateDictionary(dicts) {
    const dict = document.getElementById('dict');
    dict.replaceChildren();
    dicts.forEach(item => dict.append(new Option(item.displayname, item.objectname)));
}

function populateSysScriptsList(dictLibrary) {
    const optionscripts = Array.from(new Set(dictLibrary.split(',').filter(x => x).map(x => x.trim())));
    let systemscripts = [
        'builtin_encn_Collins', 'general_Makenotes',//default & builtin script
        'cncn_Zdic', //cn-cn dictionary
        'encn_Collins', 'encn_Cambridge', 'encn_Cambridge_tc', 'encn_Oxford', 'encn_Youdao', //en-cn dictionaries
        'enen_Collins', 'enen_LDOCE6MDX', 'enen_UrbanDict', //en-en dictionaries
        'enfr_Cambridge', 'enfr_Collins', //en-fr dictionaries
        'fren_Cambridge', 'fren_Collins', //fr-cn dictionaries
        'esen_Spanishdict', 'decn_Eudict', 'escn_Eudict', 'frcn_Eudict', 'frcn_Youdao', 'rucn_Qianyi' //msci dictionaries
    ];
    const body = document.getElementById('scriptslistbody');
    body.replaceChildren();
    systemscripts.forEach(script => {
        const row = document.createElement('div');
        row.className = 'sl-row';

        const onoff = document.createElement('input');
        onoff.className = 'sl-col sl-col-onoff';
        onoff.type = 'checkbox';
        onoff.checked = optionscripts.includes(script) || optionscripts.includes('lib://' + script);

        const cloud = document.createElement('input');
        cloud.className = 'sl-col sl-col-cloud';
        cloud.type = 'checkbox';
        cloud.checked = optionscripts.includes('lib://' + script);

        const name = document.createElement('span');
        name.className = 'sl-col sl-col-name';
        name.textContent = script;

        const description = document.createElement('span');
        description.className = 'sl-col sl-col-description';
        description.textContent = chrome.i18n.getMessage(script);

        row.append(onoff, cloud, name, description);
        body.append(row);
    });

    const first = body.querySelector('.sl-row');
    // make default script(first row) always active.
    first.querySelector('.sl-col-onoff').checked = true;
    // make default script(first row) as local script.
    first.querySelector('.sl-col-cloud').checked = false;
    // make default sys script untouch
    for (const box of first.querySelectorAll('.sl-col-onoff, .sl-col-cloud'))
        box.style.visibility = 'hidden';
}

function onScriptListChange() {
    let dictLibrary = [];
    for (const row of document.querySelectorAll('.sl-row')) {
        if (row.querySelector('.sl-col-onoff').checked == true)
            dictLibrary.push(row.querySelector('.sl-col-cloud').checked ? 'lib://' + row.querySelector('.sl-col-name').textContent : row.querySelector('.sl-col-name').textContent);
    }
    document.getElementById('sysscripts').value = dictLibrary.join();
}

function onHiddenClicked() {
    for (const box of document.querySelectorAll('.sl-col-cloud'))
        box.classList.toggle('hidden');
}

async function onAnkiTypeChanged() {
    let options = await loadOptions();
    await populateAnkiFields(options);
}

async function onServicesChanged() {
    try {
        let options = await loadOptions();

        options.services = readSelectValue(document.getElementById('services'));
        options.id = readOptionalValue('id') ?? options.id;
        options.password = readOptionalValue('password') ?? options.password;
        options.ankiconnecturl = document.getElementById('ankiconnecturl').value;

        let newOptions = await options_api.optionsChanged(options);
        if (!newOptions) {
            throw new Error('Settings were not confirmed.');
        }
        await updateServiceStatus(newOptions);
    } catch {
        document.getElementById('services-status').textContent = chrome.i18n.getMessage('msgSaveFailed');
    }
}

async function onSaveClicked(e) {
    // WHY: currentTarget is cleared once dispatch ends, so it must be read before any await.
    const buttonId = e.currentTarget.id;

    hideAllGifs();
    document.getElementById('gif-load').hidden = false;
    try {
        let optionsOld = await loadOptions();
        let options = structuredClone(optionsOld);

        options.enabled = document.getElementById('enabled').checked;
        options.mouseselection = document.getElementById('mouseselection').checked;
        options.hotkey = readSelectValue(document.getElementById('hotkey'));

        options.dictSelected = readSelectValue(document.getElementById('dict'));
        options.monolingual = readSelectValue(document.getElementById('monolingual'));
        options.preferredaudio = readSelectValue(document.getElementById('anki-preferred-audio'));
        options.maxcontext = readSelectValue(document.getElementById('maxcontext'));
        options.maxexample = readSelectValue(document.getElementById('maxexample'));

        options.services = readSelectValue(document.getElementById('services'));
        options.id = readOptionalValue('id') ?? options.id;
        options.password = readOptionalValue('password') ?? options.password;

        options.ankiconnecturl = document.getElementById('ankiconnecturl').value;
        options.tags = document.getElementById('tags').value;
        options.duplicate = readSelectValue(document.getElementById('duplicate'));

        let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
        fields.forEach(field => {
            const value = readSelectValue(document.getElementById(field));
            options[field] = value == null ? options[field] : value;
        });

        options.sysscripts = document.getElementById('sysscripts').value;
        options.udfscripts = document.getElementById('udfscripts').value;

        let newOptions = await options_api.optionsChanged(options);
        if (!newOptions) {
            throw new Error('Settings were not confirmed.');
        }

        populateDictionary(newOptions.dictNamelist);
        setSelectValue(document.getElementById('dict'), newOptions.dictSelected);

        await updateServiceStatus(newOptions);

        const good = document.getElementById('gif-good');
        good.hidden = false;
        good.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 })
            .finished.then(hideAllGifs, hideAllGifs);

        if (buttonId == 'saveclose')
            window.close();
    } catch {
        document.getElementById('gif-fail').hidden = false;
    } finally {
        document.getElementById('gif-load').hidden = true;
    }
}

function onCloseClicked() {
    window.close();
}

async function onReady() {
    localizeHtmlPage();
    let options = await loadOptions();
    document.getElementById('enabled').checked = options.enabled;
    document.getElementById('mouseselection').checked = options.mouseselection;
    setSelectValue(document.getElementById('hotkey'), options.hotkey);

    populateDictionary(options.dictNamelist);
    setSelectValue(document.getElementById('dict'), options.dictSelected);

    setSelectValue(document.getElementById('monolingual'), options.monolingual);
    setSelectValue(document.getElementById('anki-preferred-audio'), options.preferredaudio);
    setSelectValue(document.getElementById('maxcontext'), options.maxcontext);
    setSelectValue(document.getElementById('maxexample'), options.maxexample);

    setSelectValue(document.getElementById('services'), options.services);
    // #id / #password have no inputs in options.html, so the element may be absent.
    for (const [id, value] of [['id', options.id], ['password', options.password]]) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    document.getElementById('ankiconnecturl').value = options.ankiconnecturl;
    document.getElementById('tags').value = options.tags;
    setSelectValue(document.getElementById('duplicate'), options.duplicate);

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        setSelectValue(document.getElementById(field), options[field]);
    });

    document.getElementById('sysscripts').value = options.sysscripts;
    document.getElementById('udfscripts').value = options.udfscripts;
    populateSysScriptsList(options.sysscripts);
    onHiddenClicked();

    document.getElementById('connect').addEventListener('click', onServicesChanged);
    document.getElementById('saveload').addEventListener('click', onSaveClicked);
    document.getElementById('saveclose').addEventListener('click', onSaveClicked);
    document.getElementById('close').addEventListener('click', onCloseClicked);
    hideAllGifs();

    for (const box of document.querySelectorAll('.sl-col-onoff, .sl-col-cloud'))
        box.addEventListener('click', onScriptListChange);
    document.getElementById('hidden').addEventListener('click', onHiddenClicked);
    document.getElementById('typename').addEventListener('change', onAnkiTypeChanged);
    document.getElementById('services').addEventListener('change', onServicesChanged);

    updateServiceStatus(options);
}

document.addEventListener('DOMContentLoaded', () => onReady());
const options_api = new OptionsAPI();
