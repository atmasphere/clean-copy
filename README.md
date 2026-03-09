# Clean Copy

A Chrome extension that extracts clean article text from any webpage — no ads, no popups, no copy protection. Read it in a side panel or copy it as Markdown, plain text, or clean HTML.

Chrome's built-in Reading Mode renders clean text but blocks copy/paste. Clean Copy gives you a reading panel that's fully selectable and copyable, with article extraction that strips ads, sponsored content, and newsletter CTAs before they hit the page.

## Features

- **Reading panel** — slides in from the right side of the page with clean article text
- **Copy as Markdown** — one click or `Cmd+Shift+C` / `Ctrl+Shift+C`
- **Copy as plain text or HTML** — via the toolbar popup
- **Theme toggle** — light, dark, and sepia modes
- **Font controls** — sans-serif, serif, or monospace; adjustable size
- **Ad stripping** — pre-cleans the DOM before extraction, post-cleans the output, and uses CSS safety nets to collapse anything that slips through

## How it works

1. Strips ad containers, sponsored content, and non-article elements from a cloned DOM (while class/ID names are still intact)
2. Runs [Mozilla Readability](https://github.com/nicovideo/nicehash) to extract the article
3. Post-processes with an allowlist — only keeps known content elements (paragraphs, headings, lists, tables, etc.)
4. Merges sentence fragments that were split by inline ad insertion
5. Renders in a shadow DOM panel so page styles can't interfere

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `clean-copy` folder

## Usage

| Action | How |
|--------|-----|
| Open reading panel | `Cmd+Shift+R` / `Ctrl+Shift+R` or click extension icon → **Read Clean** |
| Copy as Markdown | `Cmd+Shift+C` / `Ctrl+Shift+C` |
| Copy as plain text | Click extension icon → **Copy as Plain Text** |
| Copy as clean HTML | Click extension icon → **Copy as Clean HTML** |
| Toggle theme | Click the sun/moon icon in the panel toolbar |
| Close panel | Click `×` or press `Cmd+Shift+R` again |

## Libraries

- [Readability.js](https://github.com/mozilla/readability) (Mozilla, Apache 2.0) — article extraction
- [Turndown](https://github.com/mixmark-io/turndown) (MIT) — HTML to Markdown conversion

## License

MIT
