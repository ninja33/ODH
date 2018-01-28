function sanitizeOptions(options) {
    const defaults = {
        enabled: false,

        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        definitions: 'Back',
        sentence: 'Back',

        dictLibrary: 'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/collins.js',

        dictSelected: 'encn-Default',
        dictNamelist: ['encn-Default','enen-Collins'],
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

function updateSelectOption(dicts) {
    $('#dict').empty();
    dicts.forEach(name => {
        $('#dict').append($('<option>', {
            value: name,
            text: name
        }));
    });
}

async function onOKClicked(e) {
    if (!e.originalEvent) {
        return;
    }

    let optionsOld = await optionsLoad();
    let options = $.extend(true, {}, optionsOld);

    options.enabled = $('#enabled').prop('checked');
    options.deckname = $('#deck').val();
    options.typename = $('#type').val();
    options.expression = $('#word').val();
    options.definitions = $('#defs').val();
    options.sentence = $('#sent').val();

    options.dictLibrary = $('#repo').val();
    options.dictSelected = $('#dict').val();

    chrome.runtime.sendMessage({action:'updateOptions', params:{options}}, ({dictnames,selected}) => {
        options.dictNamelist = dictnames;
        options.dictSelected = selected;
        updateSelectOption(options.dictNamelist);
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
    let opts = await optionsLoad();
    $('#enabled').prop('checked',opts.enabled);
    $('#deck').val(opts.deckname);
    $('#type').val(opts.typename);
    $('#word').val(opts.expression);
    $('#defs').val(opts.definitions);
    $('#sent').val(opts.sentence);

    $('#repo').val(opts.dictLibrary);
    updateSelectOption(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#ok').click(onOKClicked);
    $('#cancel').click(onCancelClicked);
    $('#load').click(onLoadClicked);
}

$(document).ready(utilAsync(onReady));

function utilAsync(func) {
    return function(...args) {
        func.apply(this, args);
    };
}