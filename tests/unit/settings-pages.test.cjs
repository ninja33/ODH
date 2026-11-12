const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Models the element surface the pages touch. `options` makes selectedIndex follow the value,
// so an empty select and a select on its empty option stay distinguishable.
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
            this.children = [];
        },
        append(...children) {
            for (const child of children) {
                this.options.push(child);
                (this.children ||= []).push(child);
            }
        },
        querySelector(selector) {
            return (this.children || []).find(child => matches(child, selector)) || null;
        },
        // Web Animations double: the page awaits .finished to hide the gifs. It must NOT
        // resolve on its own, or the success icon would be hidden before the assertions run.
        animate() {
            if (!this.__animation) this.__animation = {};
            this.__animation.finished = new Promise(resolve => { this.__finish = resolve; });
            return this.__animation;
        },
        // Lets a test settle the animation manually instead of waiting.
        finishAnimation() { if (this.__finish) this.__finish(); },
        querySelectorAll(selector) {
            return (this.children || []).filter(child => matches(child, selector));
        },
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

// Minimal class-name matcher; the page only ever queries by a single class or a comma list.
function matches(el, selector) {
    const classes = (el.className || '').split(/\s+/).filter(Boolean);
    return selector.split(',').some(part => {
        const name = part.trim().replace(/^\./, '');
        return name && classes.includes(name);
    });
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

// The options page is driven by id. #id / #password deliberately do not exist here, matching
// options.html - the page has to keep the stored values in that case rather than throw.
function optionsDocument() {
    const ids = [
        'enabled', 'mouseselection', 'hotkey', 'dict', 'monolingual', 'anki-preferred-audio',
        'maxcontext', 'maxexample', 'services', 'ankiconnecturl', 'deckname', 'typename',
        'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url',
        'audio', 'tags', 'duplicate', 'udfscripts', 'sysscripts',
        'connect', 'saveload', 'saveclose', 'close', 'hidden', 'services-status',
        'service-options-ankiconnect', 'service-options-ankiprofile', 'duplicate-option',
        'scriptslistbody', 'gif-load', 'gif-good', 'gif-fail'
    ];
    const elements = new Map();
    for (const id of ids) elements.set(id, nativeElement(id));
    const gifs = ['gif-load', 'gif-good', 'gif-fail'].map(id => elements.get(id));
    const panels = ['service-options-ankiconnect', 'service-options-ankiprofile'].map(id => elements.get(id));
    return {
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll(selector) {
            if (selector === '.gif') return gifs;
            if (selector === '.service-options') return panels;
            return [];
        },
        createElement(tag) {
            const el = nativeElement(null);
            el.tagName = tag.toUpperCase();
            return el;
        },
        listeners: {},
        addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    };
}

function settingsPage(page, save, read = async () => ({
    dictNamelist: [], dictSelected: 'legacy_dictionary', services: 'none', legacyField: 'keep',
    id: 'synthetic-legacy-account', password: 'synthetic-legacy-value'
})) {
    const requests = [];
    let closeCount = 0;
    const document = page === 'popup' ? popupDocument() : optionsDocument();
    const handlers = loadClassic(`src/bg/js/${page}.js`,
        page === 'options' ? '({ onSaveClicked, onServicesChanged, onReady })' : '({ onOptionChanged, onReady })', {
            document,
            window: { close() { closeCount++; } },
            chrome: { i18n: { getMessage(key) { return key; } } },
            OptionsAPI: class {
                async optionsChanged(options) {
                    requests.push(structuredClone(options));
                    return await save(options);
                }
            },
            loadOptions: read,
            saveOptions() { assert.fail('Pages must not write the worker response back to storage'); },
            localizeHtmlPage() {},
            // The VM realm has no host globals; a browser provides both of these.
            structuredClone,
            Option: class Option {
                constructor(text, value) { this.text = text; this.value = value; }
            }
        });
    // Fires the DOMContentLoaded listeners the page registered, then lets the async onReady
    // chain settle. Only meaningful for the popup, which moved to native DOM in M16.
    async function fireDomContentLoaded() {
        for (const handler of document.listeners?.DOMContentLoaded || [])
            await handler();
    }
    return { requests, handlers, closeCount: () => closeCount, document, fireDomContentLoaded };
}

// A live object so a test can clear currentTarget the way the browser does after dispatch.
function clickEvent(id) {
    return { currentTarget: { id } };
}
const saveAndClose = () => clickEvent('saveclose');
const saveAndLoad = () => clickEvent('saveload');

const gifState = fixture => ({
    load: !fixture.document.getElementById('gif-load').hidden,
    good: !fixture.document.getElementById('gif-good').hidden,
    fail: !fixture.document.getElementById('gif-fail').hidden
});

test('save and close waits for acknowledgement before showing success or closing', async () => {
    let acknowledge;
    const result = { dictNamelist: [], dictSelected: 'legacy_dictionary' };
    const fixture = settingsPage('options', () => new Promise(resolve => { acknowledge = resolve; }));
    const saving = fixture.handlers.onSaveClicked(saveAndClose());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.closeCount(), 0);
    assert.deepEqual(gifState(fixture), { load: true, good: false, fail: false });
    acknowledge(result);
    await saving;
    assert.equal(fixture.closeCount(), 1);
    // The success icon stays up until the animation is settled.
    assert.deepEqual(gifState(fixture), { load: false, good: true, fail: false });
    fixture.document.getElementById('gif-good').finishAnimation();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(gifState(fixture), { load: false, good: false, fail: false }, 'all icons hide when the fade ends');
});

