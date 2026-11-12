# Third-party licenses

This project ships one third-party library. It is vendored as a fixed, already
minified file so the extension can load it without a build step.

## DOMPurify 3.4.11

| Item | Value |
| --- | --- |
| Upstream | <https://github.com/cure53/DOMPurify> |
| Version tag | `3.4.11` |
| Vendored file | `src/lib/purify-3.4.11.min.js` |
| Size | 28,438 bytes |
| SHA-256 | `dbabb5b205a333ec49c8c09e7fca30ef66df0523bb8bc0fa9ea843841f111dbd` |
| License | Apache License 2.0 **or** Mozilla Public License 2.0 (dual) |
| Copyright | Cure53 and other contributors |

The vendored file carries the same declaration in its header comment
(`@license DOMPurify 3.4.11 | (c) Cure53 and other contributors | Released under
the Apache license 2.0 and Mozilla Public License 2.0`).

This project uses only `DOMPurify.sanitize()`, through `src/lib/sanitize.js`, to
clean dictionary results before they reach the popup or Anki. It does not use the
library's DOM query or manipulation features, and it does not modify the vendored
file.

Full license texts:

- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0>
- Mozilla Public License 2.0: <https://www.mozilla.org/en-US/MPL/2.0/>

## Historical

`jQuery 3.0.0` (MIT) was vendored until it was removed in the jQuery-removal
work. It no longer ships, so it is not listed above.
