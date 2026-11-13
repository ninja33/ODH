# Dictionary Script Guide

English | [中文](dev_guide_uds.zh.md)

This guide is for **external dictionary script** developers: you want ODH to pull definitions from an online dictionary, or you have your own built-in dictionary data that should render in the popup.

Every dictionary capability in ODH is provided by a script — built-in dictionaries are scripts too; they just read local data instead of making network requests. Learn to write one and you have both.

## 1. What a script is

A dictionary script is a **class**. The extension fetches the script text, evaluates `eval('(' + text + ')')` inside the sandbox to get a constructor, instantiates it with `new`, and registers it under the class name.

```javascript
/* global api */
class encn_MyDict {
    async findTerm(word) {
        return [];
    }
}
```

Three hard constraints:

- The file content must be **a single expression** evaluating to a class. No `export`, no `import`, no top-level statements.
- The class name is the registration ID — see section 3.
- The script runs in a sandbox with **no access to any `chrome.*` API**. It requests capability only through the `api` object — see section 5.

## 2. Minimal working script

```javascript
/* global api */
class encn_MyDict {
    async findTerm(word) {
        let url = `https://example.com/api?word=${encodeURIComponent(word)}`;
        let text = await api.fetch(url);
        if (!text) return [];

        let notes = [];
        let definitions = [];
        try {
            let data = JSON.parse(text);
            definitions.push(data.definition || '');
        } catch (e) {
            // Parse failure: return empty rather than throwing at the user
            return [];
        }
        if (definitions.length === 0) return [];

        notes.push({
            css: '<style>.mydict { color: #0d47a1; }</style>',
            expression: word,
            definitions
        });
        return notes;
    }
}
```

Save it as `encn_MyDict.js`, put its URL under **Scripts → User Defined Scripts** on the options page, click **Load Scripts**, then select it from the dictionary dropdown.

## 3. Naming and registration

**The class name is a persisted ID.** The user's selected dictionary is stored in `storage.local` as `dictSelected`, holding the class name. Renaming breaks saved selections.

Follow `<source><target>_<name>` with two-letter language codes: `encn_Collins` (English→Chinese), `frcn_Youdao` (French→Chinese), `enen_UrbanDict` (English→English).

**File name and class name need not match**; the repository has two such cases:

| File | Class |
| --- | --- |
| `encn_Oxford_bing.js` | `encn_Oxford` |
| `enen_LDOCE6MDX.js` | `encn_LDOCE6MDX` |

That is legacy, not a recommendation. Note that **same-named classes overwrite each other** — if both files above are loaded, the later one replaces the earlier instance.

## 4. How the script address resolves

The name you type on the options page resolves to a URL by string rules, not strict URL parsing:

| You type | Actually requested |
| --- | --- |
| `encn_MyDict` | `chrome-extension://<extension id>/dict/encn_MyDict.js` |
| `lib://encn_Collins` | `https://raw.githubusercontent.com/ninja33/ODH/master/src/dict/encn_Collins.js` |
| `https://your.host/script.js` | used as-is |
| anything without `.js` | `.js` appended automatically |

- The `/dict/` route only makes sense for **scripts shipped inside the extension** — yours is not in the package, so this path does not apply to you.
- `lib://` is an **emergency route**: when the repository already has a fixed script but the new Web Store version is not approved yet, it points straight at the latest script on the `master` branch so you can recover early. Do not rely on it for everyday development.
- Your own script uses a full `https://` address.

## 5. Sandbox API

Scripts run in the manifest-declared sandbox page, an opaque origin that cannot call extension APIs. All capability is exposed on one global `api` object, which currently provides the following methods:

| Method | Returns |
| --- | --- |
| `api.fetch(url)` | response text, or `null` |
| `api.deinflect(word)` | stem result, or `null` |
| `api.getBuiltin(dict, word)` | JSON string of a built-in entry, or `null` |
| `api.locale()` | Chrome UI language, e.g. `zh_CN`, `en` |

