// Clean Copy — content script
// Extracts article content using Readability.js, converts to Markdown via Turndown
// Also provides an in-page reading panel

// ── Extraction ─────────────────────────────────────────────────

function extractArticle() {
  const clone = document.cloneNode(true);

  // If on archive.today, strip their toolbar/header first
  if (isArchivePage()) {
    clone.querySelectorAll("#HEADER, .HEADER, #wm-ipp-base, #wm-ipp, #donato, #__top, [id*='archive']").forEach(el => el.remove());
  }

  // Pre-clean the DOM while class/ID names are still intact
  preCleanDOM(clone);

  const reader = new Readability(clone);
  const article = reader.parse();
  if (!article) return null;

  return {
    title: article.title,
    byline: article.byline,
    siteName: article.siteName,
    html: postCleanHTML(article.content),
    excerpt: article.excerpt,
    url: window.location.href
  };
}

// Strip ads, sponsored content, and non-article elements from the DOM
// BEFORE Readability processes it (class/ID names still exist here)
function preCleanDOM(doc) {
  // Hard-remove: ad delivery infrastructure. These never contain article text.
  const hardAdPattern = /ad[-_]?(slot|unit|banner|box|break|place|block|hold|region|zone|leader|native|inline|interstitial|label)|dfp[-_]|gpt[-_]?ad|google[-_]?ad|taboola|outbrain|native[-_]?ad|content[-_]?marketing/i;

  // Soft-remove: patterns that MIGHT wrap article content for logged-in users
  // (paywall containers, subscription wrappers, newsletter modules).
  // Only remove these if they contain very little text (< 200 chars).
  const softPattern = /sponsor|promo(tion)?[-_]?|newsletter|related[-_]?(article|post|storie|content|reading)|recircul|trending|recommend|paid[-_]?(content|post|partner)|commercial|marketing[-_]?module|cta[-_]?(module|bar|banner)|signup[-_]?(module|bar|form)|subscription|paywall|metering|reg[-_]?wall|piano[-_]|braze|sailthru|resources[-_]?(module|section|widget|sidebar)/i;

  const TEXT_THRESHOLD = 200;

  doc.querySelectorAll("*").forEach(el => {
    const cls = typeof el.className === "string" ? el.className : "";
    const id = el.id || "";
    const classAndId = cls + " " + id;

    if (hardAdPattern.test(classAndId)) {
      el.remove();
      return;
    }

    if (softPattern.test(classAndId)) {
      const textLen = (el.textContent || "").replace(/\s+/g, " ").trim().length;
      if (textLen < TEXT_THRESHOLD) {
        el.remove();
      }
    }
  });

  // Remove known non-content elements
  doc.querySelectorAll(
    "iframe, object, embed, form, input, button, select, textarea, " +
    "nav, [role='complementary'], [role='banner'], [role='navigation'], " +
    "[aria-label*='advertisement' i], [aria-label*='sponsor' i], " +
    "[data-ad], [data-testid*='ad' i], [data-testid*='sponsor' i], " +
    "script, style, noscript, svg, [hidden]"
  ).forEach(el => el.remove());

  // Remove <aside> elements only if they're small (pull quotes are fine,
  // but some sites use <aside> for large sidebar content)
  doc.querySelectorAll("aside").forEach(el => {
    const textLen = (el.textContent || "").replace(/\s+/g, " ").trim().length;
    if (textLen < TEXT_THRESHOLD) el.remove();
  });

  // Remove elements whose text is just ad labels
  doc.querySelectorAll("div, section, span, p, a").forEach(el => {
    const text = (el.textContent || "").replace(/\u00A0/g, " ").trim();
    if (/^(sponsors?e?d?|adverti[sz]e?ment|content provided by\s*.+|promoted|resources)$/i.test(text)) {
      el.remove();
    }
  });

  // Remove images from ad networks or tracking pixels
  doc.querySelectorAll("img").forEach(img => {
    const src = (img.getAttribute("src") || "").toLowerCase();
    const w = parseInt(img.getAttribute("width")) || 0;
    const h = parseInt(img.getAttribute("height")) || 0;
    if ((w <= 2 && h <= 2) ||
        /doubleclick|googlesyndication|googleadservices|adnxs|criteo|taboola|outbrain|amazon-adsystem|moatads|serving-sys|adroll|pubmatic|rubiconproject|openx|quantserve|scorecardresearch|2mdn\.net|zqtk\.net|adsrvr\.org|adform\.net/.test(src)) {
      img.remove();
    }
  });
}

