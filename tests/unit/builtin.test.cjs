const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');
// All entries are synthetic and unrelated to the private dictionary files.
const collins = require('../fixtures/collins.json');

async function loadedDictionary() {
    const Builtin = loadClassic('src/bg/js/builtin.js', 'Builtin', {
        fetch: async url => {
            assert.equal(url, '/bg/data/collins.json');
            return { json: async () => structuredClone(collins) };
        }
    });
    const dictionary = new Builtin();
    await dictionary.loadData();
    return dictionary;
}

test('Builtin loads synthetic data and returns serialized readings, definitions and examples', async () => {
    const dictionary = await loadedDictionary();
    const result = dictionary.findTerm('collins', 'wug');
    assert.equal(typeof result, 'string');
    assert.deepEqual(JSON.parse(result), collins.wug);
});

test('Builtin preserves an entry without readings or examples', async () => {
    const dictionary = await loadedDictionary();
    assert.deepEqual(JSON.parse(dictionary.findTerm('collins', 'flindle')), collins.flindle);
});

test('Builtin returns null for absent, empty and inherited dictionary keys after loading', async () => {
    const dictionary = await loadedDictionary();
    for (const word of ['unlisted-word', '', 'constructor', 'toString']) {
        assert.equal(dictionary.findTerm('collins', word), null, word);
    }
});

test('Builtin performs a case-sensitive lookup', async () => {
    const dictionary = await loadedDictionary();
    assert.equal(dictionary.findTerm('collins', 'Wug'), null);
    assert.equal(dictionary.findTerm('collins', 'WUG'), null);
    assert.ok(dictionary.findTerm('collins', 'wug'));
});
