const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Worker-local readiness and the optionsChanged split: the constructor loads options on
// its own, so a worker restarted under a live offscreen recovers (architecture defect 3).

const RUNTIME_ID = 'synthetic-extension-id';

function readinessWorker({ options, optionsLoad, deferData = false, stubScripts = true } = {}) {
    const diagnostics = [];
    const notes = [];
    const saves = [];
    const pushes = [];
    const connections = [];
    const loads = [];
    const messages = [];
    const tabMessages = [];
    const event = { addListener() {} };
    const chrome = {
        runtime: {
            id: RUNTIME_ID,
            lastError: undefined,
            getURL: path => `chrome-extension://${RUNTIME_ID}/${path}`,
            onMessage: event,
            onInstalled: event,
            onStartup: event,
            sendMessage: async request => { messages.push(request); return null; }
        },
        storage: {
            local: {
                get(keys, callback) { callback({}); },
                set(items, callback) { callback(); }
            }
        },
        tabs: {
            onCreated: event,
            onUpdated: event,
            query(filter, callback) { callback([]); },
            sendMessage(tabId, request, callback) { tabMessages.push({ tabId, request }); if (callback) callback(); }
        },
        commands: { onCommand: event },
        action: { setBadgeText() {} },
        i18n: { getUILanguage: () => 'en' }
    };
    class AnkiconnectStub {
        async initConnection(loaded) { connections.push({ worker: this, loaded }); }
    }
    // A pending gate stands in for the dictionary data load (~35MB, P7) so a test can
    // observe what waits for it and what does not.
    let settleData = null;
    const dataGate = deferData ? new Promise(resolve => { settleData = resolve; }) : null;
    const Worker = loadClassic('src/bg/js/serviceworker.js', 'ODHServiceworker', {
        chrome,
        setTimeout,
        clearTimeout,
        optionsLoad: optionsLoad || (async () => structuredClone(options || {})),
        optionsSave: async saved => { saves.push(structuredClone(saved)); },
        console: { error(message) { diagnostics.push(message); }, info(message) { notes.push(message); }, log() {}, warn() {} },
        Ankiconnect: AnkiconnectStub,
        Builtin: class { loadData() { return dataGate; } },
        Deinflector: class { loadData() { return dataGate; } deinflect() { return ['synthetic']; } },
        importScripts() {},
        setupOffscreenDocument: async () => {},
        setInterval() {}
    }, null, ['src/lib/envelope.js', 'src/lib/message.js']);
    const worker = new Worker();
    // The browser bridge is not under test here: registration and the options push are
    // recorded instead of performed.
    worker.setScriptsOptions = async pushed => { pushes.push(pushed); };
    if (stubScripts) {
        worker.loadScripts = async list => {
            loads.push(list);
            return { loaded: [{ result: { objectname: 'synthetic_dictionary', displayname: 'Synthetic' } }], failed: [] };
        };
    } else {
        // The real loadScripts runs over a per-script stub, so a test can fail one name
        // and observe how the batch reports it.
        worker.loadScript = async name => ({ name, result: { objectname: name, displayname: name } });
    }
    return { worker, diagnostics, notes, saves, pushes, connections, loads, messages, tabMessages, settleData: () => settleData && settleData() };
}

test('the constructor loads options and applies worker-local state without any message', async () => {
    const options = { services: 'ankiconnect', enabled: true, sysscripts: '', udfscripts: '' };
    const fixture = readinessWorker({ options });

    await fixture.worker.optionsReady;

    assert.deepEqual(fixture.worker.options, options);
    assert.equal(fixture.worker.target, fixture.worker.ankiconnect);
    // NOTE: loading a classic script also runs its module tail, which constructs a
    // second worker in the same realm — so the property is asserted per worker.
    const own = fixture.connections.filter(entry => entry.worker === fixture.worker.ankiconnect);
    assert.equal(own.length, 1, 'initConnection runs once, at construction');
    assert.deepEqual(fixture.messages, [], 'readiness needs no bridge message');
    assert.deepEqual(fixture.diagnostics, []);
});

