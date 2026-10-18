const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// playAudio runs in the offscreen document, so this is where a source the browser refuses is
// discovered. The Audio stub stands in for the media element; the promise play() returns is
// real, because that rejection is exactly what used to escape as an uncaught error.

function offscreenFixture({ play } = {}) {
    const warnings = [];
    const created = [];
    class FakeAudio {
        constructor(url) {
            this.url = url;
            this.currentTime = 0;
            this.plays = 0;
            created.push(this);
        }
        pause() { }
        play() {
            this.plays++;
            return play ? play(this) : Promise.resolve();
        }
    }

    const context = {
        Audio: FakeAudio,
        console: { warn: (...args) => warnings.push(args), error: () => { } },
        document: { getElementById: () => ({ contentWindow: {} }) },
        window: { addEventListener: () => { } },
        Agent: class { constructor(win) { this.sandboxWindow = win; } },
        chrome: { runtime: { onMessage: { addListener: () => { } } } }
    };

    // offscreen.js ends by assigning itself to `window`, which is the stub above rather than
    // the realm global, so the instance is read back through that same stub.
    return { offscreen: loadClassic('src/bg/js/offscreen.js', 'window.odhoffscreen', context), warnings, created };
}

test('a source the browser refuses is reported instead of escaping as an unhandled rejection', async () => {
    const rejections = [];
    const collect = (reason) => rejections.push(reason);
    process.on('unhandledRejection', collect);
    const failure = Object.assign(new Error('The element has no supported sources.'), { name: 'NotSupportedError' });
    const fixture = offscreenFixture({ play: () => Promise.reject(failure) });

    try {
        fixture.offscreen.playAudio('https://cdn.example/refused.mp3');
        // Two turns: one for the rejection to be reported, one for it to settle as unhandled
        // had nothing handled it.
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));
    } finally {
        process.off('unhandledRejection', collect);
    }

    assert.deepEqual(Array.from(rejections), [], 'playAudio must handle the rejection itself');
    assert.equal(fixture.warnings.length, 1, 'the failure must be reported once');
    assert.equal(fixture.warnings[0][1], 'https://cdn.example/refused.mp3',
        'the report must name the URL that failed, which is the part a dictionary author needs');
    assert.equal(fixture.warnings[0][2], 'NotSupportedError', 'the report must keep the failure kind');
});

test('a refused source does not stop the next url from playing', async () => {
    const fixture = offscreenFixture({ play: (audio) => audio.url.includes('refused')
        ? Promise.reject(Object.assign(new Error('nope'), { name: 'NotSupportedError' }))
        : Promise.resolve() });

    fixture.offscreen.playAudio('https://cdn.example/refused.mp3');
    fixture.offscreen.playAudio('https://cdn.example/ok.mp3');
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(Array.from(fixture.created).map((audio) => audio.url), [
        'https://cdn.example/refused.mp3',
        'https://cdn.example/ok.mp3'
    ], 'one element per url, and a failure on the first must not skip the second');
    assert.equal(fixture.created[1].plays, 1, 'the second source must still be played');
});

test('the same url is replayed from one cached element', async () => {
    const fixture = offscreenFixture();

    fixture.offscreen.playAudio('https://cdn.example/a.mp3');
    fixture.offscreen.playAudio('https://cdn.example/a.mp3');

    assert.equal(fixture.created.length, 1, 'a repeated url must reuse its element');
    assert.equal(fixture.created[0].plays, 2, 'and it must be played again from the start');
});