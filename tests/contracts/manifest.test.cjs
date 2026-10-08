const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const extensionDir = path.resolve(__dirname, '../../src');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
const locales = ['en', 'zh_CN', 'zh_TW'];

function assertResource(resource) {
    assert.equal(typeof resource, 'string');
    const relative = resource.replace(/^\/+/, '');
    assert.ok(relative.length > 0 && !relative.split('/').includes('..'), `Invalid resource: ${resource}`);
    assert.ok(!relative.startsWith('bg/data/'), `Private data is not a public resource: ${resource}`);
    assert.ok(fs.statSync(path.join(extensionDir, relative)).isFile(), `Missing resource: ${resource}`);
}

function* publicResources(directory = '') {
    for (const entry of fs.readdirSync(path.join(extensionDir, directory), { withFileTypes: true })) {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === 'bg/data') continue;
        if (entry.isDirectory()) {
            yield* publicResources(relative);
        } else if (entry.isFile()) {
            yield relative;
        }
    }
}

test('manifest uses MV3 with a classic service worker', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.background.type ?? 'classic', 'classic');
});

test('manifest entrypoints and sandbox pages exist', () => {
    for (const resource of [
        manifest.background.service_worker,
        manifest.action.default_popup,
        manifest.options_ui.page,
        ...manifest.sandbox.pages
    ]) {
        assertResource(resource);
    }
});

test('content script JavaScript and CSS resources exist', () => {
    assert.ok(manifest.content_scripts.length > 0);
    for (const contentScript of manifest.content_scripts) {
        for (const resource of [...contentScript.js, ...contentScript.css]) {
            assertResource(resource);
        }
    }
});

test('content scripts preserve the classic global dependency order', () => {
    assert.deepEqual(manifest.content_scripts[0].js, [
        'lib/envelope.js',
        // message.js builds on the envelope, so it must load after it and before any client.
        'lib/message.js',
        'fg/js/popup.js',
        'fg/js/range.js',
        'fg/js/text.js',
        'fg/js/frontend_api.js',
        'fg/js/frontend.js'
    ]);
});

test('manifest and action icons exist', () => {
    for (const resource of [
        ...Object.values(manifest.icons),
        ...Object.values(manifest.action.default_icon)
    ]) {
        assertResource(resource);
    }
});

test('web accessible resources resolve to public extension files', () => {
    for (const entry of manifest.web_accessible_resources) {
        assert.ok(entry.resources.length > 0);
        for (const resource of entry.resources) {
            if (!resource.includes('*')) {
                assertResource(resource);
                continue;
            }
            // Chrome's * also matches subdirectories; filesystem globs do not share this behavior.
            const pattern = resource.replace(/^\/+/, '').split('*')
                .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
            const match = new RegExp(`^${pattern}$`);
            assert.ok([...publicResources()].some(file => match.test(file)), `Empty resource pattern: ${resource}`);
        }
    }
});

test('the default locale and three supported message files are present', () => {
    assert.equal(manifest.default_locale, 'en');
    for (const locale of locales) {
        const messages = JSON.parse(fs.readFileSync(path.join(extensionDir, `_locales/${locale}/messages.json`), 'utf8'));
        assert.ok(Object.keys(messages).length > 0);
        for (const [key, value] of Object.entries(messages)) {
            assert.equal(typeof value.message, 'string', `${locale}: ${key}`);
            assert.ok(value.message.trim().length > 0, `${locale}: ${key} is empty`);
        }
    }
});

test('every manifest message reference exists in each supported locale', () => {
    const keys = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)]
        .map(match => match[1]);
    assert.ok(keys.length > 0);
    for (const locale of locales) {
        const messages = JSON.parse(fs.readFileSync(path.join(extensionDir, `_locales/${locale}/messages.json`), 'utf8'));
        for (const key of new Set(keys)) {
            assert.ok(Object.hasOwn(messages, key), `${locale}: missing ${key}`);
        }
    }
});