test('a failed constructor load is logged, leaves options null, and never rejects', async () => {
    const fixture = readinessWorker({
        optionsLoad: async () => { throw new Error('synthetic read failure'); }
    });

    // Awaiting must not throw: the window is closed by the handler guards, not by a
    // rejection nobody asked for.
    await fixture.worker.optionsReady;

    // The module tail's worker in the same realm fails as well, so the property is the
    // message every line carries, not the line count.
    const unexpected = fixture.diagnostics.filter(line => line !== 'Unable to load settings: synthetic read failure');
    assert.deepEqual(unexpected, [], 'every diagnostic is the classified load failure');
    assert.ok(fixture.diagnostics.length > 0, 'the failure is logged, not swallowed');
    assert.equal(fixture.worker.options, null);
    assert.equal(fixture.worker.target, null);

    // A request arriving inside the window gets the existing classified early exit.
    const responses = [];
    await fixture.worker.options_getVersion({ callback: value => responses.push(value) });
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
    assert.equal(responses[0].error.kind, 'not-ready');
});

test('setupOptions selects the Anki target by service without recording the options', async () => {
    const fixture = readinessWorker({ options: { services: 'none' } });
    await fixture.worker.optionsReady;
    assert.equal(fixture.connections.length, 0, 'no target, no connection');

    fixture.worker.setupOptions({ services: 'none' });
    assert.equal(fixture.worker.target, null);

    fixture.worker.setupOptions({ services: 'ankiconnect' });
    assert.equal(fixture.worker.target, fixture.worker.ankiconnect);
    assert.equal(fixture.connections.length, 1, 'initConnection runs for the new target');

    // Legacy 'ankiweb' values fall through: the service was removed.
    fixture.worker.setupOptions({ services: 'ankiweb' });
    assert.equal(fixture.worker.target, null);
    // NOTE: setupOptions applies only — recording the options is the caller's closing
    // step, done explicitly by the constructor and by optionsChanged.
    assert.equal(fixture.worker.options.services, 'none', 'setupOptions does not record the options');
});

test('setupScripts always loads the configured set and fixes up the selection', async () => {
    const fixture = readinessWorker({ options: { services: 'none' } });
    await fixture.worker.optionsReady;
    const options = { sysscripts: 'synthetic_script', udfscripts: '', dictSelected: 'missing_dictionary' };

    await fixture.worker.setupScripts(options);

    // The script set and the namelist are built inside the loaded realm, so they are
    // normalised before comparing.
    assert.equal(fixture.loads.length, 1);
    assert.deepEqual(Array.from(fixture.loads[0]), ['builtin_encn_Collins', 'synthetic_script']);
    assert.equal(options.dictSelected, 'synthetic_dictionary', 'an unloadable selection falls back');
    assert.deepEqual(Array.from(options.dictNamelist), [{ objectname: 'synthetic_dictionary', displayname: 'Synthetic' }]);
    // Pushing the options and saving are the caller's steps, not setupScripts'.
    assert.deepEqual(fixture.pushes, []);
    assert.deepEqual(fixture.saves, []);
});

test('optionsChanged reloads only when the script list changes, and always saves', async () => {
    const fixture = readinessWorker({ options: { services: 'none' } });
    await fixture.worker.optionsReady;
    // A baseline the constructor would have produced, so the comparison is about the
    // script list alone.
    fixture.worker.options = { services: 'none', sysscripts: 'a', udfscripts: '' };

    await fixture.worker.optionsChanged({ services: 'none', sysscripts: 'a', udfscripts: '' });
    assert.deepEqual(fixture.loads, [], 'an unchanged script list is not reloaded');

    await fixture.worker.optionsChanged({ services: 'none', sysscripts: 'b', udfscripts: '' });
    assert.equal(fixture.loads.length, 1, 'a changed script list reloads once');
    assert.equal(fixture.saves.length, 2, 'every save persists');
    assert.equal(fixture.pushes.length, 2, 'every save pushes the options to the sandbox');
    assert.equal(fixture.worker.options.sysscripts, 'b');
});

