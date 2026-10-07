const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Offscreen replies to the worker are enveloped, so any stub standing in for the relay must
// return an envelope as well.
const odhOk = loadClassic('src/lib/envelope.js', 'odhOk', {
    console: { error() {}, log() {}, warn() {} }
});

function settingsStorage() {
    const writes = [];
    const chrome = {
        runtime: {},
        storage: { local: {
            set(options, callback) { writes.push({ options: structuredClone(options), callback }); },
            get(keys, callback) { callback({ dictSelected: 'legacy_dictionary', hotkey: '17', legacyField: 'keep' }); }
        } }
    };
    const helpers = loadClassic('src/bg/js/utils.js', '({ optionsLoad, optionsSave })', { chrome });
    function complete(error) {
        chrome.runtime.lastError = error ? { message: error } : undefined;
        writes.at(-1).callback();
        delete chrome.runtime.lastError;
    }
    return { chrome, writes, complete, ...helpers };
}

test('settings save waits for storage completion and preserves legacy fields', async () => {
    const storage = settingsStorage();
    let confirmed = false;
    const saving = storage.optionsSave({ dictSelected: 'legacy_dictionary', hotkey: '17', legacyField: 'keep' });
    saving.then(() => { confirmed = true; });
    await Promise.resolve();
    assert.equal(confirmed, false);
    assert.equal(storage.writes.length, 1);
    assert.equal(typeof storage.writes[0].callback, 'function');
    assert.equal(storage.writes[0].options.dictSelected, 'legacy_dictionary');
    assert.equal(storage.writes[0].options.hotkey, '17');
    assert.equal(storage.writes[0].options.legacyField, 'keep');
    storage.complete();
    await saving;
    assert.equal(confirmed, true);
});

test('settings save rejects a storage callback failure', async () => {
    const storage = settingsStorage();
    const saving = storage.optionsSave({});
    const rejected = assert.rejects(saving, /synthetic write failure/);
    storage.complete('synthetic write failure');
    await rejected;
});

test('settings save rejects a synchronous storage failure', async () => {
    const storage = settingsStorage();
    storage.chrome.storage.local.set = () => { throw new Error('synthetic unavailable storage'); };
    await assert.rejects(storage.optionsSave({}), /synthetic unavailable storage/);
});

test('settings read adds defaults without removing legacy values', async () => {
    const storage = settingsStorage();
    const result = await storage.optionsLoad();
    assert.equal(result.enabled, true);
    assert.equal(result.dictSelected, 'legacy_dictionary');
    assert.equal(result.hotkey, '17');
    assert.equal(result.legacyField, 'keep');
});

test('settings read rejects failure instead of creating defaults from a failed read', async () => {
    const storage = settingsStorage();
    storage.chrome.storage.local.get = (keys, callback) => {
        storage.chrome.runtime.lastError = { message: 'synthetic read failure' };
        callback(undefined);
        delete storage.chrome.runtime.lastError;
    };
    await assert.rejects(storage.optionsLoad(), /synthetic read failure/);
    assert.equal(storage.writes.length, 0);
});

test('legacy settings cannot override the own-property check', async () => {
    const storage = settingsStorage();
    const saving = storage.optionsSave({ hasOwnProperty: 'legacy value', enabled: false });
    assert.equal(storage.writes[0].options.hasOwnProperty, 'legacy value');
    assert.equal(storage.writes[0].options.enabled, false);
    storage.complete();
    await saving;
});

function settingsWorker({ stubScripts = true } = {}) {
    const storage = settingsStorage();
    const diagnostics = [];
    const event = { addListener() {} };
    Object.assign(storage.chrome.runtime, { onMessage: event, onInstalled: event, onStartup: event });
    storage.chrome.tabs = { onCreated: event, onUpdated: event, query(filter, callback) { callback([]); } };
    storage.chrome.commands = { onCommand: event };
    storage.chrome.action = { setBadgeText() {} };
    const Worker = loadClassic('src/bg/js/serviceworker.js', 'ODHServiceworker', {
        chrome: storage.chrome,
        // The realm needs the host timers: the request timeout helper takes setTimeout by
        // default, just like every other host facility a stub context provides.
        setTimeout,
        clearTimeout,
        optionsLoad: storage.optionsLoad,
        optionsSave: storage.optionsSave,
        console: { error(message) { diagnostics.push(message); }, log() {}, warn() {} },
        Ankiconnect: class {},
        Builtin: class { loadData() {} },
        Deinflector: class { loadData() {} },
        importScripts() {},
        setupOffscreenDocument() {},
        setInterval() {}
    }, null, ['src/lib/envelope.js']);
    const worker = new Worker();
    worker.options = { services: 'none', sysscripts: '', udfscripts: '', enabled: true };
    // This unit test covers storage acknowledgement, not the browser bridge.
    if (stubScripts) worker.setScriptsOptions = async () => odhOk(null);
    worker.loadScripts = async () => [];
    return { ...storage, worker, diagnostics };
}

