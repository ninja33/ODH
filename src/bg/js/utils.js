function sanitizeOptions(options) {
    let defaultscripts = [
        { type: "sys", active: true, remote: false, name: "builtin_encn_Collins", description: "柯林斯词典" },
        { type: "sys", active: false, remote: true, name: "builtin_encn_Oxford", description: "柯林斯词典" },
        { type: "sys", active: true, remote: false, name: "encn_Collins", description: "柯林斯词典" },
        { type: "sys", active: true, remote: false, name: "encn_Oxford", description: "牛津在线" }
    ];

    const defaults = {
        enabled: false,
        hotkey: '0', // 0:off , 16:shift, 17:ctrl, 18:alt
        maxcontext: '1',
        maxexample: '2',
        monolingual: '0', //0: bilingual 1:monolingual
        preferredaudio: '0',
        services: 'none',
        id: '',
        password: '',

        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        reading: '',
        extrainfo: '',
        definition: 'Back',
        definitions: '',
        sentence: '',
        url: '',
        audio: '',

        sysscripts: defaultscripts,
        udfscripts: '',
        
        dictLibrary: 'builtin_encn_Collins, builtin_encn_Oxford, encn_Collins, encn_Oxford, encn_Baicizhan, cncn_Zdic, frcn_Eudict, escn_Eudict, rucn_Qianyi',
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
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (options) => {
            resolve(sanitizeOptions(options));
        });
    });
}

async function optionsSave(options) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(sanitizeOptions(options), resolve());
    });
}

function utilAsync(func) {
    return function (...args) {
        func.apply(this, args);
    };
}

function odhback() {
    return chrome.extension.getBackgroundPage().odhback;
}

function localizeHtmlPage() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}