// Clean Readability's HTML output (class names are already gone here)
function postCleanHTML(html) {
  const container = document.createElement("div");
  container.innerHTML = html;

  function visibleText(el) {
    return (el.textContent || "").replace(/\u00A0/g, " ").trim();
  }

  // 1. Only keep allowed elements. Everything else: unwrap inline, remove block.
  const INLINE_ALLOWED = new Set([
    "A", "STRONG", "B", "EM", "I", "CODE", "SPAN",
    "SUP", "SUB", "MARK", "ABBR", "TIME", "CITE", "DFN",
    "DEL", "INS", "SMALL", "S", "U", "KBD", "VAR", "SAMP"
  ]);
  const BLOCK_ALLOWED = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "BLOCKQUOTE", "UL", "OL", "LI", "PRE",
    "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "CAPTION",
    "FIGURE", "FIGCAPTION", "HR", "BR", "IMG",
    "DL", "DT", "DD", "DETAILS", "SUMMARY"
  ]);

  // Process bottom-up so child removals propagate
  const all = [...container.querySelectorAll("*")].reverse();
  for (const el of all) {
    if (!el.parentElement) continue;
    const tag = el.tagName;

    if (INLINE_ALLOWED.has(tag) || BLOCK_ALLOWED.has(tag)) {
      // Allowed — strip all attributes except href (a) and src/alt (img)
      const href = el.tagName === "A" ? el.getAttribute("href") : null;
      const src = el.tagName === "IMG" ? el.getAttribute("src") : null;
      const alt = el.tagName === "IMG" ? el.getAttribute("alt") : null;
      while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
      if (href) el.setAttribute("href", href);
      if (src) el.setAttribute("src", src);
      if (alt) el.setAttribute("alt", alt);
      continue;
    }

    // Not allowed — unwrap (replace with children) for divs/sections/articles,
    // remove entirely for anything else unrecognized
    if (["DIV", "SECTION", "ARTICLE", "MAIN", "HGROUP", "ADDRESS", "CENTER"].includes(tag)) {
      el.replaceWith(...el.childNodes);
    } else {
      el.remove();
    }
  }

  // 2. Remove empty block elements (recursive pass)
  let changed = true;
  while (changed) {
    changed = false;
    container.querySelectorAll("p, h1, h2, h3, h4, h5, h6, blockquote, li, figure, figcaption, td, th, tr, table, ul, ol, dl, dt, dd").forEach(el => {
      if (!el.parentElement) return;
      const text = visibleText(el);
      const hasMedia = el.querySelector("img, video, canvas, audio, picture");
      if (!text && !hasMedia) {
        el.remove();
        changed = true;
      }
    });
  }

  // 3. Remove images that are likely non-article (ad banners with no alt,
  //    or very wide/short aspect ratio outside figures)
  container.querySelectorAll("img").forEach(img => {
    const src = (img.getAttribute("src") || "").toLowerCase();
    // No src
    if (!src || src === "about:blank" || src.startsWith("data:image/gif")) {
      img.remove();
      return;
    }
    // Ad network URLs (in case any survived)
    if (/doubleclick|googlesyndication|adnxs|criteo|taboola|outbrain/.test(src)) {
      img.remove();
    }
  });

  // 4. Merge broken paragraphs (ad insertion splits sentences)
  function mergeBrokenParagraphs(parent) {
    const children = [...parent.childNodes].filter(
      n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim())
    );

    for (let i = 0; i < children.length - 1; i++) {
      const curr = children[i];
      const next = children[i + 1];
      if (curr.nodeType !== 1 || next.nodeType !== 1) continue;
      if (!curr.parentElement || !next.parentElement) continue;

      const currText = visibleText(curr);
      const nextText = visibleText(next);
      if (!currText || !nextText) continue;

      // Current ends mid-sentence, next starts lowercase
      if (!/[.!?:;"\u201D)\]]$/.test(currText) && /^[a-z]/.test(nextText)) {
        curr.append(document.createTextNode(" "));
        while (next.firstChild) curr.appendChild(next.firstChild);
        next.remove();
        i--; // re-check at same index
      }
    }
  }
  mergeBrokenParagraphs(container);

  // 5. Clean excessive br/whitespace
  container.innerHTML = container.innerHTML
    .replace(/(<br\s*\/?\s*>\s*){3,}/gi, "<br><br>")
    .replace(/\n{3,}/g, "\n\n");

  return container.innerHTML;
}

