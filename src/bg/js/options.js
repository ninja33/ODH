/* global odhback, localizeHtmlPage, utilAsync, optionsLoad, optionsSave */

async function populateAnkiDeckAndModel(options) {
    let names = [];
    $('#deckname').empty();
    names = await options_api.getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', { value: name, text: name })));
    }

    let deckName = options.deckname ? options.deckname : names[0]; 
    $('#deckname').val(deckName);

    $('#typename').empty();
    names = await options_api.getModelNames();
    if (names !== null) {
        names.forEach(name => $('#typename').append($('<option>', { value: name, text: name })));
    }
    
    let typeName = options.typename ? options.typename: names[0];
    $('#typename').val(typeName);
}

async function populateAnkiFields(options) {
    const modelName = $('#typename').val() || options.typename;
    if (modelName === null) return;

    let names = await options_api.getModelFieldNames(modelName);
    if (names == null) return;

    let fields = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).empty();
        $(`#${field}`).append($('<option>', { value: '', text: '' }));
        names.forEach(name => $(`#${field}`).append($('<option>', { value: name, text: name })));
        $(`#${field}`).val(options[field]);
    });
}

async function updateServiceStatus(options) {
    $('.service-options').hide();
    $('#services-status').text(chrome.i18n.getMessage('msgFailed'));
    switch (options.services) {
        case 'none':
            break;
        case 'ankiconnect':
            $('#service-options-ankiconnect').show();
            updateAnkiProfile(options) 
            break;
        case 'ankiweb':
            $('#service-options-ankiweb').show();
            updateAnkiProfile(options) 
            break;
        default:
            break;
    }
}

async function updateAnkiProfile(options) {
    $('#service-options-ankiprofile').hide();
    $('#services-status').text(chrome.i18n.getMessage('msgConnecting'));
    
    let version = await options_api.getVersion();
    if (version === null) {
        $('#services-status').text(chrome.i18n.getMessage('msgFailed'));
    } else {
        populateAnkiDeckAndModel(options);
        populateAnkiFields(options);
        $('#services-status').text(chrome.i18n.getMessage('msgSuccess', [version]));
        $('#service-options-ankiprofile').show();
        if (options.services == 'ankiconnect')
            $('#duplicate-option').show();
        else {
            $('#duplicate-option').hide();
        }
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(item => $('#dict').append($('<option>', { value: item.objectname, text: item.displayname })));
}

function populateSysScriptsList(dictLibrary) {
    const optionscripts = Array.from(new Set(dictLibrary.split(',').filter(x => x).map(x => x.trim())));
    let systemscripts = [
        'builtin_encn_Collins', 'general_Makenotes',//default & builtin script
        'cncn_Zdic', //cn-cn dictionary
        'enes_Cambridge',
        'encn_Collins', 'encn_Cambridge', 'encn_Cambridge_tc', 'encn_Oxford', 'encn_Youdao', 'encn_Baicizhan', //en-cn dictionaries
        'enen_Collins', 'enen_LDOCE6MDX', 'enen_UrbanDict', //en-en dictionaries
        'enfr_Cambridge', 'enfr_Collins', //en-fr dictionaries
        'fren_Cambridge', 'fren_Collins', //fr-cn dictionaries
        'esen_Spanishdict', 'decn_Eudict', 'escn_Eudict', 'frcn_Eudict', 'frcn_Youdao', 'rucn_Qianyi' //msci dictionaries
    ];
    $('#scriptslistbody').empty();
    systemscripts.forEach(script => {
        let row = '';
        row += `<input class="sl-col sl-col-onoff" type="checkbox" ${optionscripts.includes(script) || optionscripts.includes('lib://'+script)?'checked':''}>`;
        row += `<input class="sl-col sl-col-cloud" type="checkbox" ${optionscripts.includes('lib://'+script)?'checked':''}>`;
        row += `<span class="sl-col sl-col-name">${script}</span>`;
        row += `<span class="sl-col sl-col-description">${chrome.i18n.getMessage(script)}</span>`;
        $('#scriptslistbody').append($(`<div class="sl-row">${row}</div>`));
    });

    $('.sl-col-onoff', '.sl-row:nth-child(1)').prop('checked', true); // make default script(first row) always active.
    $('.sl-col-cloud', '.sl-row:nth-child(1)').prop('checked', false); // make default script(first row) as local script.
    $('.sl-col-cloud, .sl-col-onoff', '.sl-row:nth-child(1)').css({ 'visibility': 'hidden' }); //make default sys script untouch
}

function onScriptListChange() {
    let dictLibrary = [];
    $('.sl-row').each(function() {
        if ($('.sl-col-onoff', this).prop('checked') == true)
            dictLibrary.push($('.sl-col-cloud', this).prop('checked') ? 'lib://' + $('.sl-col-name', this).text() : $('.sl-col-name', this).text());
    });
    $('#sysscripts').val(dictLibrary.join());
}

function onHiddenClicked() {
    $('.sl-col-cloud').toggleClass('hidden');
}

async function onAnkiTypeChanged(e) {
    if (e.originalEvent) {
        let options = await optionsLoad();
        populateAnkiFields(options);

    }
}

async function onServicesChanged(e) {
    if (e.originalEvent) {
        let options = await optionsLoad();

        options.services = $('#services').val();
        options.id = $('#id').val();
        options.password = $('#password').val();
        options.ankiconnecturl = $('#ankiconnecturl').val();

        let newOptions = await options_api.optionsChanged(options);
        updateServiceStatus(newOptions);
    }
}

async function onSaveClicked(e) {
    if (!e.originalEvent) return;

    let optionsOld = await optionsLoad();
    let options = $.extend(true, {}, optionsOld);

    options.enabled = $('#enabled').prop('checked');
    options.mouseselection = $('#mouseselection').prop('checked');
    options.hotkey = $('#hotkey').val();

    options.dictSelected = $('#dict').val();
    options.monolingual = $('#monolingual').val();
    options.preferredaudio = $('#anki-preferred-audio').val();
    options.maxcontext = $('#maxcontext').val();
    options.maxexample = $('#maxexample').val();

    options.services = $('#services').val();
    options.id = $('#id').val();
    options.password = $('#password').val();
    
    options.ankiconnecturl = $('#ankiconnecturl').val();
    options.tags = $('#tags').val();
    options.duplicate = $('#duplicate').val();

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        options[field] = $(`#${field}`).val() == null ? options[field] : $(`#${field}`).val();
    });

    options.sysscripts = $('#sysscripts').val();
    options.udfscripts = $('#udfscripts').val();

    $('#gif-load').show();
    let newOptions = await options_api.optionsChanged(options);
    $('.gif').hide();
    $('#gif-good').show(1000, () => { $('.gif').hide(); });

    populateDictionary(newOptions.dictNamelist);
    $('#dict').val(newOptions.dictSelected);

    if (e.target.id == 'saveclose')
        window.close();
}

