// Shrinks scraped markdown to the text a compliance officer reads, before it is stored as Page.markdown.
// Page.markdown is capped server-side at ~20,000 chars (measured 2026-10-10: 20,000 saves, 21,250 fails).
// Self-check: deno run base44/shared/page-text.ts
// Input is untrusted scraped text; this only deletes and rearranges it, never interprets it.

export const MAX_STORED_CHARS = 19_000; // margin under the measured limit

const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /<?https?:\/\/[^\s)>\]]+>?/g;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

/** A line that is nothing but links (a nav bar or footer menu), once list markers are ignored. */
function isLinkOnlyLine(line: string): boolean {
  if (!line.includes("](")) return false;
  const rest = line.replace(LIST_MARKER, "").replace(IMAGE, "").replace(LINK, "").replace(/[\s|·•\-–—/]+/g, "");
  return rest === "";
}

export function cleanMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !isLinkOnlyLine(line))
    .join("\n")
    .replace(IMAGE, "")
    .replace(LINK, "$1")
    .replace(BARE_URL, "")
    .replace(/\[\s*\]/g, "") // brackets left behind by image-only links
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  console.log("page-text.ts self-check: ok");
}
