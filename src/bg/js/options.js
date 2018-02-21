async function populateAnkiDeckAndModel(opts) {
    let names = [];
    $('#deck').empty();
    names = await odhback().opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deck').append($('<option>', {value: name, text: name})));
    }
    $('#deck').val(opts.deckname);

    $('#type').empty();
    names = await odhback().opt_getModelNames();
    if (names !== null) {
        names.forEach(name => $('#type').append($('<option>', {value: name, text: name})));
        //populateAnkiFields($('#anki-vocab-model').val(opts.ankiVocabModel), opts);
    }
    $('#type').val(opts.typename);
}

async function populateAnkiFields(){
    let opts = await optionsLoad();
    const modelName = $('#type').val() || opts.typename;
    if (modelName === null) {
        return;
    }

    let fields ={
        '#word':opts.expression,
        '#read':opts.reading,
        '#extr':opts.extrainfo,
        '#defs':opts.definition,
        '#sent':opts.sentence,
    }

    for (const key of Object.keys(fields)) {
        $(key).empty();
    }
    let names = await odhback().opt_getModelFieldNames(modelName);
    if (names == null) return;
    for (const key of Object.keys(fields)) {
        names.forEach(name => $(key).append($('<option>', {value: name, text: name})));
        $(key).val(fields[key]);
    }
}

async function updateAnkiStatus() {
    $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnecting'));
    let version = await odhback().opt_getVersion();
    if (version === null) {
        $('#anki-options-params').hide();
        $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnectedFail'));
    } else {
        $('#anki-options-params').show();
        $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnectedSuccess',[version]));
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', {value: name,text: name})));
}

function onAnkiTypeChanged(e){
    if (e.originalEvent)
        populateAnkiFields();
}

async function onOKClicked(e) {
    if (!e.originalEvent) {
        return;
    }

    let optionsOld = await optionsLoad();
    let options = $.extend(true, {}, optionsOld);

    options.enabled = $('#enabled').prop('checked');
    options.hotkey = $('#hotkey').val();
    options.maxcontext = $('#maxcontext').val();
    options.maxexample = $('#maxexample').val();
    options.deckname = $('#deck').val();
    options.typename = $('#type').val();
    options.expression = $('#word').val();
    options.reading = $('#read').val();
    options.extrainfo = $('#extr').val();
    options.definition = $('#defs').val();
    options.sentence = $('#sent').val();

    options.dictLibrary = $('#repo').val();
    options.dictSelected = $('#dict').val();

    let newOptions = await odhback().opt_optionsChanged(options);
    populateDictionary(newOptions.dictNamelist);
    $('#dict').val(newOptions.dictSelected);
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
    let opts = await optionsLoad();
    $('#enabled').prop('checked',opts.enabled);
    $('#hotkey').val(opts.hotkey);
    $('#maxcontext').val(opts.maxcontext);
    $('#maxexample').val(opts.maxexample);
    $('#deck').val(opts.deckname);
    $('#type').val(opts.typename);
    $('#word').val(opts.expression);
    $('#read').val(opts.reading);
    $('#extr').val(opts.extrainfo);
    $('#defs').val(opts.definition);
    $('#sent').val(opts.sentence);


    $('#repo').val(opts.dictLibrary);
    populateDictionary(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#ok').click(onOKClicked);
    $('#cancel').click(onCancelClicked);
    $('#load').click(onLoadClicked);
    $('#type').change(onAnkiTypeChanged);
    
    $('#anki-options-params').hide();
    updateAnkiStatus();
    populateAnkiDeckAndModel(opts);
    populateAnkiFields();
}

$(document).ready(utilAsync(onReady));