// Clears currentTarget right after the call, as the browser does once dispatch ends.
test('save and close survives currentTarget being cleared before the awaited save resolves', async () => {
    let acknowledge;
    const fixture = settingsPage('options', () => new Promise(resolve => { acknowledge = resolve; }));
    const event = saveAndClose();
    const saving = fixture.handlers.onSaveClicked(event);
    event.currentTarget = null;              // dispatch is over; the browser clears this
    await new Promise(resolve => setImmediate(resolve));
    acknowledge({ dictNamelist: [], dictSelected: 'legacy_dictionary' });
    await saving;
    assert.equal(fixture.closeCount(), 1, 'the button id was captured before the await');
});

for (const [name, save] of [
    ['failed acknowledgement', async () => null],
    ['rejected request', async () => { throw new Error('synthetic request failure'); }]
]) {
    test(`save and close stays open and shows failure after ${name}`, async () => {
        const fixture = settingsPage('options', save);
        await fixture.handlers.onSaveClicked(saveAndClose());
        assert.equal(fixture.closeCount(), 0);
        assert.deepEqual(gifState(fixture), { load: false, good: false, fail: true });
    });
}

test('a failed settings read does not send a replacement configuration', async () => {
    const fixture = settingsPage('options', async () => assert.fail('Save should not run'),
        async () => { throw new Error('synthetic read failure'); });
    await fixture.handlers.onSaveClicked(saveAndClose());
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.closeCount(), 0);
    assert.deepEqual(gifState(fixture), { load: false, good: false, fail: true });
});

// options.html has no #id / #password inputs, so the stored values must survive a save.
test('save and load stays open after acknowledgement and retains legacy fields', async () => {
    const fixture = settingsPage('options', async () => ({ dictNamelist: [], dictSelected: 'selected_dictionary' }));
    // Give the select real options the way the page would; readSelectValue reads selectedIndex.
    const hotkey = fixture.document.getElementById('hotkey');
    hotkey.append({ value: '0', text: 'Off' });
    hotkey.append({ value: '16', text: 'Shift' });
    hotkey.append({ value: '17', text: 'Ctrl' });
    hotkey.value = '17';
    await fixture.handlers.onSaveClicked(saveAndLoad());
    assert.equal(fixture.closeCount(), 0);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].hotkey, '17');
    assert.equal(fixture.requests[0].legacyField, 'keep');
    assert.equal(fixture.requests[0].id, 'synthetic-legacy-account', 'absent #id input keeps the stored value');
    assert.equal(fixture.requests[0].password, 'synthetic-legacy-value', 'absent #password input keeps the stored value');
    assert.equal(fixture.document.getElementById('dict').value, 'selected_dictionary');
    assert.deepEqual(gifState(fixture), { load: false, good: true, fail: false });
});

test('service changes show a save failure instead of consuming a null response', async () => {
    const fixture = settingsPage('options', async () => null);
    await fixture.handlers.onServicesChanged();
    assert.equal(fixture.document.getElementById('services-status').textContent, 'msgSaveFailed');
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

// A cleared deck list must not turn the stored deck name into an empty string.
test('a cleared deck select writes back null instead of an empty string', async () => {
    const fixture = settingsPage('popup', async options => options);
    const deck = fixture.document.getElementById('deckname');
    deck.replaceChildren();
    assert.equal(deck.selectedIndex, -1);
    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].deckname, null);
});

// Fires the DOMContentLoaded listener the page registered, so this covers the real entry point.
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
    assert.equal(deck.selectedIndex, 0, 'the empty option is selected');

    await fixture.handlers.onOptionChanged({});
    assert.equal(fixture.requests[0].deckname, '', 'reading it back yields an empty string, not null');
});