test('the shortcut and the tab broadcast stay silent until the constructor read lands', async () => {
    let releaseRead = null;
    const fixture = readinessWorker({
        optionsLoad: () => new Promise(resolve => { releaseRead = resolve; })
    });

    // The window where a command or a tab event precedes the constructor's read: both
    // used to throw (TypeError on null options) or broadcast null into the content script.
    await fixture.worker.onCommand('enabled');
    assert.equal(fixture.saves.length, 0, 'a shortcut press in the window changes nothing');
    fixture.worker.onTabReady(7);
    assert.equal(fixture.tabMessages.length, 0, 'a tab event in the window broadcasts nothing');

    releaseRead({ services: 'none', enabled: true, sysscripts: '', udfscripts: '' });
    await fixture.worker.optionsReady;

    await fixture.worker.onCommand('enabled');
    assert.equal(fixture.saves.length, 1, 'the shortcut works once the options exist');
    assert.equal(fixture.saves[0].enabled, false);
    fixture.worker.onTabReady(7);
    assert.equal(fixture.tabMessages.length, 1, 'the tab broadcast works once the options exist');
    assert.equal(fixture.tabMessages[0].request.action, 'setFrontendOptions');
});

test('the data handlers hold their reply until dataReady settles', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, deferData: true });
    await fixture.worker.optionsReady;
    const deinflectReplies = [];
    const builtinReplies = [];

    fixture.worker.offscreen_Deinflect({ word: 'synthetic', callback: value => deinflectReplies.push(value) });
    fixture.worker.offscreen_getBuiltin({ dict: 'collins', word: 'synthetic', callback: value => builtinReplies.push(value) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deinflectReplies.length, 0, 'a pending data load holds the deinflect reply');
    assert.equal(builtinReplies.length, 0, 'a pending data load holds the builtin reply');

    fixture.settleData();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deinflectReplies.length, 1, 'the reply follows the data load');
    assert.deepEqual(deinflectReplies[0].value, ['synthetic']);
    assert.equal(builtinReplies.length, 1);
    assert.equal(builtinReplies[0].error.kind, 'missing-data', 'the stub carries no dictionary');
});

test('the constructor and the tab broadcast do not wait for dataReady', async () => {
    const fixture = readinessWorker({ options: { services: 'none', enabled: true }, deferData: true });

    // Options readiness settles while the ~35MB dictionary load is still pending: the
    // data belongs to two handlers, not to the readiness path.
    await fixture.worker.optionsReady;
    assert.notEqual(fixture.worker.options, null, 'options readiness does not wait for the dictionaries');

    fixture.worker.onTabReady(7);
    assert.equal(fixture.tabMessages.length, 1, 'the broadcast does not wait for the dictionaries');
});

test('initBackend loads the scripts of a fresh sandbox and records the applied options', async () => {
    const fixture = readinessWorker({ options: { services: 'none', sysscripts: 'synthetic_script', udfscripts: '' } });
    await fixture.worker.optionsReady;

    const replies = [];
    await fixture.worker.initBackend({ callback: value => replies.push(value) });

    assert.equal(fixture.loads.length, 1, 'one round of loading');
    assert.deepEqual(Array.from(fixture.loads[0]), ['builtin_encn_Collins', 'synthetic_script']);
    assert.equal(fixture.saves.length, 1, 'the selection fixups are persisted');
    assert.equal(fixture.pushes.length, 1, 'the options reach the sandbox');
    assert.equal(fixture.worker.initInFlight, null, 'the slot is released');
    assert.equal(fixture.worker.options.sysscripts, 'synthetic_script', 'the announcement records the applied options');
    assert.equal(replies.length, 1);
    assert.equal(replies[0].ok, true);
    assert.equal(replies[0].value, null);
});

test('concurrent announcements share one round, a later one reloads', async () => {
    const fixture = readinessWorker({ options: { services: 'none', sysscripts: '', udfscripts: '' } });
    await fixture.worker.optionsReady;

    const first = fixture.worker.initBackend({ callback() {} });
    const second = fixture.worker.initBackend({ callback() {} });
    await Promise.all([first, second]);
    assert.equal(fixture.loads.length, 1, 'concurrent frames share one round');

    await fixture.worker.initBackend({ callback() {} });
    assert.equal(fixture.loads.length, 2, 'a later announcement reloads — the existing single-flight semantics');
});

