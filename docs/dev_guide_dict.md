# Built-in Dictionary Data Format

English | [中文](dev_guide_dict.zh.md)

This page documents the two data files used by built-in dictionaries, and how to test against them.

**First, one thing to understand**: a built-in dictionary is not a special species — it is [a dictionary script](dev_guide_uds.md) like any other. The only difference is how it gets data: built-in dictionaries read local files through `api.getBuiltin(dict, word)`, external ones call `api.fetch(url)`. Everything else is identical: the same `findTerm()`, the same note structure, the same sanitisation.

## 1. The two data files

| Data | Purpose | Read by |
| --- | --- | --- |
| Entries `bg/data/<dictionary>.json` | definition lookup | a built-in script's `findTerm()` → `api.getBuiltin()` |
| Word forms `bg/data/<wordforms>.json` | morphological reduction | `api.deinflect()` |

These files are outside Git and are not distributed with the source. **Their absence does not affect loading the extension, nor external script development** — it only means built-in dictionaries find no words.

## 2. Top-level entry structure

An object keyed by headword:

```json
{
    "wug": {
        "star": "★★★☆☆",
        "readings": ["wʌɡ"],
        "defs": [ ... ]
    }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `star` | string | Star rating like `"★★★☆☆"`. **An empty string means no rating.** The fixture uses a number here — see section 6 |
| `readings` | string array | Phonetics. May be empty |
| `defs` | array | Definitions, next section. **May be empty** |

Empty arrays do occur in real data. **Scripts must tolerate empty arrays** — never assume an entry has content.

## 3. `defs[]` element structure

```json
{
    "pos_cn": "名词",
    "pos_en": "N-COUNT",
    "def_cn": "一种仅用于自动化测试的虚构物体。",
    "def_en": "An imaginary object used only in automated tests.",
    "ext": [
        { "ext_cn": "这项测试包含一个虚构物体。", "ext_en": "This test contains one wug." }
    ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `pos_cn` | string | Chinese part of speech. **Present in real data, absent in the fixture** — see section 6 |
| `pos_en` | string | English part of speech |
| `def_cn` | string | Chinese definition |
| `def_en` | string | English definition |
| `ext` | array | Example sentences, next section |

**In real data every one of these fields is present — not a single missing field. But string values may be empty strings.**

It is common for one field to carry a value while another is empty (English part of speech present, Chinese absent, for instance). So the test is **whether the value is empty**, not **whether the field exists**:

```javascript
// right
let pos = def.pos_cn ? `<span class="pos">${def.pos_cn}</span>` : '';

// wrong — the field exists but may be ""
if (def.pos_cn !== undefined) { ... }
```

## 4. `ext[]` element structure

| Field | Type |
| --- | --- |
| `ext_en` | string |
| `ext_cn` | string |

Either may be an empty string.

## 5. Word forms structure

Keyed by inflected form, valued by lemma:

```json
{
    "biennials": "biennial"
}
```

**The value may be a string or an array.** Real data uses strings throughout; the repository's test fixture uses arrays (`"wugged": ["wug"]`). Branch on the value type and tolerate both:

```javascript
let stem = await api.deinflect(word);
let forms = [].concat(stem || []);
```

## 6. Complete samples

Two structural samples you can open directly:

- [`tests/fixtures/collins.json`](../tests/fixtures/collins.json) — 849 B, two invented entries
- [`tests/fixtures/wordforms.json`](../tests/fixtures/wordforms.json) — 109 B, four mappings

**These are test fixtures, not release data.** The words are real; the definitions are invented. Enough to see the shape, not something to use as a dictionary.

**The fixture differs from real data in three places**, and copying the fixture blindly produces incompatible code:

| Item | Fixture | Real data |
| --- | --- | --- |
| `star` | number (`1`, `0`) | string (`"★★★☆☆"`, empty string for none) |
| `pos_cn` | **absent** | present, may be an empty string |
| `wordforms` value | array (`["wug"]`) | string (`"biennial"`) |

So branch on type for `star` and `wordforms`, and **never assume `pos_cn` exists**.

## 7. Built-in dictionaries are scripts too

`src/dict/builtin_encn_Collins.js` is the most complete reference:

- `findTerm()` first calls `api.deinflect()` for word forms, then `api.getBuiltin()` for each candidate
- parses the returned JSON string itself
- assembles a note whose `css` styles stars, parts of speech and examples
- `displayName()` uses `api.locale()` to emit a three-language name

## 8. Testing it yourself

Three layers, lightest first:

1. **Pure data validation** — read the JSON in Node and check structure and field types

   ```bash
   node -e 'const d=require("<your data file>.json"); console.log(Object.keys(d))'
   ```

   If you have no real data yet, stand in the two fixtures from section 6 by swapping the path.

2. **Script logic** — feed the fixture to your parsing function in Node; no browser needed

3. **End to end** — after the extension loads, call it directly in the sandbox console

   ```javascript
   await api.getBuiltin('<dictionary>', '<word>')
   ```

   Replace `<dictionary>` with the data identifier you registered and `<word>` with a headword. How to open the sandbox console: see section 10 of the [dictionary script guide](dev_guide_uds.md).

## 9. Adding a built-in dictionary

This is a **code change**, not configuration:

1. Register a new data slot in `loadData()` in `src/bg/js/builtin.js`
2. Add `src/dict/builtin_<name>.js`, reading `api.getBuiltin('<name>', word)`
3. Put the data file under `bg/data/` (outside Git; it has to be distributed separately)
4. To activate it by default, add it to the default `sysscripts` in `src/bg/js/utils.js` and to the fixed script list in `src/bg/js/options.js`

Registering the slot in step 1 and adding the script in step 2 are two halves of one job. The `dict` argument of `getBuiltin(dict, word)` is an ordinary selector — as many slots as you register, that many valid values.
