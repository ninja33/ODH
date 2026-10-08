const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Every reply that crosses an internal boundary must carry the envelope tag, success and
// failure alike. These cases exist because the opposite mistake has already happened once:
// a producer wrapped a success value and a consumer read it as data, which surfaced only in
// Chrome. Asserting the producer side keeps that class of error in Node.

// --- worker handlers ---------------------------------------------------------

function workerFixture() {
    const chrome = {
        runtime: {
            id: 'synthetic-extension-id',
            getURL: path => `chrome-extension://synthetic-extension-id/${path}`,
            onMessage: { addListener() {} },
            onInstalled: { addListener() {} },
            onStartup: { addListener() {} },
            sendMessage: async () => null
        },
        storage: { local: { get(keys, callback) { callback({}); }, set(items, callback) { callback(); } } },
        tabs: { onCreated: { addListener() {} }, onUpdated: { addListener() {} }, query(filter, callback) { callback([]); } },
        commands: { onCommand: { addListener() {} } },
        action: { setBadgeText() {} },
        i18n: { getUILanguage: () => 'en-US' }
    };
    const Worker = loadClassic('src/bg/js/serviceworker.js', 'ODHServiceworker', {
        chrome,
        optionsLoad: async () => ({}),
        optionsSave: async () => {},
        console: { error() {}, log() {}, warn() {} },
        Ankiconnect: class {},
        Builtin: class { loadData() {} },
        Deinflector: class { loadData() {} deinflect() { return ['synthetic'] } },
        importScripts() {},
        setupOffscreenDocument() {},
        setInterval() {}
    }, null, ['src/lib/envelope.js', 'src/lib/message.js']);
    return new Worker();
}

const okEnvelope = envelope => {
    assert.equal(envelope && envelope.__odhReply, true, 'a reply must carry the envelope tag');
    assert.equal(envelope.ok, true, 'a successful reply must be marked ok');
    return envelope.value;
};

test('worker handlers answer with a success envelope, including a null value', async () => {
    const worker = workerFixture();

    // A handler whose value is legitimately null must still be enveloped; the envelope is
    // what tells the consumer "this ran and produced null".
    let captured = null;
    worker.offscreen_Deinflect({ word: 'synthetic', callback: value => { captured = value; } });
    assert.deepEqual(okEnvelope(captured), ['synthetic']);

    captured = null;
    worker.builtin = { dicts: { collins: {} }, findTerm: () => null };
    worker.offscreen_getBuiltin({ dict: 'collins', word: 'synthetic', callback: value => { captured = value; } });
    assert.equal(okEnvelope(captured), null, 'a null result must survive the envelope');

    captured = null;
    worker.offscreen_getLocale({ callback: value => { captured = value; } });
    assert.equal(okEnvelope(captured), 'en-US');

    captured = null;
    worker.target = { getVersion: async () => null };
    await worker.options_getVersion({ callback: value => { captured = value; } });
    assert.equal(okEnvelope(captured), null);
});

// initBackend's reply is ignored by the sandbox, but the relay that carries it still reads
// it, so it is enveloped like every other reply (carrying null as its value).
test('initBackend replies with an envelope carrying null', async () => {
    const worker = workerFixture();
    let captured = 'unset';
    await worker.initBackend({ callback: value => { captured = value; } });
    assert.equal(captured.__odhReply, true);
    assert.equal(captured.ok, true);
    assert.equal(captured.value, null);
});

// --- sandbox reply helper ----------------------------------------------------

// The sandbox produces the reply for a dictionary call, so its success must be enveloped
// even though the value handed to a dictionary (after the relay unwraps it) stays bare.
test('the sandbox replies with a success envelope', () => {
    const posted = [];
    const sandboxApi = loadClassic('src/bg/sandbox/sandbox.js', 'Sandbox', {
        window: { addEventListener() {}, parent: { postMessage: message => posted.push(message) } },
        // sandbox.js registers its one-shot init trigger on DOMContentLoaded.
        document: { addEventListener() {} },
        console: { error() {}, log() {}, warn() {} },
        api: { fetch: async () => null }
    }, null, ['src/lib/envelope.js', 'src/lib/message.js']);
    const sandbox = new sandboxApi();
    sandbox.dicts = { synthetic: { setOptions() {} } };

    // onBackgroundMessage destructures the frame and hands backend_* only its params.
    sandbox.backend_setScriptsOptions({ options: { dictSelected: 'synthetic' }, callbackId: 'synthetic-1' });
    assert.equal(posted.length, 1);
    assert.deepEqual(okEnvelope(posted[0].params.data), 'synthetic');
});
