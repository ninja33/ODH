/* global odhback, localizeHtmlPage, utilAsync, optionsLoad, optionsSave */
async function populateAnkiDeckAndModel(options) {
    let names = [];
    $('#deckname').empty();
    names = await odhback().opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', { value: name, text: name })));
    }
    $('#deckname').val(options.deckname);

    $('#typename').empty();
    names = await odhback().opt_getModelNames();
    if (names !== null) {
        names.forEach(name => $('#typename').append($('<option>', { value: name, text: name })));
    }
    $('#typename').val(options.typename);
}

async function populateAnkiFields(options) {
    const modelName = $('#typename').val() || options.typename;
    if (modelName === null) return;

    let names = await odhback().opt_getModelFieldNames(modelName);
    if (names == null) return;

    let fields = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).empty();
        $(`#${field}`).append($('<option>', { value: '', text: '' }));
        names.forEach(name => $(`#${field}`).append($('<option>', { value: name, text: name })));
        $(`#${field}`).val(options[field]);
    });
}

async function updateAnkiStatus(options) {
    $('#services-status').text(chrome.i18n.getMessage('optAnkiConnecting'));
    $('#anki-options').hide();
    if (options.services == 'ankiweb')
        $('#user-options').show();
    else {
        $('#user-options').hide();
    }

    let version = await odhback().opt_getVersion();
    if (version === null) {
        $('#services-status').text(chrome.i18n.getMessage('optAnkiConnectedFail'));
    } else {
        populateAnkiDeckAndModel(options);
        populateAnkiFields(options);
        $('#services-status').text(chrome.i18n.getMessage('optAnkiConnectedSuccess', [version]));
        $('#anki-options').show();
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', { value: name, text: name })));
}

function onAnkiTypeChanged(e) {
    if (e.originalEvent)
        populateAnkiFields();
}

async function onLoginClicked(e){
    if (e.originalEvent){
        let options = await optionsLoad();
        options.id = $('#id').val();
        options.password = $('#password').val();

        $('#services-status').text(chrome.i18n.getMessage('optAnkiConnecting'));
        await odhback().ankiweb.initConnection(options, true); // set param forceLogout = true

        let newOptions = await odhback().opt_optionsChanged(options);
        updateAnkiStatus(newOptions);
        optionsSave(newOptions);
    }
}

async function onServicesChanged(e) {
    if (e.originalEvent){
        let options = await optionsLoad();
        options.services = $('#services').val();
        let newOptions = await odhback().opt_optionsChanged(options);
        updateAnkiStatus(newOptions);
        optionsSave(newOptions);
    }
}

async function onOKClicked(e) {
    if (!e.originalEvent) return;

    let optionsOld = await optionsLoad();
    let options = $.extend(true, {}, optionsOld);

    options.enabled = $('#enabled').prop('checked');
    options.hotkey = $('#hotkey').val();
    options.maxcontext = $('#maxcontext').val();
    options.maxexample = $('#maxexample').val();

    options.services = $('#services').val();
    options.id = $('#id').val();
    options.password = $('#password').val();

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        options[field] = $(`#${field}`).val() == null ? options[field] : $(`#${field}`).val();
    });

    options.preferredaudio = $('#anki-preferred-audio').val();

    options.dictLibrary = $('#repo').val();
    options.dictSelected = $('#dict').val();

    let newOptions = await odhback().opt_optionsChanged(options);
    populateDictionary(newOptions.dictNamelist);
    $('#dict').val(newOptions.dictSelected);
    optionsSave(newOptions);
    
    if (e.target.id == 'ok')
        window.close();
}

function onCancelClicked(e) {
    window.close();
}

function onLoadClicked(e) {
    onOKClicked(e);
}

async function onReady() {
    localizeHtmlPage();
    let options = await optionsLoad();
    $('#enabled').prop('checked', options.enabled);
    $('#hotkey').val(options.hotkey);
    $('#maxcontext').val(options.maxcontext);
    $('#maxexample').val(options.maxexample);

    $('#services').val(options.services);
    $('#id').val(options.id);
    $('#password').val(options.password);

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).val(options[field]);
    });
    $('#anki-preferred-audio').val(options.preferredaudio);


    $('#repo').val(options.dictLibrary);
    populateDictionary(options.dictNamelist);
    $('#dict').val(options.dictSelected);

    $('#login').click(onLoginClicked);
    $('#ok').click(onOKClicked);
    $('#cancel').click(onCancelClicked);
    $('#load').click(onLoadClicked);

    $('#typename').change(onAnkiTypeChanged);
    $('#services').change(onServicesChanged);

    updateAnkiStatus(options);
}

$(document).ready(utilAsync(onReady));