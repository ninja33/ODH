function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(name => $('#dict').append($('<option>', {
        value: name,
        text: name
    })));
}

async function onOptionChanged(e) {
    if (!e.originalEvent) {
        return;
    }

    let options = await optionsLoad();

    options.enabled = $('#enabled').prop('checked');
    options.hotkey = $('#hotkey').val();
    options.dictSelected = $('#dict').val();
    let request = {
        action: 'updateOptions',
        params: {
            options
        }
    };
    odhback().opt_optionsChanged(options);
}

function onMoreOptions() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
}

async function onReady() {
    localizeHtmlPage();
    let opts = await optionsLoad();
    $('#enabled').prop('checked', opts.enabled);
    $('#hotkey').val(opts.hotkey);
    populateDictionary(opts.dictNamelist);
    $('#dict').val(opts.dictSelected);

    $('#enabled').change(onOptionChanged);
    $('#hotkey').change(onOptionChanged);
    $('#dict').change(onOptionChanged);
    $('#more').click(onMoreOptions);
}

$(document).ready(utilAsync(onReady));