test('supported locales share the same message keys', () => {
    const keyLists = locales.map(locale => {
        const messages = JSON.parse(fs.readFileSync(path.join(extensionDir, `_locales/${locale}/messages.json`), 'utf8'));
        return Object.keys(messages).sort();
    });
    for (let index = 1; index < locales.length; index += 1) {
        assert.deepEqual(keyLists[index], keyLists[0], `${locales[index]}: inconsistent message keys`);
    }
});

// Classic scripts are loaded by relative path, from an HTML page or from importScripts.
// A wrong path is invisible to unit tests and only shows up as a dead service worker in
// Chrome, so resolve every declared script reference against the filesystem here.
test('every declared classic script path resolves to a real file', () => {
    const pages = [
        'bg/offscreen.html',
        'bg/options.html',
        'bg/popup.html',
        'bg/sandbox/sandbox.html'
    ];
    const references = [];
    for (const page of pages) {
        const html = fs.readFileSync(path.join(extensionDir, page), 'utf8');
        for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
            references.push({ from: page, reference: match[1] });
        }
    }
    // importScripts resolves against the worker script's own directory, not the extension root.
    const worker = 'bg/js/serviceworker.js';
    const workerSource = fs.readFileSync(path.join(extensionDir, worker), 'utf8');
    for (const match of workerSource.matchAll(/importScripts\('([^']+)'\)/g)) {
        references.push({ from: worker, reference: match[1] });
    }
    assert.ok(references.length > 0, 'expected at least one declared classic script');
    for (const { from, reference } of references) {
        if (!reference.startsWith('.')) continue; // extension-root paths are checked elsewhere
        const resolved = path.resolve(path.dirname(path.join(extensionDir, from)), reference);
        assert.ok(fs.statSync(resolved).isFile(), `${from} references a missing script: ${reference}`);
    }
});

// --- classic script dependencies ------------------------------------------------------
// A classic script can only use what an earlier script in the same realm defined. Loading the
// envelope without the request helpers, or in the wrong order, has already broken two contexts
// once, and no JS test can see it: the realm under test is built by the test itself.

// Names lib/*.js provides through the shared classic globals.
const libExports = {
    'lib/envelope.js': ['ODH_DEFAULT_REQUEST_TIMEOUT_MS', 'odhErrorMessage', 'odhLog', 'odhError', 'odhOk', 'odhFail', 'odhIsEnvelope', 'odhUnwrap'],
    'lib/message.js': ['odhWithTimeout', 'odhSendMessage', 'odhPostMessage', 'TO_WORKER', 'TO_OFFSCREEN', 'TO_FRONTEND'],
    'lib/agent.js': ['Agent']
};

// A lib file can itself use another one, so the order among them matters too: message.js calls
// the envelope's helpers, which only exist if envelope.js ran first.
const libRequires = {
    'lib/message.js': ['lib/envelope.js'],
    'lib/envelope.js': [],
    'lib/agent.js': []
};

function scriptSource(relative) {
    return fs.readFileSync(path.join(extensionDir, relative), 'utf8');
}

// The library helpers a script uses. Whole-word matches keep odhOk from matching odhOkHttp.
function usedLibHelpers(relative) {
    const source = scriptSource(relative);
    const used = new Set();
    for (const [lib, names] of Object.entries(libExports)) {
        for (const name of names) {
            if (new RegExp(`\\b${name}\\b`).test(source)) used.add(`${lib}:${name}`);
        }
    }
    return used;
}

// Asserts that `names` (already loaded in order) satisfy every library helper `consumer` uses,
// and that the deciding library is loaded before the consumer.
function assertSatisfied(consumer, loaded, label) {
    const providers = new Map();
    for (const entry of loaded) {
        for (const [lib, names] of Object.entries(libExports)) {
            if (entry.endsWith(lib)) for (const name of names) providers.set(name, true);
        }
    }
    for (const requirement of usedLibHelpers(consumer)) {
        const [lib, name] = requirement.split(':');
        assert.ok(providers.has(name),
            `${label}: ${consumer} uses ${name}, but ${lib} is not loaded before it`);
    }
}

