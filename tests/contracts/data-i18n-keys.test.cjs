const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectDir = path.resolve(__dirname, '../..');
const extensionDir = path.join(projectDir, 'src');
const pages = ['src/bg/options.html', 'src/bg/popup.html'];
const locales = ['en', 'zh_CN', 'zh_TW'];

function localeKeys(locale) {
    const file = path.join(extensionDir, '_locales', locale, 'messages.json');
    return new Set(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))));
}

// Read once: the assertions below would otherwise re-parse every locale file per key.
const keysByLocale = new Map(locales.map(locale => [locale, localeKeys(locale)]));

function lineOf(source, index) {
    return source.slice(0, index).split('\n').length;
}

// The page scripts are derived from each page's own <script src> declarations, so a script
// added later is scanned without editing this list. Library code under src/lib is excluded:
// it is vendored third party, and its keys are not ours to fix.
function pageScripts() {
    const scripts = new Set();
    for (const page of pages) {
        const pagePath = path.join(projectDir, page);
        const html = fs.readFileSync(pagePath, 'utf8');
        for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
            const resolved = path.resolve(path.dirname(pagePath), match[1]);
            const relative = path.relative(projectDir, resolved);
            if (relative.startsWith('src/bg/js/')) scripts.add(relative);
        }
    }
    return [...scripts].sort();
}

function assertKeyInLocales(key, where) {
    for (const locale of locales) {
        assert.ok(keysByLocale.get(locale).has(key), `${where} is missing from ${locale}`);
    }
}

// WHY: a key that exists in the HTML but not in the locale renders as an empty string, and
// Chrome reports nothing. The action popup's hotkey label shipped blank for exactly this
// reason: it asked for baHotKey while all three locales define baHotkey.
test('every data-i18n key exists in each supported locale', () => {
    let found = 0;
    for (const page of pages) {
        const source = fs.readFileSync(path.join(projectDir, page), 'utf8');
        for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) {
            found += 1;
            assertKeyInLocales(match[1], `${page}:${lineOf(source, match.index)} uses data-i18n="${match[1]}"`);
        }
    }
    assert.ok(found > 0, 'expected at least one data-i18n element');
});

// WHY: the same failure reaches the page through getMessage() literals, which no HTML scan
// sees. NOTE: a key passed as a variable (options.js builds one from a script name) cannot
// be checked statically; that call site is a known blind spot, and this test says nothing
// about it.
test('every getMessage key literal exists in each supported locale', () => {
    let found = 0;
    for (const script of pageScripts()) {
        const source = fs.readFileSync(path.join(projectDir, script), 'utf8');
        for (const match of source.matchAll(/getMessage\(\s*'([^']+)'/g)) {
            found += 1;
            assertKeyInLocales(match[1], `${script}:${lineOf(source, match.index)} calls getMessage('${match[1]}')`);
        }
    }
    assert.ok(found > 0, 'expected at least one getMessage literal');
});
