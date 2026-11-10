const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Native DOM double for the popup page. The popup was rewritten to native DOM in M16, so the
// jQuery-style double below no longer reaches it; these doubles model just enough of the
// element surface the page touches (value/checked/textContent/hidden + listeners).
//
// `options` lets a test model a real <select>: replaceChildren() clears them and selectedIndex
// follows the value, so the read/write pairing the page relies on is actually exercised.
function nativeElement(id, overrides = {}) {
    const el = {
        id, value: '', checked: false, textContent: '', hidden: false,
        listeners: {}, options: [],
        addEventListener(type, handler) {
            (this.listeners[type] ||= []).push(handler);
        },
        replaceChildren() {
            this.options = [];
            this.selectedIndex = -1;
            this.value = '';
        },
        append(child) { this.options.push(child); },
    };
    Object.defineProperty(el, 'selectedIndex', {
        get() { return this.options.findIndex(option => option.value === this.value); },
        set(index) {
            if (index < 0) { this.value = ''; return; }
            this.value = this.options[index] ? this.options[index].value : '';
        },
        configurable: true
    });
    return Object.assign(el, overrides);
}

function popupDocument(store) {
    const elements = new Map();
    const panels = [];
    function element(id) {
        if (!elements.has(id)) elements.set(id, nativeElement(id, store && store[id]));
        return elements.get(id);
    }
    return {
        getElementById: element,
        querySelectorAll(selector) {
            if (selector === '.service-options') return panels;
            return [];
        },
        // The page registers onReady through DOMContentLoaded. Tests either drive onReady
        // directly or fire this listener; the latter covers the real initialisation entry.
        listeners: {},
        addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    };
}

function settingsPage(page, save, read = async () => ({
    dictNamelist: [], dictSelected: 'legacy_dictionary', services: 'none', legacyField: 'keep',
    id: 'synthetic-legacy-account', password: 'synthetic-legacy-value'
})) {
    const elements = new Map();
    const requests = [];
    let closeCount = 0;
    // Small event-boundary doubles; these assertions do not validate DOM rendering.
    function $(selector) {
        if (selector === document) return { ready() {} };
        if (!elements.has(selector)) {
            elements.set(selector, {
                value: null, checked: false, visible: false, content: '',
                val(value) {
                    if (arguments.length === 0) return this.value;
                    this.value = value;
                    return this;
                },
                prop(name, value) {
                    assert.equal(name, 'checked');
                    if (arguments.length === 1) return this.checked;
                    this.checked = value;
                    return this;
                },
                text(value) { this.content = value; return this; },
                show() { this.visible = true; return this; },
                hide() {
                    this.visible = false;
                    if (selector === '.gif') {
                        for (const key of ['#gif-load', '#gif-good', '#gif-fail']) {
                            if (elements.has(key)) elements.get(key).visible = false;
                        }
                    }
                    return this;
                },
                empty() { return this; },
                append() { return this; }
            });
        }
        return elements.get(selector);
    }
    $.extend = (deep, target, source) => Object.assign(target, structuredClone(source));
    // The popup now runs on native DOM; the options page still runs on jQuery until M17.
    const document = page === 'popup' ? popupDocument() : {};
    const handlers = loadClassic(`src/bg/js/${page}.js`,
        page === 'options' ? '({ onSaveClicked, onServicesChanged })' : '({ onOptionChanged, onReady })', {
            $, document,
            window: { close() { closeCount++; } },
            chrome: { i18n: { getMessage(key) { return key; } } },
            OptionsAPI: class {
                async optionsChanged(options) {
                    requests.push(structuredClone(options));
                    return await save(options);
                }
            },
            optionsLoad: read,
            optionsSave() { assert.fail('Pages must not write the worker response back to storage'); },
            localizeHtmlPage() {},
            utilAsync(fn) { return fn; }
        });
    // Fires the DOMContentLoaded listeners the page registered, then lets the async onReady
    // chain settle. Only meaningful for the popup, which moved to native DOM in M16.
    async function fireDomContentLoaded() {
        for (const handler of document.listeners?.DOMContentLoaded || [])
            await handler();
    }
    return { $, requests, handlers, closeCount: () => closeCount, document, fireDomContentLoaded };
}

const saveAndClose = { originalEvent: {}, target: { id: 'saveclose' } };

test('save and close waits for acknowledgement before showing success or closing', async () => {
    let acknowledge;
    const result = { dictNamelist: [], dictSelected: 'legacy_dictionary' };
    const fixture = settingsPage('options', () => new Promise(resolve => { acknowledge = resolve; }));
    const saving = fixture.handlers.onSaveClicked(saveAndClose);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.closeCount(), 0);
    assert.equal(fixture.$('#gif-load').visible, true);
    assert.equal(fixture.$('#gif-good').visible, false);
    acknowledge(result);
    await saving;
    assert.equal(fixture.closeCount(), 1);
    assert.equal(fixture.$('#gif-load').visible, false);
    assert.equal(fixture.$('#gif-good').visible, true);
});

