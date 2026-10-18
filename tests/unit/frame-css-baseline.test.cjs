const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const frameCss = fs.readFileSync(path.resolve(__dirname, '../../src/fg/css/frame.css'), 'utf8');

// The dictionary baseline at the end of frame.css is what a dictionary falls back to when it
// ships no CSS. Two properties of that block are load-bearing and easy to break by accident:
// the selectors stay bare (a higher-specificity prefix would outrank the dictionary's own
// stylesheet everywhere) and no declaration uses !important (a dictionary that does use it
// must still win). Both are asserted here because the failure would be silent in the browser.

const baselineSelectors = [
    'span.star', 'span.pos', 'span.tran', 'span.eng_tran', 'span.chn_tran',
    'ul.sents', 'li.sent', 'span.eng_sent', 'span.chn_sent'
];

function ruleText(selector) {
    const pattern = new RegExp(`(?:^|[}\\s,])${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm');
    const match = frameCss.match(pattern);
    return match ? match[1] : null;
}

test('the dictionary baseline covers the shared selectors', () => {
    const missing = baselineSelectors.filter((selector) => ruleText(selector) === null);
    assert.deepEqual(missing, [], 'every shared dictionary selector needs a baseline rule');
});

test('the baseline keeps bare selectors so a dictionary stylesheet can still win', () => {
    const prefixed = baselineSelectors.filter((selector) =>
        new RegExp(`\\.odh-notes\\s+${selector.replace('.', '\\.')}\\s*\\{`).test(frameCss));
    assert.deepEqual(prefixed, [], 'a .odh-notes prefix would raise specificity above the dictionary');
});

test('the baseline never uses !important', () => {
    const offenders = baselineSelectors.filter((selector) => {
        const body = ruleText(selector);
        return body !== null && body.includes('!important');
    });
    assert.deepEqual(offenders, [], '!important would beat a dictionary that sets it itself');
});

test('the baseline is a trailing section outside the odh- namespace', () => {
    const lastOwnRule = frameCss.lastIndexOf('.highlight {');
    const firstBaselineRule = frameCss.indexOf('span.star {');
    assert.ok(lastOwnRule !== -1 && firstBaselineRule > lastOwnRule,
        'the baseline is a trailing section, not interleaved with the extension UI rules');
    for (const selector of baselineSelectors) {
        assert.ok(!selector.includes('odh-'), 'baseline selectors must not target extension UI classes');
    }
});