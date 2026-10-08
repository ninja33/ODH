const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// Ankiconnect runs in the service worker, so this realm supplies fetch and a console, while
// envelope.js provides the odhLog the failure line uses. The connection state is read by the
// settings pages and by the add-note button, so "is Anki there right now" has to be answered by
// a request rather than by a snapshot: the cached one kept answering "connected" after Anki had
// stopped, and kept answering "not connected" after it came back.

function ankiFixture(responses) {
    const requests = [];
    const logged = [];
    const Ankiconnect = loadClassic('src/bg/js/ankiconnect.js', 'Ankiconnect', {
        fetch: async (url, init) => {
            requests.push(JSON.parse(init.body));
            const response = responses.shift();
            if (response === 'reject') throw new Error('Failed to fetch');
            return { json: async () => response };
        },
        console: { error: (...args) => logged.push(args.join(' ')) }
    }, null, ['src/lib/envelope.js']);
    return { Ankiconnect, requests, logged };
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
