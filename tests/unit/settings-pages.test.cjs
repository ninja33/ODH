const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

function settingsPage(page, save, read = async () => ({
    dictNamelist: [], dictSelected: 'legacy_dictionary', services: 'none', legacyField: 'keep',
    id: 'synthetic-legacy-account', password: 'synthetic-legacy-value'
})) {
    const elements = new Map();
    const requests = [];
    let closeCount = 0;
    const document = {};
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
    const handlers = loadClassic(`src/bg/js/${page}.js`,
        page === 'options' ? '({ onSaveClicked, onServicesChanged })' : '({ onOptionChanged })', {
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
    return { $, requests, handlers, closeCount: () => closeCount };
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
    fixture.$('#tags').val('synthetic-tag');
    await fixture.handlers.onOptionChanged({ originalEvent: {} });
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].tags, 'synthetic-tag');
    assert.equal(fixture.requests[0].legacyField, 'keep');
    assert.equal(fixture.$('#save-status').content, '');
});

for (const [name, save] of [
    ['failed acknowledgement', async () => null],
    ['rejected request', async () => { throw new Error('synthetic request failure'); }]
]) {
    test(`popup displays a save failure after ${name}`, async () => {
        const fixture = settingsPage('popup', save);
        await fixture.handlers.onOptionChanged({ originalEvent: {} });
        assert.equal(fixture.requests.length, 1);
        assert.equal(fixture.$('#save-status').content, 'msgSaveFailed');
    });
}

test('popup does not send changes after a failed settings read', async () => {
    const fixture = settingsPage('popup', async () => assert.fail('Save should not run'),
        async () => { throw new Error('synthetic read failure'); });
    await fixture.handlers.onOptionChanged({ originalEvent: {} });
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.$('#save-status').content, 'msgSaveFailed');
});

test('a successful popup save clears the previous failure message', async () => {
    let failed = true;
    const fixture = settingsPage('popup', async options => failed ? null : options);
    await fixture.handlers.onOptionChanged({ originalEvent: {} });
    assert.equal(fixture.$('#save-status').content, 'msgSaveFailed');
    failed = false;
    await fixture.handlers.onOptionChanged({ originalEvent: {} });
    assert.equal(fixture.$('#save-status').content, '');
});
