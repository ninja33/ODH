
function sanitizeOptions(options) {
    const defaults = {
        enabled: false,
        hotkey: '0', // 0:off , 16:shift, 17:ctrl, 18:alt
        maxcontext: '1',
        maxexample: '2',

        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        reading: '',
        extrainfo: '',
        definition: 'Back',
        sentence: 'Back',


        dictLibrary: 'encn_List',

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
