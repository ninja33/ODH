const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// playSound runs in the content script, so this is where a dictionary sound the browser
// refuses is discovered. The Audio stub stands in for the media element; the promise play()
// returns is real, because that rejection is exactly what used to escape as an uncaught error.

function frontendFixture({ play } = {}) {
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
        document: { addEventListener: () => { } },
        window: { addEventListener: () => { } },
        chrome: { runtime: { onMessage: { addListener: () => { } }, getURL: (path) => `chrome-extension://synthetic/${path}` } },
        Popup: class { },
        FrontendAPI: class { }
    };

    // frontend.js ends by assigning itself to `window`, which is the stub above rather than
    // the realm global, so the instance is read back through that same stub.
    return { frontend: loadClassic('src/fg/js/frontend.js', 'window.odh_frontend', context), warnings, created };
}

test('a sound the browser refuses is reported instead of escaping as an unhandled rejection', async () => {
    const rejections = [];
    const collect = (reason) => rejections.push(reason);
    process.on('unhandledRejection', collect);
    const failure = Object.assign(new Error('The element has no supported sources.'), { name: 'NotSupportedError' });
    const fixture = frontendFixture({ play: () => Promise.reject(failure) });

    try {
        fixture.frontend.api_playSound({ sound: 'https://cdn.example/refused.mp3' });
        // Two turns: one for the rejection to be reported, one for it to settle as unhandled
        // had nothing handled it.
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));
    } finally {
        process.off('unhandledRejection', collect);
    }

    assert.deepEqual(Array.from(rejections), [], 'api_playSound must handle the rejection itself');
    assert.equal(fixture.warnings.length, 1, 'the failure must be reported once');
    assert.equal(fixture.warnings[0][1], 'https://cdn.example/refused.mp3',
        'the report must name the URL that failed, which is the part a dictionary author needs');
    assert.equal(fixture.warnings[0][2], 'NotSupportedError', 'the report must keep the failure kind');
});

test('the same sound url is replayed from one cached element', async () => {
    const fixture = frontendFixture();

    fixture.frontend.api_playSound({ sound: 'https://cdn.example/a.mp3' });
    fixture.frontend.api_playSound({ sound: 'https://cdn.example/a.mp3' });

    assert.equal(fixture.created.length, 1, 'a repeated url must reuse its element');
    assert.equal(fixture.created[0].plays, 2, 'and it must be played again from the start');
});