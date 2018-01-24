function sanitizeOptions(options) {
    const defaults = {
        actived: true,
        deckname: 'Antimoon',
        typename: 'Antimoon',
        expression: 'expression',
        definitions: 'glossary',
        sentence: 'sentence',
        currentdict: 'encn-Default',
        repository: 'https://rawgit.com/ninja33/anki-online-dict-helper/master/uddt/list.js',
    };

    const combine = (target, source) => {
        for (const key in source) {
            if (!target.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    };

    combine(options, defaults);
    combine(options.dictionaries, defaults.dictionaries);

    return options;
}

function optionsLoad(callback) {
    chrome.storage.sync.get(null, (options) => {
        callback(sanitizeOptions(options));
    });
}

function optionsSave(options, callback) {
    chrome.storage.sync.set(sanitizeOptions(options), callback);
}

function dictionaryLoad() {
    let repository = $('#repo').val();
    $('#dict').append($('<option>', {
        value: key,
        text: key
    }));
}

function onLoadClicked(e) {
    if (!e.originalEvent) {
        return;
    }

}

function onOKClicked(e) {
    if (!e.originalEvent) {
        return;
    }

    optionsLoad((optionsOld) => {
        const optionsNew = $.extend(true, {}, optionsOld);

        //optionsNew.actived = $('#actived').prop('checked');
        optionsNew.deckname = $('#deck').val();
        optionsNew.typename = $('#type').val();
        optionsNew.expression = $('#word').val();
        optionsNew.definitions = $('#defs').val();
        optionsNew.sentence = $('#sent').val();

        optionsNew.repository = $('#repo').val();
        optionsNew.currentdict = $('#dict').val();

        optionsSave(optionsNew, () => {
            //BackEnd().setOptions(optionsNew);
            window.close();
        });
    });
}

function onCancelClicked(e) {
    window.close();
}

function onReady() {
    optionsLoad((opts) => {
        //$('#actived').prop('checked',opts.actived);
        $('#deck').val(opts.deckname);
        $('#type').val(opts.typename);
        $('#word').val(opts.expression);
        $('#defs').val(opts.definitions);
        $('#sent').val(opts.sentence);

        $('#repo').val(opts.repository);
        $('#dict').val(opts.currentdict);

        $('#ok').click(onOKClicked);
        $('#cancel').click(onCancelClicked);
    });

}

function RegisterDictList(list) {
    BackEnd().dictionary.setDictList(list);
}

function RegisterDict(name, dict) {
    BackEnd().dictionary.addDictionaries(name, dict);
}

function BackEnd() {
    return chrome.extension.getBackgroundPage().abkl_backend;
}

$(document).ready(onReady);