These methods all return a Promise and **none of them reject**. Failures are folded into `null` by the wrapper; the classified reason only goes to the console, which scripts cannot read.

### `api.fetch(url)`

The request is issued by the extension's service worker, so **you do not handle CORS** and you cannot set request headers.

Limits:

- **6-second ceiling.** Timeout returns `null`; the original request is not cancelled.
- Only `http`, `https`, and the extension's own `chrome-extension:` resources.
- Link-local addresses (`169.254.x.x`) and cloud metadata endpoints are refused — instance credentials are never a dictionary source.
- IPv6 is not supported.

`null` means "did not get it": network failure, HTTP error, timeout, or refusal. **Treat it as an ordinary failure and return `[]`** — do not throw.

### `api.deinflect(word)`

English morphological reduction. Returns the mapped value or `null`.

**The shape of that value follows the actual data.** Real data uses **strings** (`"biennials"` → `"biennial"`); the repository's test fixture uses **arrays**. Tolerate both:

```javascript
let stem = await api.deinflect(word);
let forms = [].concat(stem || []);
```

### `api.getBuiltin(dict, word)`

Reads built-in dictionary data, returning a JSON string (parse it yourself) or `null`. See [built-in dictionary data format](dev_guide_dict.md).

`dict` is the data identifier of a built-in dictionary; the valid values depend on which built-in dictionaries the extension registers.

### `api.locale()`

Returns the Chrome UI language. Use it for a localized `displayName()`:

```javascript
async displayName() {
    let locale = await api.locale();
    if (locale.indexOf('CN') != -1) return '我的词典';
    if (locale.indexOf('TW') != -1) return '我的詞典';
    return 'My Dictionary';
}
```

## 6. Required member

### `findTerm(expression)`

The only required method. It receives the user's selected word and returns a Promise.

**The return value must be an array of notes.** This is a hard requirement, not a suggestion — see section 8.

Return `[]` when nothing is found:

```javascript
async findTerm(word) {
    if (!word) return [];
    // ...
    return notes;
}
```

Returning a string also works; it is wrapped as a single definition. Arrays give you more control and are recommended.

## 7. Optional members

### `displayName()`

The name shown in the dropdown. May be async (it usually needs `api.locale()`). Falls back to the class name when absent.

### `setOptions(options)`

Receives a copy of the configuration with **sensitive fields removed by a blocklist** (Anki credentials and the like) — dictionaries have no business knowing them. That blocklist is maintained by the extension and may grow; **do not assume the field set you receive is fixed or complete**, and rely only on the fields in the table below that you actually need.

Commonly used fields:

| Field | Meaning |
| --- | --- |
| `maxexample` | example-sentence cap, string `'0'`–`'2'` |
| `maxcontext` | page-context sentence count, string `'1'`–`'3'` |
| `monolingual` | `'0'` bilingual, `'1'` monolingual |
| `preferredaudio` | preferred audio index, `'0'` or `'1'` |
| `dictSelected` | class name of the selected dictionary |

Note that several values are **strings** — call `Number()` before comparing. The return value is not awaited, so do not do async initialization here.

## 8. Note structure and card creation

A note looks like this:

```javascript
{
    css: '<style>...</style>',
    expression: word,
    reading: '/ˈwɜːd/',
    extrainfo: '★★★☆☆',
    definitions: ['first definition', 'second definition'],
    audios: ['https://.../uk.mp3', 'https://.../us.mp3'],
    sentence: '',
    url: ''
}
```

### Which fields actually matter

- **`definitions` must be an array.** Rendering iterates it (`.entries()`); card creation calls `.join('<hr>')` on it. When missing, `buildNote()` fills in an **empty string**, and the sanitiser **keeps strings as strings** (`sanitizeNote` maps arrays element by element and sanitises a non-empty string once, but never converts the type) — so a string reaches the renderer, `.entries()` throws a `TypeError`, and **the popup fails**. So "missing fields get defaults" does not hold for `definitions`; always return an array.
- **`audios` is optional**, filled with `[]` when missing, and an empty array is safe. Entries are ordered **by audio source** (UK, US), not paired with definitions. The popup header renders one button per non-empty entry; clicking the i-th plays `audios[i]`. Card creation picks a source per the **Audio Pref.** option, falling back to index 0 when out of range.
- `css`, `reading`, `extrainfo`, `url` are filled with empty strings when missing — safe.
- `expression` and `sentence` come from the extension, not from you: `expression` is the current selection; `sentence` is first filled from page context into an editable area, and what gets submitted at card creation is **what the user edited**.

