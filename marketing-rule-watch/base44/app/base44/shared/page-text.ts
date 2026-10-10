// Shrinks scraped markdown to the text a compliance officer reads, before it is stored as Page.markdown.
// Page.markdown is capped server-side at ~20,000 chars (measured 2026-10-10: 20,000 saves, 21,250 fails).
// Self-check: deno run base44/shared/page-text.ts
// Input is untrusted scraped text; this only deletes and rearranges it, never interprets it.

export const MAX_STORED_CHARS = 19_000; // margin under the measured limit

const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /<?https?:\/\/[^\s)>\]]+>?/g;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

/**
 * A nav bar or footer menu line: nothing but links, each with a short, figure-free label.
 * Blog headlines, press mentions and award badges are often bare links too, and they carry the
 * claims detect looks for, so a long label or one with a number or #/$/% keeps the line.
 */
function isMenuLine(line: string): boolean {
  if (!line.includes("](")) return false;
  const rest = line.replace(LIST_MARKER, "").replace(IMAGE, "").replace(LINK, "").replace(/[\s|·•\-–—/]+/g, "");
  if (rest !== "") return false;
  const labels = [...line.matchAll(LINK)].map((m) => m[1].replace(IMAGE, "").trim());
  return labels.every((label) => label.split(/\s+/).filter(Boolean).length <= 4 && !/[\d#$%]/.test(label));
}

function tidy(md: string): string {
  return md
    .replace(IMAGE, "")
    .replace(LINK, "$1")
    .replace(BARE_URL, "")
    .replace(/\[\s*\]/g, "") // brackets left behind by image-only links
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const cleaned = tidy(lines.filter((line) => !isMenuLine(line)).join("\n"));
  // A page that is all short links would otherwise store nothing: keep its link text instead.
  return cleaned || tidy(lines.join("\n"));
}

/** Cuts at the last paragraph (else line) boundary under `max`. Nothing is appended to the text. */
export function capText(text: string, max = MAX_STORED_CHARS): string {
  if (text.length <= max) return text;
  let cut = text.lastIndexOf("\n\n", max);
  if (cut < max / 2) cut = text.lastIndexOf("\n", max);
  if (cut < max / 2) cut = max;
  return text.slice(0, cut).trimEnd();
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  eq(cleanMarkdown("* [Home](/)\n* [About](/about)\n\nWe [guarantee](https://x.example/g) 8%. ![logo](l.png)"),
    "We guarantee 8%.", "nav dropped, link text kept, image dropped");
  eq(cleanMarkdown("Read https://x.example/p?a=1 now.\n\n\n\nNext   para"), "Read now.\n\nNext para", "bare url, newlines, spaces");
  eq(cleanMarkdown("[![badge](b.svg)](https://x.example) Top rated"), "Top rated", "image link");
  eq(cleanMarkdown("Ranked #3 | [Methodology](/m)"), "Ranked #3 | Methodology", "mixed line kept");
  const long = Array.from({ length: 50 }, (_, i) => `Paragraph ${i} ` + "x".repeat(500)).join("\n\n");
  const capped = capText(long, 5_000);
  eq(capped.length <= 5_000 && long.startsWith(capped) && !capped.endsWith("\n"), true, "cap on a paragraph boundary, prefix of original");
  // Link-only lines that carry claims must survive (p2-evaluator repro, 2026-10-10).
  eq(cleanMarkdown("# Insights\n\n- [Our clients never lost money in 2022: here's how](/blog/never-lost)\n- [Guaranteed 8% income for life](/blog/income)\n\nInvesting involves risk."),
    "# Insights\n\n- Our clients never lost money in 2022: here's how\n- Guaranteed 8% income for life\n\nInvesting involves risk.", "headline links kept");
  eq(cleanMarkdown("[Named a Top 50 Advisor by Finance Weekly](https://fw.example/top50)"), "Named a Top 50 Advisor by Finance Weekly", "award link kept");
  eq(cleanMarkdown("* [#1 Advisor](/award)\n* [About](/about)"), "* #1 Advisor", "short label with a figure kept");
  eq(cleanMarkdown("* [Home](/)\n* [About us](/about) | [Contact](/c)\n\nBody text."), "Body text.", "menu still dropped");
  eq(cleanMarkdown("* [Home](/)\n* [About](/about)"), "* Home\n* About", "all-menu page falls back to link text");
  console.log("page-text.ts self-check: ok");
}
