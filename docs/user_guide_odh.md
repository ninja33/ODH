# User Guide

English | [中文](user_guide_odh.zh.md)

This page is for **end users**: how to install, how to look up a word, what each options-page section controls, and how to create cards.

To write dictionary scripts see the [dictionary script guide](dev_guide_uds.md); to change the extension itself see the [ODH developer guide](dev_guide_odh.md).

## 1. Installation

| Channel | Address |
| --- | --- |
| Chrome Web Store | [Online Dictionary Helper](https://chrome.google.com/webstore/detail/anki-online-dictionary-he/lppjdajkacanlmpbbcdkccjkdbpllajb?hl=en) |
| Firefox Add-ons | [Online Dictionary Helper](https://addons.mozilla.org/en-US/firefox/addon/online-dictionary-helper/) |

You can also load a development build from source — see the [ODH developer guide](dev_guide_odh.md).

> **About Firefox**: the current source depends on `chrome.offscreen` and `chrome.runtime.getContexts`, and the Firefox package is not verified in this repository. Firefox users should use the version on the Add-ons page.

## 2. Basic usage

1. Open any web page (including PDFs inside the pdf.js viewer)
2. Move the cursor over the word you want, then pick one:
   - **drag-select** the word
   - **double-click** the word
   - hover the word and press the **hotkey** (default `Shift`)
3. A popup with definitions appears next to the word

**When the word is a link**, drag-selecting navigates away. Use the hotkey instead, or hold <kbd>Alt</kbd> while selecting.

Press <kbd>Esc</kbd> to close the popup.

## 3. What the popup shows

| Element | Notes |
| --- | --- |
| Word | the text you selected |
| Reading | phonetics from the dictionary; may be empty |
| Star rating | from the dictionary; may be empty |
| Audio buttons | shown when audio exists; click to play |
| Definitions | may span several parts of speech and several entries |
| Examples | count controlled by the **Max.Example#** option |
| Green **+** | card creation. Rendered disabled until Anki is connected |
| Context area | editable; card creation submits what you edited |

## 4. Options page — General

Open the options page from the extension icon ("Options") or from the extension card in the browser's extension manager.

| Item | Effect |
| --- | --- |
| Enabled | master switch; when off, selection does nothing |
| Mouse Sel. | when off, only the hotkey works — hover-select and double-click do nothing |
| AutoSel.Hotkey | `Off` / `Shift` / `Ctrl` / `Alt`. `Off` means no hotkey |
| Selected Dict. | pick one of the loaded dictionaries |
| Mono/Bilingual | bilingual shows both original and translated definitions; monolingual shows only the original |
| Audio Pref. | which audio source card creation uses |
| Max.Context# | how many sentences to extract from page context, `1`–`3` |
| Max.Example# | how many example sentences to show, `0`–`2` |

## 5. Options page — Services (Anki)

The **configuration panels** here depend on the selected service, but the **Data Export** dropdown and the status line are always visible.

**Step one: choose the service.** Pick `Ankiconnect` under **Data Export**. With `None` selected only the panels below are hidden — the dropdown and status line remain.

After choosing `Ankiconnect`, the URL and connect panel appears:

| Item | Effect |
| --- | --- |
| Connect URL | AnkiConnect address, default `http://127.0.0.1:8765` |
| Connect | tests the connection |

Connection state is shown in the status line beside **Data Export**, in one of three forms: `connecting…`, `connected: <version>`, `not connected`. **On failure the status line turns to "not connected" but stays visible** — it is your only feedback for diagnosing the problem.

Deck, model and field mappings appear **only after a successful connection**:

| Item | Effect |
| --- | --- |
| Deck Name | which deck the card goes into |
| Type Name | which note type to use |
| Expression / Reading / Definition / Definitions | field mappings |
| Sentence / ExtraInfo / URL / Audio | the remaining field mappings |
| Note Tags | card tags, space-separated |
| Allow Duplicate | whether the same card may be added twice |

The table above is the complete set of field mappings. A blank mapping means that field is not written.

> The legacy `ankiweb` service has been removed; such a configuration shows as no service selected.

## 6. Options page — Scripts

| Area | Effect |
| --- | --- |
| User Defined Scripts | paste your script address and click **Load Scripts**. Address rules are in section 4 of the [dictionary script guide](dev_guide_uds.md) |
| System Scripts | the scripts shipped with the extension. Each row has an **Onoff** and a **Cloud** checkbox |
| Onoff | checked = this dictionary is loaded |
| Cloud | checked = fetch from the `master` branch on GitHub instead of the copy inside the extension |

The first row (the built-in dictionary) has both boxes fixed and unchangeable — it is the fallback dictionary.

> **Editing a script's content does not make "Load Scripts" refetch it.** The extension reloads only when the script name list changes. To force a refetch, nudge the address in the input and change it back, or click "Reload" on the extension card.

## 7. Creating cards

**Prerequisites**: install [Anki](https://apps.ankiweb.net/) and the [AnkiConnect](https://github.com/FooSoft/anki-connect) add-on, keep Anki running, and configure the service, deck, model and field mappings on the options page.

Procedure:

1. Select a word and wait for the popup
2. Check that the definitions and reading look right
3. Edit the sentence in the context area at the bottom if needed
4. Click the green **+** next to one definition
5. The button briefly becomes a spinner, then a tick on success or a cross on failure, reverting after one second

**The green + belongs to a single definition.** To add every definition of the entry, use the "all definitions" mapping; for one definition, the "single definition" mapping.

## 8. Troubleshooting

**No popup when selecting**

- The extension is off (check the toolbar icon's master switch, or toggle with the extension shortcut `Alt+Q`)
- **Mouse Sel.** is off and you did not press the hotkey
- The selection was judged invalid (lookup does not work inside some `iframe`s, `canvas`, or browser-internal pages)
- The word is a link and you drag-selected — use the hotkey
- The extension was just updated while this page was already open: reload the page

**Anki shows "not connected"**

- Anki is not running, or AnkiConnect is not installed
- The AnkiConnect port is not `8765`, or the address is wrong
- A firewall is blocking the loopback port

**Card creation shows a cross**

- The deck or model name does not match what Anki actually has
- Field mappings do not line up with the model's fields
- Duplicates are disallowed and this card already exists — allow duplicates, or delete the existing card

**No definition found**

- The current dictionary does not contain this word — try another
- That dictionary's script is broken (site changed) — try another
- If the built-in dictionary data is missing, built-in dictionaries find nothing; external scripts are unaffected

**Popup styling looks broken**

- Some sites have a strict CSP that blocks dictionary styles. This is a known limitation
- A dictionary script's CSS using `#id` or `body` selectors is filtered out by design — see section 9 of the [dictionary script guide](dev_guide_uds.md)

## 9. Known limitations

- Minimum Chrome version 116
- The Firefox package and runtime behaviour are not verified in this repository; use the Add-ons version
- Dictionary scripts cannot set request headers (including `Referer`), so some sites refuse them
- There is no per-script permission declaration: verify the source before loading a third-party script
- The 6-second `api.fetch` ceiling is not configurable