// Every lib file must itself be satisfied by the libs loaded before it.
function assertLibOrder(loaded, label) {
    for (let i = 0; i < loaded.length; i++) {
        const lib = loaded[i];
        for (const dependency of Object.entries(libRequires)
            .filter(([candidate]) => candidate === lib)
            .flatMap(([, required]) => required)) {
            assert.ok(loaded.slice(0, i).some(entry => entry.endsWith(dependency)),
                `${label}: ${lib} requires ${dependency}, which must load before it`);
        }
    }
}

test('every HTML page loads the lib scripts its own scripts use, in order', () => {
    const pages = [];
    const walk = directory => {
        for (const entry of fs.readdirSync(path.join(extensionDir, directory), { withFileTypes: true })) {
            const relative = directory ? `${directory}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(relative);
            else if (entry.name.endsWith('.html')) pages.push(relative);
        }
    };
    walk('');
    assert.ok(pages.length > 0);
    for (const page of pages) {
        const scripts = [...scriptSource(page).matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
        const loaded = [];
        for (const script of scripts) {
            const resolved = path.relative('', path.resolve(path.dirname(page), script)).replace(/\\/g, '/');
            if (resolved.startsWith('lib/')) { loaded.push(resolved); assertLibOrder(loaded, page); continue; }
            // A page script may use the libs loaded before it, and nothing later.
            assertSatisfied(resolved, loaded, page);
        }
    }
});

test('every content script is satisfied by the lib scripts loaded before it', () => {
    const scripts = manifest.content_scripts[0].js;
    const loaded = [];
    for (const script of scripts) {
        if (script.startsWith('lib/')) { loaded.push(script); assertLibOrder(loaded, 'content_scripts[0]'); continue; }
        assertSatisfied(script, loaded, 'content_scripts[0]');
    }
});

test('the worker imports the lib scripts its own scripts use, in order', () => {
    const loaded = ['lib/envelope.js', 'lib/message.js'];
    assertLibOrder(loaded, 'importScripts');
    assertSatisfied('bg/js/serviceworker.js', loaded, 'importScripts');
});

// --- message targets ------------------------------------------------------------------
// A runtime message names its receiver, and every receiver shares one listener, so a target
// whose value no receiver checks would be silently dropped. The names, values and receivers
// live in three files, which is exactly the kind of drift a contract test can catch.

// The production roots that take part in messaging.
const TARGET_SOURCES = [
    'lib/message.js',
    'bg/js/offscreen.js',
    'bg/js/serviceworker.js',
    'bg/js/options_api.js',
    'fg/js/frontend_api.js',
    'fg/js/frontend.js'
];

test('every message target is declared once and checked by exactly one receiver', () => {
    const declared = new Map();   // constant name -> wire value

    for (const relative of TARGET_SOURCES) {
        const source = scriptSource(relative);
        for (const [, name, value] of source.matchAll(/^const (TO_[A-Z_]+) = '([^']+)';/gm)) {
            assert.equal(declared.has(name), false, `${name} is declared twice`);
            declared.set(name, value);
        }
    }

    assert.ok(declared.size >= 3, `expected the message targets to be declared, found ${declared.size}`);
    // Two names sharing one value would make one address unreachable.
    const values = new Map();
    for (const [name, wire] of declared) {
        assert.equal(values.has(wire), false,
            `${name} and ${values.get(wire)} share the wire value '${wire}'`);
        values.set(wire, name);
    }
    for (const [name, wire] of declared) {
        let receivers = 0;
        for (const relative of TARGET_SOURCES) {
            const source = scriptSource(relative);
            // A receiver that compares against the constant, rather than its literal.
            if (new RegExp(`target != ${name}\\b`).test(source)) receivers += 1;
        }
        assert.equal(receivers, 1,
            `${name} ('${wire}') must be checked by exactly one receiver, found ${receivers}`);
    }
});
