const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { loadClassic } = require('../helpers/load-classic.cjs');

// sanitize.js runs in the content script, so its contract is asserted against the real
// DOMPurify in a real DOM: doubles proved nothing here — the FORCE_BODY regression passed
// every stub assertion and broke every real browser.

function sanitizeRealm() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'https://example.test/page', runScripts: 'outside-only' });
    const context = dom.getInternalVMContext();
    // window and document already exist in this realm and are getter-only, so the helper
    // gets no globals: the scripts under test find them as globals themselves.
    loadClassic('src/lib/purify-3.4.11.min.js', 'window.DOMPurify', {}, context);
    loadClassic('src/lib/sanitize.js', 'sanitizeNote', {}, context);
    const run = (fn, value) => dom.window.eval(`${fn}(${JSON.stringify(value)})`);
    return {
        note: (value) => run('sanitizeNote', value),
        audioUrl: (value) => run('odhSanitizeAudioUrl', value)
    };
}

test('the css field keeps its stylesheet: a top-level <style> survives the round trip', () => {
    const { note } = sanitizeRealm();
    const result = note({ css: '<style>span.star {color:#FF0000;}</style>' });

    assert.ok(result.css.includes('<style>'), 'the dictionary stylesheet must not be dropped');
    assert.ok(result.css.includes('span.star'), 'its rules must survive');
});

test('the css field is sanitized too, so markup smuggled through it cannot run', () => {
    const { note } = sanitizeRealm();
    const result = note({ css: '<style>span.star{color:red}</style><script>window.odhPwned=1</script>' });

    assert.ok(result.css.includes('<style>'), 'the legitimate part stays');
    assert.ok(!result.css.includes('<script'), 'script must be stripped');
    assert.ok(!result.css.includes('odhPwned'), 'its body goes with it');
});

test('definitions lose event handlers, inline styles and our control attributes', () => {
    const { note } = sanitizeRealm();
    const result = note({
        definitions: ['<img src="x" onerror="window.odhPwned=1" style="position:fixed" ' +
            'data-nindex="0" data-dindex="0" data-sound="https://x.test/a.mp3" data-odh-control="add">']
    });

    const definition = result.definitions[0];
    assert.ok(definition.includes('src="x"'), 'the element itself is legitimate dictionary markup');
    for (const gone of ['onerror', 'style=', 'data-nindex', 'data-dindex', 'data-sound', 'data-odh-control']) {
        assert.ok(!definition.includes(gone), `${gone} must not reach the popup`);
    }
});

test('a stylesheet inside definitions survives, because dictionaries may paste page markup', () => {
    const { note } = sanitizeRealm();
    const result = note({ definitions: ['<div class="entry"><style>span.pos{color:#0d47a1}</style></div>'] });

    assert.ok(result.definitions[0].includes('<style>'), 'scraped page styles must not be silently dropped');
    assert.ok(result.definitions[0].includes('span.pos'));
});

test('the single-string definitions form is sanitized as well', () => {
    const { note } = sanitizeRealm();
    const result = note({ definitions: '<b onmouseover="window.odhPwned=1">entry</b>' });

    assert.ok(result.definitions.includes('<b>'), 'markup stays');
    assert.ok(!result.definitions.includes('onmouseover'), 'its handler does not');
});

test('audio urls are limited to web schemes', () => {
    const { audioUrl } = sanitizeRealm();

    assert.equal(audioUrl('https://cdn.test/a.mp3'), 'https://cdn.test/a.mp3');
    assert.equal(audioUrl('http://cdn.test/a.mp3'), 'http://cdn.test/a.mp3');
    for (const rejected of ['ftp://cdn.test/a.mp3', 'javascript:alert(1)', 'data:audio/mp3;base64,AA', '/local.mp3']) {
        assert.equal(audioUrl(rejected), null, `${rejected} must not be playable`);
    }
});

// --- the two places a note reaches: the popup document and the Anki card --------------

function frontendRealm() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'https://example.test/page', runScripts: 'outside-only' });
    const context = dom.getInternalVMContext();
    const sent = [];
    loadClassic('src/lib/purify-3.4.11.min.js', 'window.DOMPurify', {}, context);
    loadClassic('src/lib/sanitize.js', 'sanitizeNote', {}, context);
    loadClassic('src/fg/js/frontend.js', 'window.odh_frontend', {
        chrome: { runtime: { onMessage: { addListener() { } } } },
        Popup: class {
            sendMessage(action, params) { sent.push({ action, params }); }
        },
        FrontendAPI: class {
            async addNote(note) { sent.push({ action: 'addNote', note }); return { ok: true }; }
            async playAudio() { return null; }
            async isConnected() { return false; }
        },
        rangeFromPoint() { return null; },
        TextSourceRange: class { },
        selectedText: () => 'synthetic word',
        isEmpty: () => false,
        getSentence: () => 'a synthetic sentence',
        isValidElement: () => true
    }, context);
    return { frontend: dom.window.odh_frontend, sent };
}

test('buildNote sanitizes every note a dictionary returns', () => {
    const { frontend } = frontendRealm();
    const notes = frontend.buildNote([
        { css: '<style>span.star{color:red}</style>', definitions: ['<img src=x onerror="window.odhPwned=1">'] },
        { definitions: '<b onclick="window.odhPwned=1">entry</b>' }
    ]);

    assert.equal(notes.length, 2);
    assert.ok(notes[0].css.includes('<style>'), 'the dictionary stylesheet survives');
    assert.ok(!notes[0].definitions[0].includes('onerror'), 'its handler does not');
    assert.ok(!notes[1].definitions.includes('onclick'), 'the string form is cleaned too');
    assert.equal(notes[0].expression, 'synthetic word', 'the template fills the missing fields');
});

test('buildNote cleans the string result form as well', () => {
    const { frontend } = frontendRealm();
    const notes = frontend.buildNote('<div onmouseover="window.odhPwned=1">entry</div>');

    assert.equal(notes.length, 1);
    assert.ok(!notes[0].definitions[0].includes('onmouseover'));
});

test('the Anki payload carries sanitized fields only', async () => {
    const { frontend, sent } = frontendRealm();
    frontend.notes = frontend.buildNote([{
        css: '<style>span.star{color:red}</style><script>window.odhPwned=1</script>',
        definitions: ['<img src=x onerror="window.odhPwned=1">', '<a href="javascript:alert(1)">x</a>']
    }]);

    await frontend.api_addNote({ nindex: 0, dindex: 0, context: '<b>edited</b> sentence' });

    const payload = sent.find((entry) => entry.action === 'addNote').note;
    for (const field of ['definition', 'definitions']) {
        assert.ok(payload[field].includes('<style>'), `${field} keeps the dictionary stylesheet`);
        for (const gone of ['<script', 'onerror', 'javascript:']) {
            assert.ok(!payload[field].includes(gone), `${gone} must not reach a card`);
        }
    }
    // The editable context is the user's own content and is deliberately left alone.
    assert.equal(payload.sentence, '<b>edited</b> sentence');
    assert.equal(payload.url, 'https://example.test/page', 'the url comes from the page, not the dictionary');
});