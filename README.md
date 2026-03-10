# Clean Copy

A Chrome extension that extracts clean article text from any webpage — no ads, no popups, no copy protection. Read it in a side panel or copy it as Markdown, plain text, or clean HTML.

Chrome's built-in Reading Mode renders clean text but blocks copy/paste. Clean Copy gives you a reading panel that's fully selectable and copyable, with article extraction that strips ads, sponsored content, and newsletter CTAs before they hit the page.

## Features

- **Reading panel** — slides in from the right side of the page with clean article text, resizable by dragging the left edge
- **Copy as Markdown** — one click or keyboard shortcut
- **Copy as plain text or HTML** — via the toolbar popup
- **Paywall fallback** — detects truncated/paywalled articles and offers to fetch the full text from archive.today
- **Archive.today detection** — automatically offers to clean up archived pages when you visit them
- **Subscriber-aware** — if you're signed into a site (WSJ, NYT, etc.), extracts the full subscriber content
- **Theme toggle** — light, dark, and sepia modes (sun/moon icons)
- **Font controls** — sans-serif (default), serif, or monospace; adjustable size
- **Ad stripping** — pre-cleans the DOM before extraction, post-cleans the output, and uses CSS safety nets to collapse anything that slips through

## How it works

1. Strips ad containers, sponsored content, and non-article elements from a cloned DOM (while class/ID names are still intact)
2. Runs [Mozilla Readability](https://github.com/mozilla/readability) to extract the article
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
| Open reading panel | `Option+Shift+R` (Mac) / `Alt+Shift+R` (Win) or click extension icon → **Read Clean** |
| Copy as Markdown | `Option+Shift+C` (Mac) / `Alt+Shift+C` (Win) |
| Copy as plain text | Click extension icon → **Copy as Plain Text** |
| Copy as clean HTML | Click extension icon → **Copy as Clean HTML** |
| Toggle theme | Click the sun/moon icon in the panel toolbar |
| Resize panel | Drag the left edge of the panel |
| Paywall fallback | Click **Try archive.today** when prompted |
| Close panel | Click `×` or press `Option+Shift+R` again |

## Paywall fallback

When Clean Copy detects a truncated article (short extracted text or paywall indicators in the page), it shows a **Try archive.today** button. This first attempts an automatic fetch. If archive.today blocks the request, you get two options:

- **Open in archive.today** — opens the cached snapshot in your browser, where Clean Copy's archive banner will detect it
- **Save new copy** — for pages not yet archived (requires completing a CAPTCHA on archive.today)

When you visit an archive.today snapshot page directly, Clean Copy automatically shows a banner offering to open the article in a clean reading panel.

**Note:** This feature retrieves publicly cached copies of web pages for personal reading. It is not intended to systematically circumvent paywalls. If you value a publication's work, consider subscribing.

## Libraries

- [Readability.js](https://github.com/mozilla/readability) (Mozilla, Apache 2.0) — article extraction
- [Turndown](https://github.com/mixmark-io/turndown) (MIT) — HTML to Markdown conversion

## License

MIT
