# ODH Developer Guide

English | [中文](dev_guide_odh.zh.md)

This guide is for developers **changing the extension itself**: how to run the source, which checks to run, how the tree is laid out, how to submit.

Architecture, the message chain and the sandbox mechanism live in the [README](../README.md); this page does not repeat them.

## 1. Requirements

| Item | Requirement |
| --- | --- |
| Node | 24.x (see `.nvmrc`; exactly 24.21.0 there) |
| npm | 11.x (see `engines` and `packageManager` in `package.json`) |
| Chrome | ≥ 116 (see `minimum_chrome_version` in `src/manifest.json`) |

There is no build step. The extension is the HTML, CSS, JavaScript and assets under `src/`; the browser loads them directly.

The dev dependencies in `package.json` (ESLint, jsdom, globals) serve checks and tests only and never enter the extension runtime.

## 2. Running the extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this repository's `src/` directory

**Measured limitation**: recent Chrome (157 in our tests) ignores the command-line `--load-extension` flag. Loading from the command line does not work; the three steps above are the only route. To debug against a clean profile, start Chrome with `--user-data-dir=<temp dir>` and load manually.

After editing anything under `src/`, click **Reload** on the extension card in `chrome://extensions`.

## 3. Local dictionary data

The built-in dictionary data files are not in the repository. **Their absence does not affect loading the extension or developing external dictionary scripts** — built-in dictionaries simply find no words, and the selected dictionary falls back to the first available script.

External dictionary scripts (the ones scraping online dictionaries through `api.fetch`) do not depend on local data at all; a fresh clone can run them.

Data format: [built-in dictionary data format](dev_guide_dict.md).

## 4. Checks and tests

From the repository root:

```bash
npm ci
npm run lint
npm run test:contracts
npm run test:unit
```

| Command | Coverage |
| --- | --- |
| `npm run lint` | ESLint over the whole tree with `--max-warnings=0`. Errors and warnings both fail |
| `npm run test:contracts` | public JSON parses, manifest entries/resources/load order, the `src/lib` jQuery filename guard, three-locale `data-i18n` key coverage |
| `npm run test:unit` | Builtin/Deinflector after data load, storage confirmation, dictionary-config dispatch, settings-page event branches, envelope and transport deadlines, Anki requests, message boundaries, note sanitisation, CSS filtering |

Single-file checks:

```bash
./node_modules/.bin/eslint <file> --max-warnings=0
node --check <file>
```

Tests read only the invented fixtures under `tests/fixtures/`; they never touch real data, configuration, Anki or the network.

## 5. Directory layout

```text
src/
├── manifest.json          Manifest V3 declaration
├── _locales/              en / zh_CN / zh_TW copy
├── bg/
│   ├── js/                service worker, offscreen, settings-page logic
│   ├── sandbox/           the manifest sandbox page (runs dictionary scripts)
│   ├── data/              local dictionary data (outside Git)
│   ├── options.html       options page
│   ├── popup.html         action popup
│   └── guide.html         built-in usage notice
├── fg/
│   ├── js/                content scripts and the in-page popup
│   ├── css/               their styles
│   ├── img/               popup icons
│   └── font/              popup font
├── dict/                  dictionary scripts
├── lib/                   vendored third-party (DOMPurify) and shared internals
└── img/                   extension icons
tests/
├── contracts/             contract tests
├── unit/                  unit tests
└── fixtures/              invented test data
docs/                      public documentation (paired EN/ZH)
```

## 6. Verifying in the browser

| Change area | What to verify |
| --- | --- |
| Content scripts (`src/fg/`) | select text on any page → popup appears → definitions correct → card button behaves |
| Settings pages (`src/bg/options.html`, `popup.html`) | three tabs switch, controls show current values, edits save |
| Sandbox and dictionary scripts (`src/bg/sandbox/`, `src/dict/`) | a script loads from the options page and a lookup returns a result |
| Service worker (`src/bg/js/serviceworker.js`) | the first lookup after an extension restart returns; a lookup after idle time still returns |
| Anki paths | connection state correct, cards written to the right fields |

Do not re-run the whole chain for unrelated changes. Pure documentation and rule edits need no browser verification.

## 7. Submitting a PR

- Touch `src/` and `tests/` only. Documentation changes under `docs/` go in their own commit
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `feat` / `fix` / `refactor` / `test` / `docs` / `chore`, with a short English description
- One commit does one thing
- Adding or reordering static content scripts requires updating the `content_scripts.js` array order in `src/manifest.json`
- Adding a dictionary script requires registering it in `classicExports` of `eslint.config.mjs`, otherwise lint reports unused variables
- User-facing text goes through i18n: add the key to all three `messages.json` files, use `data-i18n` in pages and `chrome.i18n.getMessage()` in JS

## 8. Code conventions, essential points

The full rules live inside the repository; the core points for outside contributors:

- **4-space indent, single quotes, semicolons**
- Classic scripts: no `import` / `export` (the service worker uses `importScripts()`, dictionary scripts are dynamically `eval`-loaded)
- No jQuery and no framework — native DOM APIs only. `src/lib/purify-3.4.11.min.js` is the sole third-party library and only its `sanitize()` is used
- Global symbols consumed from other scripts go in a `/* global A, B */` comment at the top of the file
- The service worker has no `window`, `document`, `Audio` or `DOMParser` — DOM code belongs in the offscreen document or a content script
- Comments are in English and explain *why*, not *what*

## 9. Known limitations

- **No build pipeline**: the browser loads `src/` directly — no bundling, no transpiling. Confirm Chrome 116 support before using newer syntax
- **Firefox unverified**: the code depends on `chrome.offscreen` and `chrome.runtime.getContexts`, which have no Firefox equivalent
- **Split dictionary shard files have no code references**: the source currently reads only the entry data and the word-forms table under `bg/data/`
- **The 6-second `api.fetch` ceiling is not configurable**
- The extension declares no `host_permissions`; cross-origin requests are handled as ordinary cross-origin requests
