const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// setupOffscreenDocument is the worker-side gate for the offscreen document that hosts the
// dictionary sandbox and plays audio. The stubs stand in for the two Chrome 116+ calls it
// makes; they do not prove real Chrome lifetime behaviour, which is observed in the browser.
// Each test loads its own realm, so the module-level `creating` slot starts empty every time.

function offscreenFixture({ existing = [], create } = {}) {
    const calls = { getContexts: 0, createDocument: 0 };
    let created = null;
    const chrome = {
        runtime: {
            getURL: path => `chrome-extension://synthetic/${path}`,
            getContexts: async () => { calls.getContexts++; return existing; }
        },
        offscreen: {
            createDocument: async (options) => {
                calls.createDocument++;
                created = options;
                if (create) return create(options);
            }
        }
    };
    const setup = loadClassic('src/bg/js/utils.js', 'setupOffscreenDocument', { chrome });
    return { setup, calls, created: () => created };
}

test('an existing offscreen document is reused, not created again', async () => {
    const fixture = offscreenFixture({ existing: [{ documentUrl: 'chrome-extension://synthetic/bg/offscreen.html' }] });

    await fixture.setup('/bg/offscreen.html');

    assert.equal(fixture.calls.getContexts, 1);
    assert.equal(fixture.calls.createDocument, 0);
});

test('a missing offscreen document is created with the reasons it actually needs', async () => {
    const fixture = offscreenFixture();

    await fixture.setup('/bg/offscreen.html');

    assert.equal(fixture.calls.createDocument, 1);
    const created = fixture.created();
    assert.equal(created.url, '/bg/offscreen.html');
    // NOTE: reasons is built inside the VM realm, so its Array.prototype differs from this
    // file's; copy it out before comparing, as the envelope tests do.
    assert.deepEqual(Array.from(created.reasons), ['AUDIO_PLAYBACK', 'IFRAME_SCRIPTING'],
        'the reasons must describe the real use: the sandbox iframe and audio playback');
    assert.ok(typeof created.justification === 'string'
        && created.justification.length > 0
        && !/reason for needing/.test(created.justification),
        'the justification must be a real description, not the sample placeholder');
});

test('concurrent calls share one creation', async () => {
    const releases = [];
    const fixture = offscreenFixture({ create: () => new Promise(resolve => releases.push(resolve)) });
    const first = fixture.setup('/bg/offscreen.html');
    const second = fixture.setup('/bg/offscreen.html');
    // Both callers must reach the `creating` gate before the creation is released, so yield a
    // macrotask: each call is still waiting on its own getContexts lookup at this point.
    await new Promise(resolve => setImmediate(resolve));
    // WHY: assert before releasing. A removed gate creates a second document right here, and
    // the count catches it immediately; releasing only the first promise would leave the other
    // caller unsettled and hang the run instead of failing it.
    assert.equal(fixture.calls.createDocument, 1, 'the second caller must wait on the first creation');
    for (const resolve of releases) resolve();
    await Promise.all([first, second]);

    assert.equal(fixture.calls.createDocument, 1, 'the single-flight promise must gate both callers');
});

// A failed creation used to leave the rejected promise in `creating`, so every later caller
// awaited the same stale rejection and the document could never be created again.
test('a failed creation does not poison later attempts', async () => {
    const fixture = offscreenFixture({ create: async () => { throw new Error('synthetic creation failure'); } });

    await assert.rejects(fixture.setup('/bg/offscreen.html'), /synthetic creation failure/);
    await assert.rejects(fixture.setup('/bg/offscreen.html'), /synthetic creation failure/);

    assert.equal(fixture.calls.createDocument, 2, 'the stale rejection must not be reused for the next call');
});
