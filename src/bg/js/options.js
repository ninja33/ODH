async function populateAnkiDeckAndModel(opts) {
    let names = [];
    $('#deckname').empty();
    names = await odhback().opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', {value: name, text: name})));
    }
    $('#deckname').val(opts.deckname);

    $('#typename').empty();
    names = await odhback().opt_getModelNames();
    if (names !== null) {
        names.forEach(name => $('#typename').append($('<option>', {value: name, text: name})));
        //populateAnkiFields($('#anki-vocab-model').val(opts.ankiVocabModel), opts);
    }
    $('#typename').val(opts.typename);
}

async function populateAnkiFields(){
    let opts = await optionsLoad();
    const modelName = $('#typename').val() || opts.typename;
    if (modelName === null) {
        return;
    }

    let fields ={
        '#expression':opts.expression,
        '#reading':opts.reading,
        '#extrainfo':opts.extrainfo,
        '#definition':opts.definition,
        '#sentence':opts.sentence,
        '#url':opts.url,
        '#audio':opts.audio,
    }

    for (const key of Object.keys(fields)) {
        $(key).empty();
    }
    let names = await odhback().opt_getModelFieldNames(modelName);
    if (names == null) return;
    for (const key of Object.keys(fields)) {
        $(key).append($('<option>', {value: '', text: ''}));
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

    options.deckname = $('#deckname').val();
    options.typename = $('#typename').val();
    options.expression = $('#expression').val();
    options.reading = $('#reading').val();
    options.extrainfo = $('#extrainfo').val();
    options.definition = $('#definition').val();
    options.sentence = $('#sentence').val();
    options.url = $('#url').val();
    options.audio = $('#audio').val();
    options.preferredaudio = $('#anki-preferred-audio').val();

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

    $('#deckname').val(opts.deckname);
    $('#typename').val(opts.typename);
    $('#expression').val(opts.expression);
    $('#reading').val(opts.reading);
    $('#extrainfo').val(opts.extrainfo);
    $('#definition').val(opts.definition);
    $('#sentence').val(opts.sentence);
    $('#url').val(opts.url);
    $('#audio').val(opts.audio);
    $('#anki-preferred-audio').val(opts.preferredaudio);


    $('#repo').val(opts.dictLibrary);
    populateDictionary(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#ok').click(onOKClicked);
    $('#cancel').click(onCancelClicked);
    $('#load').click(onLoadClicked);
    $('#typename').change(onAnkiTypeChanged);
    
    $('#anki-options-params').hide();
    updateAnkiStatus();
    populateAnkiDeckAndModel(opts);
    populateAnkiFields();
}

$(document).ready(utilAsync(onReady));
