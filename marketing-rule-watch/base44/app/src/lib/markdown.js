// Minimal markdown model for crawled page text: headings, paragraphs, lists, quotes, rules, tables,
// and **bold** / *italic* / `code` / [link text]. Every visible character keeps its offset in the raw
// markdown, so the flagged span (an exact substring of the raw text) is highlighted exactly, even when
// it crosses formatting. Links are rendered as text only: scraped hrefs are untrusted.

// Index of the ")" closing a link/image target that opens at `open` ("(" position), allowing nested parens.
function closeParen(s, open, to) {
  let depth = 0;
  for (let k = open; k < to; k++) {
    if (s[k] === "(") depth++;
    else if (s[k] === ")" && --depth === 0) return k;
  }
  return -1;
}

// Inline: returns [{ ch, pos, bold, italic, code, link }] for the visible characters of s[from, to).
function parseInline(s, from, to, flags = {}, out = []) {
  let i = from;
  while (i < to) {
    const two = s.slice(i, i + 2);
    if (s[i] === "\\" && i + 1 < to && /[\\`*_{}[\]()#+\-.!|>]/.test(s[i + 1])) {
      out.push({ ch: s[i + 1], pos: i + 1, ...flags });
      i += 2;
      continue;
    }
    if (two === "**" || two === "__") {
      const close = s.indexOf(two, i + 2);
      if (close > i + 2 && close < to) {
        parseInline(s, i + 2, close, { ...flags, bold: true }, out);
        i = close + 2;
        continue;
      }
    }
    if ((s[i] === "*" || s[i] === "_") && i + 1 < to && s[i + 1] !== " " && s[i + 1] !== s[i]) {
      const close = s.indexOf(s[i], i + 1);
      const wordInside = s[i] === "_" && i > from && /\w/.test(s[i - 1]);
      if (!wordInside && close > i + 1 && close < to && s[close - 1] !== " ") {
        parseInline(s, i + 1, close, { ...flags, italic: true }, out);
        i = close + 1;
        continue;
      }
    }
    if (s[i] === "`") {
      const close = s.indexOf("`", i + 1);
      if (close > i && close < to) {
        for (let k = i + 1; k < close; k++) out.push({ ch: s[k], pos: k, ...flags, code: true });
        i = close + 1;
        continue;
      }
    }
    if (two === "![") {
      const mid = s.indexOf("](", i + 2);
      const close = mid >= 0 && mid < to ? closeParen(s, mid + 1, to) : -1;
      if (mid >= 0 && close >= 0) {
        i = close + 1; // images carry no evidence text
        continue;
      }
    }
    if (s[i] === "[") {
      const mid = s.indexOf("](", i + 1);
      const close = mid > i && mid < to ? closeParen(s, mid + 1, to) : -1;
      if (close >= 0) {
        parseInline(s, i + 1, mid, { ...flags, link: true }, out);
        i = close + 1;
        continue;
      }
    }
    out.push({ ch: s[i], pos: i, ...flags });
    i++;
  }
  return out;
}

// Groups characters into runs with the same formatting and highlight state.
function toRuns(chars, hlStart, hlEnd, counter) {
  const runs = [];
  for (const c of chars) {
    const mark = c.pos >= hlStart && c.pos < hlEnd;
    if (mark) counter.highlighted++;
    const last = runs[runs.length - 1];
    if (last && last.mark === mark && last.bold === !!c.bold && last.italic === !!c.italic && last.code === !!c.code && last.link === !!c.link) {
      last.text += c.ch;
    } else {
      runs.push({ text: c.ch, mark, bold: !!c.bold, italic: !!c.italic, code: !!c.code, link: !!c.link });
    }
  }
  return runs;
}

const RE = {
  heading: /^(#{1,6})\s+/,
  item: /^(\s*)([-*+]|\d+[.)])\s+/,
  quote: /^\s*>\s?/,
  rule: /^\s*([-*_])(\s*\1){2,}\s*$/,
  tableSep: /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/,
};

function tableCells(s, lineStart, line) {
  const cells = [];
  let start = 0;
  const bounds = [];
  for (let k = 0; k <= line.length; k++) {
    if (k === line.length || (line[k] === "|" && line[k - 1] !== "\\")) {
      bounds.push([start, k]);
      start = k + 1;
    }
  }
  const trimmed = line.trim();
  const inner = bounds.filter(([a, b], idx) => {
    if (idx === 0 && trimmed.startsWith("|") && line.slice(a, b).trim() === "") return false;
    if (idx === bounds.length - 1 && trimmed.endsWith("|") && line.slice(a, b).trim() === "") return false;
    return true;
  });
  for (const [a, b] of inner) {
    let x = a;
    let y = b;
    while (x < y && /\s/.test(line[x])) x++;
    while (y > x && /\s/.test(line[y - 1])) y--;
    cells.push([lineStart + x, lineStart + y]);
  }
  return cells;
}

// Returns { blocks, highlighted } where highlighted counts visible characters inside the span.
export function parseMarkdown(text, span) {
  const hlStart = span ? text.indexOf(span) : -1;
  const hlEnd = hlStart >= 0 ? hlStart + span.length : -1;
  const counter = { highlighted: 0 };
  const runsOf = (chars) => toRuns(chars, hlStart, hlEnd, counter);

  const lines = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    lines.push({ line, start: offset });
    offset += line.length + 1;
  }

  const blocks = [];
  let para = null; // chars of the paragraph being built
  let list = null;
  let quote = null;
  let table = null;
  const flush = () => {
    if (para) blocks.push({ type: "p", runs: runsOf(para) });
    if (list) blocks.push({ type: list.ordered ? "ol" : "ul", items: list.items.map(runsOf) });
    if (quote) blocks.push({ type: "quote", runs: runsOf(quote) });
    if (table) blocks.push({ type: "table", header: table.header, rows: table.rows.map((row) => row.map(runsOf)) });
    para = list = quote = table = null;
  };
  // Joining lines inside a block: the newline becomes a visible space at the newline's own offset.
  const joinSpace = (chars, newlinePos) => chars.push({ ch: " ", pos: newlinePos });

  for (const { line, start } of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("|") && trimmed.indexOf("|", 1) > 0) {
      if (!table) {
        flush();
        table = { rows: [], header: false };
      }
      if (RE.tableSep.test(line)) {
        if (table.rows.length === 1) table.header = true;
        continue;
      }
      table.rows.push(tableCells(text, start, line).map(([a, b]) => parseInline(text, a, b)));
      continue;
    }
    if (table) flush();
    if (RE.rule.test(line)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    const heading = line.match(RE.heading);
    if (heading) {
      flush();
      const contentStart = start + heading[0].length;
      const contentEnd = start + line.replace(/\s+#*\s*$/, "").length;
      blocks.push({ type: "h", level: heading[1].length, runs: runsOf(parseInline(text, contentStart, Math.max(contentStart, contentEnd))) });
      continue;
    }
    const item = line.match(RE.item);
    if (item) {
      const ordered = /\d/.test(item[2]);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(parseInline(text, start + item[0].length, start + line.length));
      continue;
    }
    const q = line.match(RE.quote);
    if (q) {
      if (!quote) {
        flush();
        quote = [];
      } else {
        joinSpace(quote, start - 1);
      }
      parseInline(text, start + q[0].length, start + line.length, {}, quote);
      continue;
    }
    if (list && /^\s+/.test(line)) {
      const current = list.items[list.items.length - 1];
      joinSpace(current, start - 1);
      parseInline(text, start + (line.length - line.trimStart().length), start + line.length, {}, current);
      continue;
    }
    if (list || quote) flush();
    if (!para) para = [];
    else joinSpace(para, start - 1);
    parseInline(text, start + (line.length - line.trimStart().length), start + line.length, {}, para);
  }
  flush();
  return { blocks, highlighted: counter.highlighted, found: hlStart >= 0 };
}