function onCloseClicked(e) {
    window.close();
}

async function onReady() {
    localizeHtmlPage();
    let options = await optionsLoad();
    $('#enabled').prop('checked', options.enabled);
    $('#mouseselection').prop('checked', options.mouseselection);
    $('#hotkey').val(options.hotkey);

    populateDictionary(options.dictNamelist);
    $('#dict').val(options.dictSelected);

    $('#monolingual').val(options.monolingual);
    $('#anki-preferred-audio').val(options.preferredaudio);
    $('#maxcontext').val(options.maxcontext);
    $('#maxexample').val(options.maxexample);

    $('#services').val(options.services);
    $('#id').val(options.id);
    $('#password').val(options.password);

    $('#ankiconnecturl').val(options.ankiconnecturl);
    $('#tags').val(options.tags);
    $('#duplicate').val(options.duplicate);

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).val(options[field]);
    });

    $('#sysscripts').val(options.sysscripts);
    $('#udfscripts').val(options.udfscripts);
    populateSysScriptsList(options.sysscripts);
    onHiddenClicked();

    $('#connect').click(onServicesChanged);
    $('#login').click(onServicesChanged);
    $('#saveload').click(onSaveClicked);
    $('#saveclose').click(onSaveClicked);
    $('#close').click(onCloseClicked);
    $('.gif').hide();

    $('.sl-col-onoff, .sl-col-cloud').click(onScriptListChange);
    $('#hidden').click(onHiddenClicked);
    $('#typename').change(onAnkiTypeChanged);
    $('#services').change(onServicesChanged);

    updateServiceStatus(options);
}

$(document).ready(utilAsync(onReady));
options_api = new OptionsAPI();