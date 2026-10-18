const ODH_CSS_BANNED_COMPOUNDS = new Set(['html', 'body', ':root', '*']);

const ODH_CSS_BANNED_SELECTOR_TOKENS = ['.icons', '.hidden'];

function odhSelectorCompoundIsBanned(compound) {
    if (ODH_CSS_BANNED_COMPOUNDS.has(compound)) {
        return true;
    }
    if (compound.includes('#')) {
        return true;
    }
    if (/odh-|spell-|icon-/.test(compound)) {
        return true;
    }
    return ODH_CSS_BANNED_SELECTOR_TOKENS.some((token) => compound.includes(token));
}

function odhSelectorIsBanned(selector) {
    return selector
        .trim()
        .toLowerCase()
        .split(/[\s>+~]+/)
        .some(odhSelectorCompoundIsBanned);
}

function filterStyleRule(rule) {
    const selectors = rule.selectorText.split(',');
    const kept = selectors.filter((selector) => !odhSelectorIsBanned(selector));
    if (kept.length === 0) {
        return false;
    }
    if (kept.length !== selectors.length) {
        try {
            rule.selectorText = kept.join(',');
        } catch {
            return false;
        }
    }
    return true;
}

function filterStyleSheet(sheet) {
    const rules = sheet.cssRules;
    for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i];
        if (rule.type !== CSSRule.STYLE_RULE || !filterStyleRule(rule)) {
            sheet.deleteRule(i);
        }
    }
}

function filterDictionaryStyles() {
    for (const style of document.querySelectorAll('style')) {
        if (style.sheet) {
            filterStyleSheet(style.sheet);
        }
    }
}
