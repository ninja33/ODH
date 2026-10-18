const assert = require('node:assert/strict');
const test = require('node:test');
const { loadClassic } = require('../helpers/load-classic.cjs');

// The frame filter walks the CSSOM of every dictionary <style> block. jsdom's CSSOM is a
// different implementation from Chrome's, and the rule objects it hands back cannot express
// the case that matters most here — a selectorText the browser refuses to rewrite — so the
// contract is pinned with rule doubles: which rules survive, which are rewritten, which are
// dropped.

const STYLE_RULE = 1;
const IMPORT_RULE = 3;

// A CSSStyleRule keeps the selector and the declarations apart: selectorText is the selector
// only. The doubles copy that shape, because it is what makes the '#' check safe — a hex
// colour lives in the declarations and is never scanned as a selector.
function styleRule(selector, declarations = 'color:red', { refuseRewrite = false } = {}) {
    const rule = { type: STYLE_RULE, selectorText: selector, cssText: `${selector} {${declarations}}` };
    if (refuseRewrite) {
        Object.defineProperty(rule, 'selectorText', {
            get: () => selector,
            set: () => { throw new Error('invalid selector'); },
            enumerable: true
        });
    }
    return rule;
}

function filterSheet(rules) {
    const sheet = { cssRules: rules, deleteRule(index) { this.cssRules.splice(index, 1); } };
    const realm = loadClassic('src/fg/js/frame_style.js', 'filterDictionaryStyles', {
        CSSRule: { STYLE_RULE },
        document: { querySelectorAll: () => [{ sheet }] }
    });
    realm();
    return Array.from(sheet.cssRules).map((rule) => rule.selectorText);
}

test('a rule that targets the extension UI is dropped whole', () => {
    const remaining = filterSheet([
        styleRule('.odh-addnote', 'position:fixed; inset:0'),
        styleRule('#odh-popup', 'display:none'),
        styleRule('.icons span', 'color:red'),
        styleRule('.hidden', 'display:none')
    ]);

    assert.deepEqual(remaining, [], 'no selector may reach our own controls');
});

test('document-root and universal selectors are dropped', () => {
    const remaining = filterSheet([
        styleRule('body', 'margin:0'),
        styleRule('html span.star', 'color:red'),
        styleRule(':root', '--x:1'),
        styleRule('*', 'line-height:2')
    ]);

    assert.deepEqual(remaining, []);
});

test('ordinary dictionary selectors are left alone, declarations included', () => {
    const remaining = filterSheet([
        styleRule('span.star', 'color:#FF0000'),
        styleRule('ul.sents', 'padding:5px'),
        styleRule('.entry .pos', 'font-weight:bold')
    ]);

    assert.deepEqual(remaining, ['span.star', 'ul.sents', '.entry .pos'],
        'properties are never touched, and a hex colour in them is not read as an id selector');
});

test('a mixed selector list keeps the allowed parts and drops the rest', () => {
    const remaining = filterSheet([styleRule('span.star, .odh-addnote, ul.sents', 'color:red')]);

    assert.deepEqual(remaining, ['span.star, ul.sents'], 'only the banned selectors are removed');
});

test('at-rules are dropped, so they cannot pull in stylesheets we never see', () => {
    const sheet = {
        cssRules: [
            { type: IMPORT_RULE, href: 'https://cdn.test/x.css' },
            { type: 4, cssText: '@media print { span.star {color:red} }' },
            styleRule('span.star', 'color:red')
        ],
        deleteRule(index) { this.cssRules.splice(index, 1); }
    };
    const realm = loadClassic('src/fg/js/frame_style.js', 'filterDictionaryStyles', {
        CSSRule: { STYLE_RULE },
        document: { querySelectorAll: () => [{ sheet }] }
    });

    realm();

    assert.deepEqual(Array.from(sheet.cssRules).map((rule) => rule.selectorText), ['span.star']);
});

test('a rule whose selector list cannot be rewritten is dropped whole', () => {
    // The browser throws when splitting the list leaves it invalid, for instance a comma
    // inside :not() or an attribute value; that rule goes with it instead of staying
    // half-filtered.
    const remaining = filterSheet([
        styleRule(':not(a, b), .odh-addnote', 'color:red', { refuseRewrite: true }),
        styleRule('span.star', 'color:red')
    ]);

    assert.deepEqual(remaining, ['span.star'], 'fail closed on the broken rule only');
});