test('dictionary messages omit sensitive settings and preserve the original configuration', async () => {
    const fixture = settingsWorker({ stubScripts: false });
    const requests = [];
    fixture.chrome.runtime.sendMessage = async request => {
        requests.push(structuredClone(request));
        return odhOk('synthetic_dictionary');
    };
    const options = Object.freeze({
        ...fixture.worker.options,
        id: 'synthetic-account', password: 'synthetic-sensitive-value',
        ankiconnecturl: 'http://127.0.0.1:18765',
        dictSelected: 'synthetic_dictionary', maxexample: '1', url: 'SourceField',
        legacyField: 'keep', futureOption: { mode: 'synthetic' },
        dictNamelist: [{ objectname: 'synthetic_dictionary', displayname: 'Synthetic dictionary' }]
    });
    const before = structuredClone(options);
    assert.equal(await fixture.worker.setScriptsOptions(options), 'synthetic_dictionary');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].action, 'setScriptsOptions');
    assert.equal(requests[0].target, 'background');
    const sent = requests[0].params.options;
    for (const field of ['id', 'password', 'ankiconnecturl']) {
        assert.equal(Object.hasOwn(sent, field), false, `${field} must not enter the sandbox`);
    }
    for (const field of Object.keys(before).filter(key => !['id', 'password', 'ankiconnecturl'].includes(key))) {
        assert.deepEqual(sent[field], before[field], `${field} must remain available to dictionaries`);
    }
    assert.deepEqual(options, before);
    assert.equal(fixture.writes.length, 0);
});

test('dictionary messages do not restore sensitive keys added by defaults', async () => {
    const fixture = settingsWorker({ stubScripts: false });
    let sent;
    fixture.chrome.runtime.sendMessage = async request => {
        sent = structuredClone(request.params.options);
        return odhOk(null);
    };
    const options = await fixture.optionsLoad();
    const before = structuredClone(options);
    assert.equal(await fixture.worker.setScriptsOptions(options), null);
    for (const field of ['id', 'password', 'ankiconnecturl']) {
        assert.equal(Object.hasOwn(options, field), true);
        assert.equal(Object.hasOwn(sent, field), false);
    }
    assert.equal(sent.maxexample, '2');
    assert.equal(sent.dictSelected, 'legacy_dictionary');
    assert.deepEqual(structuredClone(options), before);
    assert.equal(fixture.writes.length, 0);
});

