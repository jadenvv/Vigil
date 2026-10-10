// "Page as captured": scraped HTML is untrusted. The real guard is the frame: it is shown in an iframe with
// sandbox="" (no scripts, opaque origin) under a strict CSP. Stripping active content here and on the server
// is defence in depth only; regex/DOM cleaning alone can be bypassed.

// Strict policy for the captured document: nothing may run or connect; only images, styles and fonts load.
export const CAPTURE_CSP =
  "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https: data:";
export const HIT_ID = "mrw-hit";

const REMOVE = "script, noscript, iframe, frame, frameset, object, embed, applet, template, portal, base, meta[http-equiv]";
const URL_ATTRS = ["href", "src", "action", "formaction", "poster", "background", "xlink:href", "data", "srcset"];

// Parses (inertly: DOMParser never runs scripts), cleans, marks the span, and serializes. Returns
// { html, found }. The first mark carries id HIT_ID so the frame can be opened at "#mrw-hit".
export function prepareCapture(html, pageUrl, span) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(REMOVE).forEach((el) => el.remove());
  for (const el of doc.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase().replace(/\s+/g, "");
      if (name.startsWith("on") || name === "srcdoc" || name === "formaction") el.removeAttribute(attr.name);
      else if (URL_ATTRS.includes(name) && /^(javascript|vbscript|data:text\/html)/.test(value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === "FORM") el.removeAttribute("action");
  }
  const head = doc.head;
  // Relative CSS and images resolve against the captured page; scripts are blocked twice (CSP + sandbox).
  const base = doc.createElement("base");
  base.setAttribute("href", pageUrl);
  const csp = doc.createElement("meta");
  csp.setAttribute("http-equiv", "Content-Security-Policy");
  csp.setAttribute("content", CAPTURE_CSP);
  head.prepend(base);
  head.prepend(csp);
  const style = doc.createElement("style");
  style.textContent =
    "mark[data-mrw-highlight]{background:#fde68a !important;color:#0f172a !important;outline:3px solid #f59e0b;outline-offset:1px;}#mrw-hit{scroll-margin-top:30vh;}";
  head.append(style);
  const first = markSpanInDocument(doc, span);
  if (first) first.id = HIT_ID;
  return { html: `<!doctype html>\n${doc.documentElement.outerHTML}`, found: Boolean(first) };
}

// The span is grounded in the cleaned markdown, so strip markdown syntax to get the words a reader sees.
export function visibleWords(span) {
  return span
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Finds the span in the document's visible text (whitespace-normalized, across element boundaries),
// wraps every text piece of it in <mark data-mrw-highlight>, and returns the first mark (or null).
export function markSpanInDocument(doc, span) {
  const target = visibleWords(span);
  if (!target || !doc.body) return null;
  const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE"]);
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */, {
    acceptNode: (node) => (skip.has(node.parentNode?.nodeName) ? 2 /* REJECT */ : 1 /* ACCEPT */),
  });
  // Normalized text plus, for each normalized character, the text node and offset it came from.
  let text = "";
  const map = [];
  let lastWasSpace = true;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue;
    for (let i = 0; i < value.length; i++) {
      const isSpace = /\s/.test(value[i]);
      if (isSpace && lastWasSpace) continue;
      text += isSpace ? " " : value[i];
      map.push([node, i]);
      lastWasSpace = isSpace;
    }
  }
  let start = text.indexOf(target);
  if (start < 0) start = text.toLowerCase().indexOf(target.toLowerCase());
  if (start < 0) return null;
  const end = start + target.length;

  // Group the matched characters by text node, then wrap each node's slice (last node first, so
  // splitting a node never shifts the offsets still to be processed).
  const pieces = [];
  for (let k = start; k < end; k++) {
    const [node, offset] = map[k];
    const last = pieces[pieces.length - 1];
    if (last && last.node === node) last.to = offset + 1;
    else pieces.push({ node, from: offset, to: offset + 1 });
  }
  let first = null;
  for (const { node, from, to } of pieces.reverse()) {
    const middle = node.splitText(from);
    middle.splitText(to - from);
    const mark = doc.createElement("mark");
    mark.setAttribute("data-mrw-highlight", "");
    middle.parentNode.insertBefore(mark, middle);
    mark.appendChild(middle);
    first = mark;
  }
  return first;
}
