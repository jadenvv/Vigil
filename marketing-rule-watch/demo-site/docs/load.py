"""Load the Quarrywick Wealth demo corpus for the cross-document contradiction detector.

Stdlib only. `load_demo_docs()` returns one dict per document:
    {"url": ..., "channel": ..., "markdown": ...}

- Site pages: every HTML file under demo-site/site/ (including blog/), converted to
  plain text. Scripts, styles and <head> are dropped; block elements become
  paragraph breaks; table cells are separated by " | ".
- Fixtures: docs/form_adv_part2a.md and docs/blog_2021_archive.md, read as-is.

All text is whitespace-normalized the same way: runs of spaces/tabs inside a line
collapse to one space, lines are stripped, and runs of blank lines collapse to one.
Single-sentence quotes from docs/README.md survive this normalization verbatim.
"""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent
SITE_DIR = DOCS_DIR.parent / "site"

# Live deploy (see demo-site/ANSWER_KEY.md).
SITE_BASE_URL = "https://nathanqiu07.github.io/quarrywick-wealth-demo/"

# The fixtures are not on the live site; these URLs are labels only.
FIXTURES = [
    ("form_adv_part2a.md", "quarrywick-form-adv-part2a.pdf", "other"),
    (
        "blog_2021_archive.md",
        "https://quarrywick.example/blog/2021/staying-the-course.html",
        "blog",
    ),
]

_BLOCK_TAGS = {
    "p", "div", "section", "article", "header", "footer", "main", "nav", "aside",
    "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "table", "thead",
    "tbody", "tr", "blockquote", "figure", "figcaption", "br", "hr", "dl", "dt", "dd",
}
_SKIP_TAGS = {"script", "style", "head", "noscript", "template"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n\n")
        elif tag in ("td", "th"):
            self.parts.append(" | ")

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS:
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n\n")

    def handle_startendtag(self, tag, attrs):
        if tag in ("br", "hr"):
            self.parts.append("\n\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def normalize_ws(text: str) -> str:
    """Collapse intra-line whitespace, strip lines, keep single blank lines between paragraphs."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    lines = [re.sub(r"[ \t\f\v]+", " ", ln).strip() for ln in text.split("\n")]
    out = "\n".join(lines)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip() + "\n"


def html_to_text(raw_html: str) -> str:
    parser = _TextExtractor()
    parser.feed(raw_html)
    parser.close()
    text = html.unescape("".join(parser.parts))
    # Inside a paragraph, HTML source newlines are just whitespace: join them.
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    paras = [p.lstrip("| ") for p in paras]  # table rows start with a cell separator
    return normalize_ws("\n\n".join(p for p in paras if p))


def load_demo_docs() -> list[dict]:
    docs: list[dict] = []
    for path in sorted(SITE_DIR.rglob("*.html")):
        rel = path.relative_to(SITE_DIR).as_posix()
        docs.append({
            "url": SITE_BASE_URL + rel,
            "channel": "blog" if rel.startswith("blog/") else "website",
            "markdown": html_to_text(path.read_text(encoding="utf-8")),
        })
    for fname, url, channel in FIXTURES:
        docs.append({
            "url": url,
            "channel": channel,
            "markdown": normalize_ws((DOCS_DIR / fname).read_text(encoding="utf-8")),
        })
    return docs


if __name__ == "__main__":
    for d in load_demo_docs():
        print(f"{d['url']}  ({d['channel']}, {len(d['markdown'])} chars)")