### What happens at card creation

When the user clicks the green **+**:

1. The extension builds the "single definition" field from `css + definitions[selected index]`
2. Builds the "all definitions" field from `css + definitions.join('<hr>')`
3. Overwrites `sentence` and `url` with extension-side values
4. Writes fields into Anki per the options-page mapping

**Your `css` travels into the card along with the definitions**, so style for a card as well as a popup — do not rely on popup-only layout.

### Not found vs. error

- **Not found**: return `[]`. This is the success path; the user sees no popup and nothing is logged.
- **Error**: `throw`. This is the failure path, tagged `handler-error`, with a classified log line in the console.

Both look identical to the user — no popup. They differ only in diagnostics. So **do not throw to express "not found"** — that buries real failures among ordinary empty results.

## 9. Sanitisation and safety

Your output is sanitised before it reaches the page. This is enforced behaviour, not advice:

- `css`, `definitions` (both array and string forms), `expression`, `reading`, `extrainfo` pass through DOMPurify with the `style` attribute and four `data-*` attributes banned (`data-nindex`, `data-dindex`, `data-sound`, `data-odh-control`).
- `audios` keeps only `http(s)` URLs; everything else is dropped.
- `sentence` is **not** sanitised — it is the user's own content.

The sanitiser accepts both array and string forms of `definitions`, but **the renderer only accepts arrays**. Do not read "sanitisation did not complain" as "the format is correct".

Your `<style>` gets a second pass through CSSOM filtering when it enters the popup:

- Dropped whole: selectors containing `html`, `body`, `:root`, `*`, any `#id`, or `odh-` / `spell-` / `icon-`
- All at-rules dropped (`@media`, `@import`, …)
- Every other declaration passes

So **use class selectors** (`.mydict-pos`), never `#id`, never `body`.

## 10. Debugging

- Script `console.log` lands in the **sandbox console**, not the page console. In `chrome://extensions`, find this extension and click "Inspect views" on the `bg/sandbox/sandbox.html` row.
- **Editing a script's content on the server does not make "Load Scripts" refetch it.** The extension reloads scripts only when the `sysscripts` / `udfscripts` strings **change**; an unchanged URL counts as unchanged configuration and is skipped. To force a refetch, either:
  - nudge the URL in the input field (create a difference) and change it back, or
  - click "Reload" on the extension card to restart the extension.
- Load failures are recorded per script and do not affect the others. If the selected script fails, the extension falls back to the first available dictionary and logs one `console.info` line naming the switch.

## 11. Loading it on the options page

1. Open the extension's options page and switch to the **Scripts Options** tab
2. Type the script address (full `https://` or a `lib://` name) into **User Defined Scripts**
3. Click **Load Scripts**
4. Go back to **Extension Options** and pick your dictionary in the **Selected Dict.** dropdown

## 12. Reference implementations

`src/dict/` holds a set of working scripts covering various language pairs. Start with the simple ones:

- `general_Makenotes.js` — 38 lines, no network, shows the minimal structure
- `encn_Youdao.js` — fetches and parses HTML through `api.fetch`
- `builtin_encn_Collins.js` — reads local data through `api.getBuiltin`, and demonstrates `displayName()`, `setOptions()`, audio and CSS

## 13. Known limitations

- Scripts **cannot set request headers** (including `Referer`), so some dictionary sites refuse them. There is no workaround today.
- There is no per-script permission declaration: a script can `fetch` any allowed-protocol address and the extension applies no host allowlist on its behalf. Only load scripts you trust.
- The 6-second `api.fetch` ceiling is not configurable.
