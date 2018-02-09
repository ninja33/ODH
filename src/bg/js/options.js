function odhback(){
    return chrome.extension.getBackgroundPage().aodhback
}

function localizeHtmlPage(){
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}

async function populateAnkiDeckAndModel(opts) {
    let names = [];
    $('#deck').empty();
    names = await odhback().api_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deck').append($('<option>', {value: name, text: name})));
    }
    $('#deck').val(opts.deckname);

    $('#type').empty();
    names = await odhback().api_getModelNames();
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
    
    $('#word').empty();
    $('#defs').empty();
    $('#sent').empty();
    let names = await odhback().api_getModelFieldNames(modelName);
    if (names !== null) {
        names.forEach(name => $('#word').append($('<option>', {value: name, text: name})));
        names.forEach(name => $('#defs').append($('<option>', {value: name, text: name})));
        names.forEach(name => $('#sent').append($('<option>', {value: name, text: name})));
    }
    $('#word').val(opts.expression);
    $('#defs').val(opts.definition);
    $('#sent').val(opts.sentence);
}

async function updateAnkiStatus() {
    $('#anki-options-status').text('Connecting to Anki ...');
    let version = await odhback().api_getVersion();
    if (version === null) {
        $('#anki-options-params').hide();
        $('#anki-options-status').text('Status: Ankiconnect was not actived!');
    } else {
        $('#anki-options-params').show();
        $('#anki-options-status').text(`Status: Ankiconnect (version ${version}) was actived.`);
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
    options.definition = $('#defs').val();
    options.sentence = $('#sent').val();

    options.dictLibrary = $('#repo').val();
    options.dictSelected = $('#dict').val();

    chrome.runtime.sendMessage({action:'updateOptions', params:{options}}, (newOptions) => {
        populateDictionary(newOptions.dictNamelist);
        $('#dict').val(newOptions.dictSelected);
        optionsSave(newOptions);
        if (e.target.id == 'ok')
            window.close();
    });
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

function utilAsync(func) {
    return function(...args) {
        func.apply(this, args);
    };
}