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