test('loadScripts reports the scripts that loaded and the ones that failed', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, stubScripts: false });
    fixture.worker.loadScript = async name => {
        if (name === 'broken_script')
            throw Object.assign(new Error('synthetic load failure'), { kind: 'network' });
        return { name, result: { objectname: name, displayname: name } };
    };

    const { loaded, failed } = await fixture.worker.loadScripts(['good_script', 'broken_script']);

    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].result.objectname, 'good_script');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].name, 'broken_script');
    assert.equal(failed[0].reason.kind, 'network');
});

test('setupScripts registers the scripts that arrived and falls back when the selection failed', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, stubScripts: false });
    fixture.worker.loadScript = async name => {
        if (name === 'broken_script')
            throw Object.assign(new Error('synthetic load failure'), { kind: 'network' });
        return { name, result: { objectname: name, displayname: name } };
    };
    const options = { services: 'none', sysscripts: 'broken_script', udfscripts: '', dictSelected: 'broken_script' };

    // A partial failure used to reject the whole batch and fail the save.
    await fixture.worker.setupScripts(options);

    assert.deepEqual(Array.from(options.dictNamelist.map(x => x.objectname)), ['builtin_encn_Collins']);
    assert.equal(options.dictSelected, 'builtin_encn_Collins', 'the selection falls back to the builtin');
});

test('a save with one unreachable script succeeds with the scripts that loaded', async () => {
    const fixture = readinessWorker({ options: { services: 'none', sysscripts: 'a', udfscripts: '' }, stubScripts: false });
    fixture.worker.loadScript = async name => {
        if (name === 'good_script')
            throw Object.assign(new Error('synthetic load failure'), { kind: 'network' });
        return { name, result: { objectname: name, displayname: name } };
    };

    await fixture.worker.optionsChanged({ services: 'none', sysscripts: 'good_script', udfscripts: '', dictSelected: 'good_script' });

    assert.equal(fixture.saves.length, 1, 'the save survives one failed script');
    assert.equal(fixture.pushes.length, 1);
    assert.deepEqual(Array.from(fixture.worker.options.dictNamelist.map(x => x.objectname)), ['builtin_encn_Collins']);
});

test('a save where every script fails is refused and keeps the stored configuration', async () => {
    const fixture = readinessWorker({ options: { services: 'none', sysscripts: 'a', udfscripts: '' }, stubScripts: false });
    fixture.worker.loadScript = async () => {
        throw Object.assign(new Error('synthetic load failure'), { kind: 'network' });
    };
    // The sandbox answers not-ready for a selection that never loaded.
    fixture.worker.setScriptsOptions = async pushed => {
        if (!pushed.dictSelected)
            throw Object.assign(new Error('Dictionary not loaded'), { kind: 'not-ready' });
        fixture.pushes.push(pushed);
    };

    await assert.rejects(fixture.worker.optionsChanged({ services: 'none', sysscripts: 'good_script', udfscripts: '' }));

    assert.equal(fixture.saves.length, 0, 'nothing is written, so the stored configuration survives');
    assert.deepEqual(fixture.notes, [], 'nothing loaded, so there is no switch to announce');
});

test('the fallback names the dictionary that failed to load', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, stubScripts: false });
    fixture.worker.loadScript = async name => {
        if (name === 'broken_script')
            throw Object.assign(new Error('synthetic load failure'), { kind: 'network' });
        return { name, result: { objectname: name, displayname: name } };
    };
    const options = { services: 'none', sysscripts: 'broken_script', udfscripts: '', dictSelected: 'broken_script' };

    await fixture.worker.setupScripts(options);

    assert.deepEqual(fixture.notes, ['Dictionary broken_script failed to load, switching to builtin_encn_Collins']);
});

test('the fallback names a selection that is no longer configured', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, stubScripts: false });
    const options = { services: 'none', sysscripts: '', udfscripts: '', dictSelected: 'removed_script' };

    await fixture.worker.setupScripts(options);

    assert.deepEqual(fixture.notes, ['Dictionary removed_script is no longer configured, switching to builtin_encn_Collins']);
});

test('a selection that loaded is not announced', async () => {
    const fixture = readinessWorker({ options: { services: 'none' }, stubScripts: false });
    const options = { services: 'none', sysscripts: '', udfscripts: '', dictSelected: 'builtin_encn_Collins' };

    await fixture.worker.setupScripts(options);

    assert.deepEqual(fixture.notes, []);
});
