function odhback(){
    return chrome.extension.getBackgroundPage().aodhback
}

function localizeHtmlPage(){
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}

function sanitizeOptions(options) {
    const defaults = {
        enabled: false,
        hotkey: '0', // 0:off , 16:shift, 17:ctrl, 18:alt
        maxcontext: '1',
        maxexample: '2',

        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        definition: 'Back',
        sentence: 'Back',

        dictLibrary: '',

        dictSelected: '',
        dictNamelist: [],
    };

    for (const key in defaults) {
        if (!options.hasOwnProperty(key)) {
            options[key] = defaults[key];
        }
    }
    return options;
}


async function optionsLoad() {
    return new Promise((resolve, reject)=>{
        chrome.storage.local.get(null, (options) => {
            resolve(sanitizeOptions(options));
        });
    });
}

async function optionsSave(options) {
    return new Promise((resolve, reject)=>{
        chrome.storage.local.set(sanitizeOptions(options), resolve());
    });
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
    $('#ankistatus').text('Connecting to Anki ...');
    try{
        let version = await odhback().api_getVersion();
        if (version === null) {
            $('#ankistatus').text('Status: Ankiconnect was not actived!');
        } else {
            $('#ankistatus').text(`Status: Ankiconnect (version ${version}) was actived.`);
        }
    } catch (err) {
        $('#ankistatus').text('Status: Ankiconnect was not actived!');
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

    chrome.runtime.sendMessage({action:'updateOptions', params:{options}}, ({dictnames,selected}) => {
        options.dictNamelist = dictnames;
        options.dictSelected = selected;
        populateDictionary(options.dictNamelist);
        $('#dict').val(selected);
        optionsSave(options);
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