// ── Paywall detection ──────────────────────────────────────────

function looksPaywalled(article) {
  // Heuristic 1: very short extracted body (< 500 chars of visible text)
  const temp = document.createElement("div");
  temp.innerHTML = article.html;
  const textLen = (temp.textContent || "").replace(/\s+/g, " ").trim().length;
  if (textLen < 500) return true;

  // Heuristic 2: page DOM has paywall indicators
  const body = document.body;
  if (!body) return false;
  const haystack = body.innerHTML.toLowerCase();
  const indicators = [
    "paywall", "subscriber-only", "premium-content", "subscription-required",
    "piano-offer", "gate-content", "metered-content", "registration-wall",
    "subscribe to read", "subscribe to continue", "sign in to read",
    "this article is for subscribers", "free articles remaining",
    "create a free account", "already a subscriber"
  ];
  return indicators.some(term => haystack.includes(term));
}

// Parse archived HTML (from archive.today) through Readability
function extractFromArchiveHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // archive.today sometimes wraps content in an iframe or special div
  // Remove archive.today's own toolbar/header
  doc.querySelectorAll("#HEADER, .HEADER, #wm-ipp-base, #wm-ipp, #donato, #archiveorg").forEach(el => el.remove());

  preCleanDOM(doc);

  const reader = new Readability(doc);
  const article = reader.parse();
  if (!article) return null;

  return {
    title: article.title,
    byline: article.byline,
    siteName: article.siteName,
    html: postCleanHTML(article.content),
    excerpt: article.excerpt,
    url: window.location.href
  };
}

// ── Format converters ──────────────────────────────────────────

function articleToMarkdown(article) {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-"
  });
  turndown.addRule("removeEmptyLinks", {
    filter: (node) => node.nodeName === "A" && !node.textContent.trim(),
    replacement: () => ""
  });

  const body = turndown.turndown(article.html);
  const parts = [`# ${article.title}`];
  if (article.byline) parts.push(`*${article.byline}*`);
  if (article.siteName || article.url) {
    const source = article.siteName || new URL(article.url).hostname;
    parts.push(`Source: [${source}](${article.url})`);
  }
  parts.push("", body);
  return parts.join("\n");
}

function articleToPlainText(article) {
  const temp = document.createElement("div");
  temp.innerHTML = article.html;
  temp.querySelectorAll("img, script, style, figure, figcaption").forEach(el => el.remove());
  const text = temp.textContent || temp.innerText || "";
  const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const parts = [article.title];
  if (article.byline) parts.push(article.byline);
  parts.push(article.url, "", cleaned);
  return parts.join("\n");
}

// ── Reading Panel ──────────────────────────────────────────────

const PANEL_ID = "clean-copy-reader-panel";
const PANEL_DEFAULT_WIDTH = 420;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 900;

function getOrCreatePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = PANEL_ID;

  const shadow = panel.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        top: 0;
        right: 0;
        width: ${PANEL_DEFAULT_WIDTH}px;
        height: 100vh;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif;
        transition: transform .25s ease;
      }
      :host(.hidden) { transform: translateX(100%); }
      :host(.resizing) { transition: none; }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      .panel {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        color: var(--text);
        border-left: 1px solid var(--border);
        box-shadow: -4px 0 20px rgba(0,0,0,.15);
      }

      /* Themes */
      .panel {
        --bg: #fafaf7; --text: #1a1a1a; --text2: #666;
        --border: #e0e0e0; --link: #1a5276;
        --code-bg: #f4f4f4; --qborder: #ccc; --qbg: #f9f9f6;
      }
      .panel.dark {
        --bg: #1a1a2e; --text: #e0e0e0; --text2: #999;
        --border: #333; --link: #6fb3d2;
        --code-bg: #16213e; --qborder: #444; --qbg: #16213e;
      }
      .panel.sepia {
        --bg: #f4ecd8; --text: #3b2e1a; --text2: #7a6a52;
        --border: #d4c9a8; --link: #5b3a1a;
        --code-bg: #efe5cc; --qborder: #c4b48a; --qbg: #f0e6cc;
      }

      /* Toolbar */
      .toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        flex-shrink: 0;
        background: var(--bg);
      }
      .toolbar button, .toolbar select {
        background: none;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        padding: 3px 8px;
        font-size: 11px;
        cursor: pointer;
        font-family: system-ui, sans-serif;
        line-height: 1.4;
      }
      .toolbar button:hover { opacity: 0.7; }
      .toolbar .spacer { flex: 1; }
      .theme-btn { min-width: 28px; text-align: center; font-size: 14px !important; }
      .close-btn {
        border: none !important;
        font-size: 16px !important;
        padding: 2px 6px !important;
        line-height: 1 !important;
      }

      /* Content */
      .content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 20px 60px;
        -webkit-user-select: text;
        user-select: text;
      }
      .content h1.title {
        font-size: 1.5em;
        line-height: 1.25;
        margin-bottom: 8px;
      }
      .meta {
        color: var(--text2);
        font-size: 0.85em;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
        font-family: system-ui, sans-serif;
      }
      .meta a { color: var(--link); text-decoration: none; }

      /* Article body */
      .body { font-family: system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif; }
      .body p { margin-bottom: 1.1em; line-height: 1.7; }
      .body h2 { font-size: 1.3em; margin: 1.4em 0 0.5em; }
      .body h3 { font-size: 1.15em; margin: 1.2em 0 0.4em; }
      .body a { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }
      .body img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.8em 0; }
      .body blockquote {
        border-left: 3px solid var(--qborder);
        background: var(--qbg);
        padding: 10px 16px;
        margin: 1em 0;
        font-style: italic;
      }
      .body pre { background: var(--code-bg); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 1em 0; font-size: 0.85em; }
      .body code { background: var(--code-bg); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
      .body pre code { background: none; padding: 0; }
      .body ul, .body ol { margin: 0.8em 0; padding-left: 1.4em; }
      .body li { margin-bottom: 0.3em; }
      .body figure { margin: 1.2em 0; }
      .body figcaption { color: var(--text2); font-size: 0.8em; margin-top: 4px; text-align: center; }

      /* Safety net: force-reset any stray divs/spans/sections that survive cleanup */
      .body div, .body section, .body aside, .body span, .body article {
        display: contents;
      }

      /* Font sizes */
      .content.size-small .body { font-size: 0.88em; }
      .content.size-medium .body { font-size: 1em; }
      .content.size-large .body { font-size: 1.12em; }
      .content.size-xlarge .body { font-size: 1.25em; }

      /* Font family overrides */
      .content.font-serif, .content.font-serif .body { font-family: Georgia, "Times New Roman", serif; }
      .content.font-mono, .content.font-mono .body { font-family: "SF Mono", "Fira Code", Consolas, monospace; }

      .loading { color: var(--text2); padding: 40px; text-align: center; font-family: system-ui, sans-serif; }
      .error { color: #ef5350; }

      /* Toast */
      .toast {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--text);
        color: var(--bg);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-family: system-ui, sans-serif;
        opacity: 0;
        transition: opacity .2s;
        pointer-events: none;
      }
      .toast.show { opacity: 1; }

      /* Archive fallback prompt */
      .archive-prompt {
        margin: 20px 0;
        padding: 16px;
        border: 1px dashed var(--border);
        border-radius: 8px;
        text-align: center;
        font-family: system-ui, sans-serif;
        font-size: 0.85em;
        color: var(--text2);
        line-height: 1.5;
      }
      .archive-prompt p { margin-bottom: 10px; }
      .archive-btn {
        display: inline-block;
        padding: 8px 16px;
        background: var(--link);
        color: var(--bg);
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        cursor: pointer;
        transition: opacity .15s;
      }
      .archive-btn:hover { opacity: 0.85; }
      .archive-btn:disabled { opacity: 0.5; cursor: default; }
      .archive-note {
        margin-top: 8px;
        font-size: 0.8em;
        color: var(--text2);
        opacity: 0.7;
      }

      /* Resize handle */
      .resize-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 6px;
        height: 100%;
        cursor: col-resize;
        z-index: 10;
        background: transparent;
        transition: background .15s;
      }
      .resize-handle:hover, .resize-handle.active {
        background: var(--link);
        opacity: 0.4;
      }
    </style>

    <div class="resize-handle"></div>
    <div class="panel">
      <div class="toolbar">
        <button class="theme-btn" title="Light theme">\u263C</button>
        <button class="size-down" title="Smaller text">A-</button>
        <button class="size-up" title="Larger text">A+</button>
        <select class="font-select" title="Font">
          <option value="sans" selected>Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
        <button class="copy-md" title="Copy as Markdown">Copy MD</button>
        <button class="copy-text" title="Copy as plain text">Copy Text</button>
        <span class="spacer"></span>
        <button class="close-btn" title="Close">&times;</button>
      </div>
      <div class="content size-medium">
        <div class="loading">Extracting article...</div>
      </div>
      <div class="toast"></div>
    </div>
  `;

  document.documentElement.appendChild(panel);

  // Wire up toolbar
  const root = shadow;
  const panelEl = root.querySelector(".panel");
  const contentEl = root.querySelector(".content");
  const toastEl = root.querySelector(".toast");

  // Theme toggle: light → dark → sepia, shown as moon phases
  const themes = ["", "dark", "sepia"];
  const themeIcons = ["\u263C", "\u263D", "\u263E"]; // ☼ ☽ ☾
  const themeTitles = ["Light theme", "Dark theme", "Sepia theme"];
  let themeIdx = 0;
  const themeBtn = root.querySelector(".theme-btn");
  themeBtn.addEventListener("click", () => {
    themeIdx = (themeIdx + 1) % themes.length;
    panelEl.className = "panel " + themes[themeIdx];
    themeBtn.textContent = themeIcons[themeIdx];
    themeBtn.title = themeTitles[themeIdx];
  });

  // Font size
  const sizes = ["size-small", "size-medium", "size-large", "size-xlarge"];
  let sizeIdx = 1;
  function applySize() {
    contentEl.className = contentEl.className.replace(/size-\w+/g, "").trim() + " " + sizes[sizeIdx];
  }
  root.querySelector(".size-down").addEventListener("click", () => {
    if (sizeIdx > 0) { sizeIdx--; applySize(); }
  });
  root.querySelector(".size-up").addEventListener("click", () => {
    if (sizeIdx < sizes.length - 1) { sizeIdx++; applySize(); }
  });

  // Font family
  root.querySelector(".font-select").addEventListener("change", (e) => {
    contentEl.className = contentEl.className.replace(/font-\w+/g, "").trim();
    if (e.target.value !== "sans") {
      contentEl.classList.add("font-" + e.target.value);
    }
  });

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1500);
  }

  root.querySelector(".copy-md").addEventListener("click", () => {
    const article = panel._articleData;
    if (!article) return;
    navigator.clipboard.writeText(articleToMarkdown(article)).then(() => showToast("Copied as Markdown"));
  });

  root.querySelector(".copy-text").addEventListener("click", () => {
    const article = panel._articleData;
    if (!article) return;
    navigator.clipboard.writeText(articleToPlainText(article)).then(() => showToast("Copied as plain text"));
  });

  root.querySelector(".close-btn").addEventListener("click", () => {
    panel.classList.add("hidden");
    document.documentElement.style.marginRight = "";
  });

  // Resize handle
  const resizeHandle = root.querySelector(".resize-handle");
  let isResizing = false;

  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    panel.classList.add("resizing");
    resizeHandle.classList.add("active");

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, window.innerWidth - e.clientX));
      panel.style.width = newWidth + "px";
      document.documentElement.style.marginRight = newWidth + "px";
    };

    const onMouseUp = () => {
      isResizing = false;
      panel.classList.remove("resizing");
      resizeHandle.classList.remove("active");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  return panel;
}

function showReadingPanel() {
  const panel = getOrCreatePanel();
  const shadow = panel.shadowRoot;
  const contentEl = shadow.querySelector(".content");

  panel.classList.remove("hidden");
  // Use current width if previously resized, otherwise default
  const currentWidth = panel.style.width || (PANEL_DEFAULT_WIDTH + "px");
  document.documentElement.style.marginRight = currentWidth;

  const article = extractArticle();
  if (!article) {
    contentEl.innerHTML = '<div class="loading error">Could not extract article from this page.</div>';
    return;
  }

  panel._articleData = article;

  const metaParts = [];
  if (article.byline) metaParts.push(article.byline);
  if (article.siteName) metaParts.push(article.siteName);
  metaParts.push(`<a href="${article.url}" target="_blank">${new URL(article.url).hostname}</a>`);

  const isPaywalled = looksPaywalled(article);

  const existingClasses = contentEl.className;
  contentEl.innerHTML = `
    <h1 class="title">${article.title}</h1>
    <div class="meta">${metaParts.join(" \u00B7 ")}</div>
    ${isPaywalled ? `
      <div class="archive-prompt">
        <p>This article looks truncated — it may be behind a paywall.</p>
        <button class="archive-btn">Try archive.today</button>
        <div class="archive-note">Fetches a cached version if one exists</div>
      </div>
    ` : ""}
    <div class="body">${article.html}</div>
  `;
  contentEl.className = existingClasses;
  contentEl.scrollTop = 0;

  // Wire up archive button if present
  const archiveBtn = contentEl.querySelector(".archive-btn");
  if (archiveBtn) {
    archiveBtn.addEventListener("click", () => {
      archiveBtn.disabled = true;
      archiveBtn.textContent = "Fetching...";
      loadFromArchive(panel, contentEl, metaParts);
    });
  }
}

async function loadFromArchive(panel, contentEl, metaParts) {
  const url = window.location.href;

  const result = await chrome.runtime.sendMessage({
    action: "fetch-archive",
    url: url
  });

  if (!result.ok) {
    const prompt = contentEl.querySelector(".archive-prompt");
    if (prompt) {
      prompt.innerHTML = `<p>${result.error}</p><div class="archive-note">You can try <a href="https://archive.today/?url=${encodeURIComponent(url)}" target="_blank" style="color:var(--link)">saving it manually</a></div>`;
    }
    return;
  }

  // Parse the archived page through Readability
  const article = extractFromArchiveHTML(result.html);
  if (!article) {
    const prompt = contentEl.querySelector(".archive-prompt");
    if (prompt) {
      prompt.innerHTML = `<p>Found an archived version but couldn't extract the article.</p><div class="archive-note"><a href="${result.finalUrl}" target="_blank" style="color:var(--link)">Open in archive.today</a></div>`;
    }
    return;
  }

  // Update panel with full article
  panel._articleData = article;

  const existingClasses = contentEl.className;
  contentEl.innerHTML = `
    <h1 class="title">${article.title}</h1>
    <div class="meta">${metaParts.join(" \u00B7 ")} · <span style="color:var(--link)">via archive.today</span></div>
    <div class="body">${article.html}</div>
  `;
  contentEl.className = existingClasses;
  contentEl.scrollTop = 0;
}

function toggleReadingPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel && !panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    document.documentElement.style.marginRight = "";
  } else {
    showReadingPanel();
  }
}

// ── Message listener ───────────────────────────────────────────

// ── Archive.today auto-detect ──────────────────────────────────
// When the user lands on an archive.today page (after saving or browsing),
// show a slim banner offering to read the article clean.

const ARCHIVE_DOMAINS = ["archive.today", "archive.ph", "archive.is", "archive.li", "archive.vn", "archive.fo", "archive.md"];

function isArchivePage() {
  return ARCHIVE_DOMAINS.some(d => window.location.hostname === d || window.location.hostname.endsWith("." + d));
}

function showArchiveBanner() {
  const BANNER_ID = "clean-copy-archive-banner";
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;

  const shadow = banner.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 10px 16px;
        background: #1a1a2e;
        color: #e0e0e0;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,.3);
        animation: slideDown .25s ease;
      }
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      .banner button {
        padding: 5px 14px;
        border: none;
        border-radius: 5px;
        font-size: 12px;
        font-family: system-ui, sans-serif;
        cursor: pointer;
        transition: opacity .15s;
      }
      .banner button:hover { opacity: 0.85; }
      .read-btn { background: #6fb3d2; color: #1a1a2e; font-weight: 600; }
      .dismiss-btn { background: transparent; color: #999; border: 1px solid #444 !important; }
    </style>
    <div class="banner">
      <span>Archived article detected</span>
      <button class="read-btn">Read Clean</button>
      <button class="dismiss-btn">Dismiss</button>
    </div>
  `;

  document.documentElement.appendChild(banner);

  shadow.querySelector(".read-btn").addEventListener("click", () => {
    banner.remove();
    showReadingPanel();
  });

  shadow.querySelector(".dismiss-btn").addEventListener("click", () => {
    banner.remove();
  });
}

// Auto-detect on page load
if (isArchivePage()) {
  // Wait for archive.today to finish rendering
  if (document.readyState === "complete") {
    showArchiveBanner();
  } else {
    window.addEventListener("load", showArchiveBanner);
  }
}

// ── Message listener ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    const article = extractArticle();
    if (!article) {
      sendResponse({ error: "Could not extract article from this page." });
      return;
    }

    let content;
    if (request.format === "markdown") {
      content = articleToMarkdown(article);
    } else if (request.format === "html") {
      content = article.html;
    } else {
      content = articleToPlainText(article);
    }
    sendResponse({ content, title: article.title, format: request.format });
  }

  if (request.action === "toggle-reader") {
    toggleReadingPanel();
    sendResponse({ ok: true });
  }

  return true;
});
