async function populateAnkiDeckAndModel(opts) {
    let names = [];
    $('#deckname').empty();
    names = await odhback().opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', {
            value: name,
            text: name
        })));
    }
    $('#deckname').val(opts.deckname);

    $('#typename').empty();
    names = await odhback().opt_getModelNames();
    if (names !== null) {
        names.forEach(name => $('#typename').append($('<option>', {
            value: name,
            text: name
        })));
        //populateAnkiFields($('#anki-vocab-model').val(opts.ankiVocabModel), opts);
    }
    $('#typename').val(opts.typename);
}

async function populateAnkiFields() {
    let options = await optionsLoad();
    const modelName = $('#typename').val() || options.typename;
    if (modelName === null) {
        return;
    }

    let names = await odhback().opt_getModelFieldNames(modelName);
    if (names == null) return;

    let fields = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio']
    fields.forEach(field => {
        $(`#${field}`).empty();
        $(`#${field}`).append($('<option>', {
            value: '',
            text: ''
        }));
        names.forEach(name => $(`#${field}`).append($('<option>', {
            value: name,
            text: name
        })));
        $(`#${field}`).val(options[field]);
    });
}

async function updateAnkiStatus() {
    $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnecting'));
    let version = await odhback().opt_getVersion();
    if (version === null) {
        $('#anki-options-params').hide();
        $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnectedFail'));
    } else {
        $('#anki-options-params').show();
        $('#anki-options-status').text(chrome.i18n.getMessage('optAnkiConnectedSuccess', [version]));
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', {
        value: name,
        text: name
    })));
}

function onAnkiTypeChanged(e) {
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

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio']
    fields.forEach(field => {
        options[field] = $(`#${field}`).val() == null ? options[field] : $(`#${field}`).val();
    });

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
    $('#enabled').prop('checked', opts.enabled);
    $('#hotkey').val(opts.hotkey);
    $('#maxcontext').val(opts.maxcontext);
    $('#maxexample').val(opts.maxexample);

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio']
    fields.forEach(field => {
        $(`#${field}`).val(opts[field]);
    });
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