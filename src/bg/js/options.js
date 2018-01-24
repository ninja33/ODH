function sanitizeOptions(options) {
    const defaults = {
        actived: true,
        deckname: 'Antimoon',
        typename: 'Antimoon',
        expression: 'expression',
        definitions: 'glossary',
        sentence: 'sentence',
        userdefined: false,
        currentdict:'encn-Youdao',
        repository: 'ninja33/anki-online-dict-helper',
        scriptpath: 'master/uddt/baicizhan.js',
    };

    for (let key in defaults) {
        if (!(key in options)) {
            options[key] = defaults[key];
        }
    }

    return options;
}

function optionsLoad(callback) {
    chrome.storage.sync.get(null, (options) => callback(sanitizeOptions(options)));
}

function optionsSave(options,callback) {
    chrome.storage.sync.set(sanitizeOptions(options), callback);
}

function formRead() {
}

function onOKClicked(e) {
    if (!e.originalEvent) {
        return;
    }

    optionsLoad((optionsOld)=>{
        const optionsNew = $.extend(true, {}, optionsOld);

        optionsNew.actived = $('#actived').prop('checked');
        optionsNew.deckname= $('#deck').val();
        optionsNew.typename= $('#type').val();
        optionsNew.expression= $('#word').val();
        optionsNew.definitions= $('#defs').val();
        optionsNew.sentence= $('#sent').val();
        optionsNew.userdefined=$('#udfd').prop('checked');
        optionsNew.currentdict=$('#dict').val();
        optionsNew.repository= $('#repo').val();
        optionsNew.scriptpath= $('#path').val();
    
        optionsSave(optionsNew,()=>{
            let backwin = chrome.extension.getBackgroundPage()
            backwin.abkl_backend.setOptions(optionsNew);
            window.close();
        });
    });
}

function onCancelClicked(e) {
    window.close();
}

function onReady() {
    optionsLoad((opts)=>{
        //$('#actived').prop('checked',opts.actived);
        $('#deck').val(opts.deckname);
        $('#type').val(opts.typename);
        $('#word').val(opts.expression);
        $('#defs').val(opts.definitions);
        $('#sent').val(opts.sentence);
        //$('#actived').prop('checked',opts.userdefined);
        $('#dict').val(opts.currentdict);
        $('#repo').val(opts.repository);
        $('#path').val(opts.scriptpath);

        $('#ok').click(onOKClicked);
        $('#cancel').click(onCancelClicked);
    });

}

$(document).ready(onReady);