test('saving settings filters the dictionary message while retaining internal and stored values', async () => {
    const fixture = settingsWorker({ stubScripts: false });
    const requests = [];
    const responses = [];
    const connections = [];
    fixture.chrome.runtime.sendMessage = async request => {
        requests.push(structuredClone(request));
        return odhOk(request.params.options.dictSelected);
    };
    fixture.worker.ankiconnect.initConnection = async options => { connections.push(structuredClone(options)); };
    const options = {
        ...fixture.worker.options, services: 'ankiconnect',
        id: 'synthetic-account', password: 'synthetic-sensitive-value',
        ankiconnecturl: 'http://127.0.0.1:18765',
        dictSelected: 'synthetic_other_dictionary', maxexample: '0', url: 'SourceField', legacyField: 'keep'
    };
    const saving = fixture.worker.options_optionsChanged({ options, callback(result) { responses.push(result); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(fixture.writes.length, 1);
    assert.equal(responses.length, 0);
    for (const field of ['id', 'password', 'ankiconnecturl']) {
        assert.equal(Object.hasOwn(requests[0].params.options, field), false);
        assert.equal(fixture.worker.options[field], options[field]);
        assert.equal(fixture.writes[0].options[field], options[field]);
        assert.equal(connections[0][field], options[field]);
    }
    assert.equal(requests[0].params.options.dictSelected, 'synthetic_other_dictionary');
    assert.equal(requests[0].params.options.maxexample, '0');
    assert.equal(requests[0].params.options.url, 'SourceField');
    fixture.complete();
    await saving;
    assert.equal(responses.length, 1);
    // The reply is enveloped, so unwrap before comparing: the value itself is unchanged,
    // including the credentials the page is allowed to read back.
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, fixture.worker.options);
    assert.equal(responses[0].value.password, 'synthetic-sensitive-value');
});

test('initialization filters dictionary settings while preserving stored legacy credentials', async () => {
    const fixture = settingsWorker({ stubScripts: false });
    const requests = [];
    const responses = [];
    fixture.worker.options = null;
    fixture.chrome.storage.local.get = (keys, callback) => callback({
        services: 'none', sysscripts: '', udfscripts: '', dictSelected: 'synthetic_dictionary',
        id: 'synthetic-account', password: 'synthetic-sensitive-value',
        ankiconnecturl: 'http://127.0.0.1:18765', maxexample: '1', legacyField: 'keep'
    });
    fixture.worker.loadScripts = async () => [{
        result: { objectname: 'synthetic_dictionary', displayname: 'Synthetic dictionary' }
    }];
    fixture.chrome.runtime.sendMessage = async request => {
        requests.push(structuredClone(request));
        return odhOk(request.params.options.dictSelected);
    };
    const initializing = fixture.worker.initBackend({ callback(result) { responses.push(result); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(fixture.writes.length, 1);
    assert.equal(responses.length, 0);
    const sent = requests[0].params.options;
    for (const field of ['id', 'password', 'ankiconnecturl']) {
        assert.equal(Object.hasOwn(sent, field), false);
        assert.equal(Object.hasOwn(fixture.writes[0].options, field), true);
    }
    assert.equal(sent.dictSelected, 'synthetic_dictionary');
    assert.equal(sent.dictNamelist[0].objectname, 'synthetic_dictionary');
    assert.equal(sent.maxexample, '1');
    assert.equal(sent.legacyField, 'keep');
    assert.equal(fixture.writes[0].options.password, 'synthetic-sensitive-value');
    fixture.complete();
    await initializing;
    // initBackend replies with an envelope carrying null, like every other reply.
    assert.equal(responses.length, 1);
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, null);
});

test('worker acknowledges a settings change only after storage completion', async () => {
    const fixture = settingsWorker();
    const responses = [];
    const saving = fixture.worker.options_optionsChanged({
        options: { ...fixture.worker.options, enabled: false },
        callback(result) { responses.push(result); }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.writes.length, 1);
    assert.equal(responses.length, 0);
    fixture.complete();
    await saving;
    assert.equal(responses.length, 1);
    // Enveloped reply: the acknowledgement is the applied options inside the envelope.
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value.enabled, false);
});

test('worker returns a failed acknowledgement once when storage rejects', async () => {
    const fixture = settingsWorker();
    const responses = [];
    const saving = fixture.worker.options_optionsChanged({
        options: { ...fixture.worker.options, password: 'synthetic-sensitive-value' },
        callback(result) { responses.push(result); }
    });
    await new Promise(resolve => setImmediate(resolve));
    fixture.complete('synthetic write failure');
    await saving;
    // A failed save is reported as a classified failure instead of a bare null, so the
    // caller can tell it apart from "nothing to say".
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
    assert.equal(responses[0].error.kind, 'handler-error');
    assert.deepEqual(fixture.diagnostics, ['Unable to save settings.']);
});

test('worker reports an apply failure before storage without a successful response', async () => {
    const fixture = settingsWorker();
    fixture.worker.setScriptsOptions = async () => { throw new Error('synthetic bridge failure'); };
    const responses = [];
    await fixture.worker.options_optionsChanged({
        options: { ...fixture.worker.options },
        callback(result) { responses.push(result); }
    });
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
    assert.equal(responses[0].error.kind, 'handler-error');
    assert.equal(fixture.writes.length, 0);
});

test('shortcut consumes storage failure without an unhandled rejection', async () => {
    const fixture = settingsWorker();
    const saving = fixture.worker.onCommand('enabled');
    assert.equal(fixture.writes.length, 1);
    fixture.complete('synthetic write failure');
    await saving;
    assert.deepEqual(fixture.diagnostics, ['Unable to save shortcut settings.']);
});

test('initialization consumes a read failure and completes its acknowledgement', async () => {
    const fixture = settingsWorker();
    fixture.chrome.storage.local.get = (keys, callback) => {
        fixture.chrome.runtime.lastError = { message: 'synthetic read failure' };
        callback(undefined);
        delete fixture.chrome.runtime.lastError;
    };
    const responses = [];
    await fixture.worker.initBackend({ callback(result) { responses.push(result); } });
    // initBackend is enveloped like every other reply, carrying null as its value.
    assert.equal(responses.length, 1);
    assert.equal(responses[0].__odhReply, true);
    assert.equal(responses[0].ok, true);
    assert.equal(responses[0].value, null);
    assert.equal(fixture.writes.length, 0);
    assert.deepEqual(fixture.diagnostics, ['Unable to initialize settings.']);
});

// Two announcements arriving while the first initialization is still running must share
// it; otherwise both pass the rebuild guard and every dictionary is loaded twice.
test('concurrent initBackend calls share a single initialization', async () => {
    const fixture = settingsWorker();
    const options = { services: 'none', enabled: true, sysscripts: '', udfscripts: '', hotkey: '17' };
    fixture.chrome.storage.local.get = (keys, callback) => callback(structuredClone(options));
    fixture.chrome.storage.local.set = (written, callback) => { fixture.writes.push(structuredClone(written)); callback(); };

    let releaseLoad = null;
    let loads = 0;
    fixture.worker.loadScripts = () => {
        loads += 1;
        return new Promise(resolve => {
            releaseLoad = () => resolve([{ result: { objectname: 'synthetic_dictionary', displayname: 'Synthetic' } }]);
        });
    };

    const first = fixture.worker.initBackend({ callback() {} });
    const second = fixture.worker.initBackend({ callback() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loads, 1, 'the second announcement must not start its own load');

    releaseLoad();
    await Promise.all([first, second]);
    assert.equal(loads, 1, 'both announcements resolve from the same initialization');
    assert.equal(fixture.worker.initInFlight, null, 'the slot is released so a later sandbox can initialize');

    // A later announcement (e.g. a reloaded sandbox) must be able to run again.
    const third = fixture.worker.initBackend({ callback() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loads, 2, 'the guard must not turn into a permanent one-shot latch');
    releaseLoad();
    await third;
});

// this.options lives in the worker, but the loaded dictionaries live in the sandbox
// document. A sandbox that reset has lost its dicts while this.options is still set, so
// initBackend must rebuild even when the stored configuration is unchanged. The options
// page keeps the configuration-only behaviour: it cannot know the sandbox's state.
test('initBackend rebuilds dictionary scripts even when the configuration is unchanged', async () => {
    const fixture = settingsWorker();
    const options = {
        services: 'none', enabled: true, sysscripts: 'synthetic_script', udfscripts: '',
        dictSelected: 'synthetic_dictionary', hotkey: '17'
    };
    fixture.chrome.storage.local.get = (keys, callback) => callback(structuredClone(options));
    // optionsSave is a free variable of the loaded context, so it must be driven through
    // storage rather than by assigning it on the worker instance.
    fixture.chrome.storage.local.set = (written, callback) => { fixture.writes.push({ options: structuredClone(written) }); callback(); };
    let loads = 0;
    fixture.worker.loadScripts = async () => {
        loads += 1;
        return [{ result: { objectname: 'synthetic_dictionary', displayname: 'Synthetic' } }];
    };

    await fixture.worker.initBackend({ callback() {} });
    assert.equal(loads, 1, 'the first announcement builds the scripts once');

    // Same configuration, but this stands for a sandbox document that has reloaded.
    await fixture.worker.initBackend({ callback() {} });
    assert.equal(loads, 2, 'a re-announcing sandbox is rebuilt even without a config change');

    await fixture.worker.options_optionsChanged({ options: { ...options }, callback() {} });
    assert.equal(loads, 2, 'saving an unchanged configuration does not reload the scripts');
});
