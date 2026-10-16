const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');
const wordforms = require('../fixtures/wordforms.json');

async function loadedDeinflector() {
    const Deinflector = loadClassic('src/bg/js/deinflector.js', 'Deinflector', {
        fetch: async url => {
            assert.equal(url, '/bg/data/wordforms.json');
            return { ok: true, json: async () => structuredClone(wordforms) };
        }
    });
    const deinflector = new Deinflector();
    await deinflector.loadData();
    return deinflector;
}

test('Deinflector maps synthetic plural, past and progressive forms to the stem', async () => {
    const deinflector = await loadedDeinflector();
    for (const word of ['wugs', 'wugged', 'wugging']) {
        assert.deepEqual(deinflector.deinflect(word), ['wug'], word);
    }
});

test('Deinflector preserves multiple candidate stems and their order', async () => {
    const deinflector = await loadedDeinflector();
    assert.deepEqual(deinflector.deinflect('flindled'), ['flindle', 'flind']);
});

test('Deinflector returns null when an unchanged word has no mapping', async () => {
    const deinflector = await loadedDeinflector();
    assert.equal(deinflector.deinflect('wug'), null);
});

test('Deinflector returns null for an unknown or empty word after loading', async () => {
    const deinflector = await loadedDeinflector();
    assert.equal(deinflector.deinflect('unlisted-word'), null);
    assert.equal(deinflector.deinflect(''), null);
});

test('Deinflector lookup is exact and does not normalize input case', async () => {
    const deinflector = await loadedDeinflector();
    assert.equal(deinflector.deinflect('WUGS'), null);
    assert.deepEqual(deinflector.deinflect('wugs'), ['wug']);
});

test('Deinflector returns null instead of throwing when the data load failed', async () => {
    const Deinflector = loadClassic('src/bg/js/deinflector.js', 'Deinflector', {
        fetch: async () => ({ ok: false, status: 404 })
    });
    const deinflector = new Deinflector();
    await deinflector.loadData();
    assert.equal(deinflector.wordforms, null);
    // Reading the dataset used to throw here, which surfaced as an unanswered request.
    assert.equal(deinflector.deinflect('wugs'), null);
});
