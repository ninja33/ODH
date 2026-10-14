const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');
const { fakeTimers, hangingFetch } = require('../helpers/abort-deadline.cjs');

// Ankiconnect runs in the service worker, so this realm supplies fetch, the deadline timers,
// AbortController and a console, while envelope.js provides the odhLog the failure line uses.
// The connection state is read by the settings pages and by the add-note button, so "is Anki
// there right now" has to be answered by a request rather than by a snapshot: the cached one
// kept answering "connected" after Anki had stopped, and kept answering "not connected" after
// it came back. The deadline bounds each request, so a black-hole endpoint fails at its own
// timeout instead of holding the bridge's reply budget.

function ankiFixture(responses = [], { fetch: fetchImpl, seen = [] } = {}) {
    const requests = [];
    const logged = [];
    const timers = fakeTimers();
    const stub = async (url, init) => {
        seen.push({ url, init });
        requests.push(JSON.parse(init.body));
        const response = responses.shift();
        if (response === 'reject') throw new Error('Failed to fetch');
        return { json: async () => response };
    };
    const Ankiconnect = loadClassic('src/bg/js/ankiconnect.js', 'Ankiconnect', {
        AbortController,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        fetch: fetchImpl || stub,
        console: { error: (...args) => logged.push(args.join(' ')) }
    }, null, ['src/lib/envelope.js']);
    return { Ankiconnect, requests, seen, logged, timers };
}

test('getVersion asks Anki on every call instead of replaying a snapshot', async () => {
    const { Ankiconnect, requests } = ankiFixture([
        { error: null, result: 6 },
        { error: null, result: 7 }
    ]);
    const anki = new Ankiconnect();

    assert.equal(await anki.getVersion(), 6);
    assert.equal(await anki.getVersion(), 7, 'a snapshot would repeat the first answer');
    assert.deepEqual(requests.map(request => request.action), ['version', 'version']);
});

test('the presence probe settles as null and stays quiet when Anki is not running', async () => {
    const { Ankiconnect, logged } = ankiFixture(['reject']);
    const anki = new Ankiconnect();

    assert.equal(await anki.getVersion(), null);
    assert.deepEqual(logged, [],
        'a closed Anki is a normal answer to a presence probe, not an error per lookup');
});

test('an operation reports its failure by default', async () => {
    const { Ankiconnect, logged } = ankiFixture(['reject']);
    const anki = new Ankiconnect();

    assert.equal(await anki.addNote({ deckName: 'synthetic' }), null);
    assert.deepEqual(logged, ['Anki request failed: addNote Failed to fetch'],
        'quiet defaults to false, so a caller that does not ask for it still gets a line');
});

test('initConnection records the endpoint without probing on its own', async () => {
    const { Ankiconnect, requests } = ankiFixture([{ error: null, result: 6 }]);
    const anki = new Ankiconnect();

    await anki.initConnection({ ankiconnecturl: 'http://127.0.0.1:9999' });

    assert.equal(anki.url, 'http://127.0.0.1:9999');
    assert.equal(requests.length, 0, 'the probe belongs to getVersion, not to connecting');
});

// A black-hole endpoint used to hold the request until the bridge's own 8s reply budget, with
// nothing able to cancel it. The deadline now aborts the in-flight fetch, and the call still
// settles as null: every caller branches on a falsy value, and that contract is unchanged.
test('a request that stops answering is aborted at its deadline and still settles as null', async () => {
    const seen = [];
    const { Ankiconnect, logged, timers } = ankiFixture([], { fetch: hangingFetch(seen) });
    const anki = new Ankiconnect();

    const pending = anki.addNote({ deckName: 'synthetic' });
    timers.fireAll();
    assert.equal(await pending, null, 'the contract is unchanged: a failed call settles as null');
    assert.equal(seen[0].init.signal.aborted, true, 'the deadline must abort the in-flight fetch');
    assert.ok(logged.some(line => line.includes('(timeout)')),
        'an abort is this deadline firing, not a refused connection, and the line says so');
});

// The probe asks quietly because a closed Anki is a normal answer; an endpoint that accepts
// the connection and then never answers must be just as quiet, or every lookup would print a
// line for a state the user cannot act on.
test('the presence probe stays quiet when its deadline fires', async () => {
    const seen = [];
    const { Ankiconnect, logged, timers } = ankiFixture([], { fetch: hangingFetch(seen) });
    const anki = new Ankiconnect();

    const pending = anki.getVersion();
    timers.fireAll();
    assert.equal(await pending, null);
    assert.deepEqual(logged, [], 'an unreachable Anki is a normal answer to a presence probe');
});

// A cleared deadline is what keeps a settled request from being aborted afterwards: without
// the clear, a late timer would abort a fetch whose reply is already on its way back.
test('a fast reply leaves no deadline behind', async () => {
    const seen = [];
    const { Ankiconnect, timers } = ankiFixture([{ error: null, result: 6 }], { seen });
    const anki = new Ankiconnect();

    assert.equal(await anki.getVersion(), 6);
    assert.equal(timers.pending.size, 0, 'the deadline must be cleared once the reply is in');
    assert.equal(seen[0].init.signal.aborted, false, 'a settled request must not be aborted');
});