for (const [name, save] of [
    ['failed acknowledgement', async () => null],
    ['rejected request', async () => { throw new Error('synthetic request failure'); }]
]) {
    test(`save and close stays open and shows failure after ${name}`, async () => {
        const fixture = settingsPage('options', save);
        await fixture.handlers.onSaveClicked(saveAndClose);
        assert.equal(fixture.closeCount(), 0);
        assert.equal(fixture.$('#gif-good').visible, false);
        assert.equal(fixture.$('#gif-fail').visible, true);
        assert.equal(fixture.$('#gif-load').visible, false);
    });
}

test('a failed settings read does not send a replacement configuration', async () => {
    const fixture = settingsPage('options', async () => assert.fail('Save should not run'),
        async () => { throw new Error('synthetic read failure'); });
    await fixture.handlers.onSaveClicked(saveAndClose);
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.closeCount(), 0);
    assert.equal(fixture.$('#gif-good').visible, false);
    assert.equal(fixture.$('#gif-fail').visible, true);
});

test('save and load stays open after acknowledgement and retains legacy fields', async () => {
    const fixture = settingsPage('options', async () => ({ dictNamelist: [], dictSelected: 'selected_dictionary' }));
    fixture.$('#hotkey').val('17');
    await fixture.handlers.onSaveClicked({ originalEvent: {}, target: { id: 'saveload' } });
    assert.equal(fixture.closeCount(), 0);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].hotkey, '17');
    assert.equal(fixture.requests[0].legacyField, 'keep');
    assert.equal(fixture.requests[0].id, 'synthetic-legacy-account');
    assert.equal(fixture.requests[0].password, 'synthetic-legacy-value');
    assert.equal(fixture.$('#dict').value, 'selected_dictionary');
    assert.equal(fixture.$('#gif-good').visible, true);
});

test('service changes show a save failure instead of consuming a null response', async () => {
    const fixture = settingsPage('options', async () => null);
    await fixture.handlers.onServicesChanged({ originalEvent: {} });
    assert.equal(fixture.$('#services-status').content, 'msgSaveFailed');
    assert.equal(fixture.requests[0].id, 'synthetic-legacy-account');
    assert.equal(fixture.requests[0].password, 'synthetic-legacy-value');
});

test('popup sends one request and does not repeat the storage write after success', async () => {
    const fixture = settingsPage('popup', async options => options);
    fixture.document.getElementById('tags').value = 'synthetic-tag';
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].tags, 'synthetic-tag');
    assert.equal(fixture.requests[0].legacyField, 'keep');
    assert.equal(fixture.document.getElementById('save-status').textContent, '');
});

for (const [name, save] of [
    ['failed acknowledgement', async () => null],
    ['rejected request', async () => { throw new Error('synthetic request failure'); }]
]) {
    test(`popup displays a save failure after ${name}`, async () => {
        const fixture = settingsPage('popup', save);
        await fixture.handlers.onOptionChanged({});
        assert.equal(fixture.requests.length, 1);
        assert.equal(fixture.document.getElementById('save-status').textContent, 'msgSaveFailed');
    });
}

test('popup does not send changes after a failed settings read', async () => {
    const fixture = settingsPage('popup', async () => assert.fail('Save should not run'),
        async () => { throw new Error('synthetic read failure'); });
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.document.getElementById('save-status').textContent, 'msgSaveFailed');
});

test('a successful popup save clears the previous failure message', async () => {
    let failed = true;
    const fixture = settingsPage('popup', async options => failed ? null : options);
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.document.getElementById('save-status').textContent, 'msgSaveFailed');
    failed = false;
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.document.getElementById('save-status').textContent, '');
});

// jQuery's .val() returned null for a select with no options; the native .value gives ''. The
// page writes those values straight back into the stored configuration, so a cleared deck list
// must not silently turn the stored deck name into an empty string.
test('a cleared deck select writes back null instead of an empty string', async () => {
    const fixture = settingsPage('popup', async options => options);
    const deck = fixture.document.getElementById('deckname');
    deck.replaceChildren();
    assert.equal(deck.selectedIndex, -1);
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].deckname, null);
});

// The page writes stored values back into selects during onReady. jQuery's .val(null) selected
// the empty option; a native assignment of null would leave the select unselected, so the write
// path normalises null to '' first. This fires the DOMContentLoaded listener the page registered,
// so the test covers the real initialisation entry rather than calling onReady directly.
test('onReady assigns a null stored value onto the empty option', async () => {
    const fixture = settingsPage('popup', async options => options,
        async () => ({
            dictNamelist: [], dictSelected: 'encn-Default', services: 'none',
            deckname: null, tags: 'T', enabled: true, mouseselection: true, hotkey: '16'
        }));
    const deck = fixture.document.getElementById('deckname');
    deck.replaceChildren();
    deck.append({ text: '', value: '' });
    deck.append({ text: 'Default', value: 'Default' });
    deck.value = 'Default';

    await fixture.fireDomContentLoaded();
    assert.equal(deck.value, '', 'null is written onto the empty option');
    assert.equal(deck.selectedIndex, 0, 'the empty option is selected, as jQuery .val(null) did');

    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests[0].deckname, '', 'reading it back yields an empty string, not null');
});
