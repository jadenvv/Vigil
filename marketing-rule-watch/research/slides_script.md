# Vigil pitch: slide script (paste into Gamma)

## Instructions for the slide maker

Paste everything below the second line into Gamma → Create new → **Paste in text** → **Preserve this exact text** (don't let it generate or expand). `---` splits cards, so you get 12 cards.

**Simple above everything else.**
- One idea per slide. Keep the text given and add nothing to it: no extra bullets, summaries, icons, stock photos, illustrations, gradients or emoji.
- Image setting: **no AI images**. The only images are the Vigil logo and the screenshots we drop into `[[Screenshot]]` slots.
- Lots of empty space. Left-aligned text. No more than 4 bullets on a slide.
- Big numbers sit on their own line, large, with a short label under them.
- Tables stay as plain tables: hairline rows and no fills, except the header row in Paper 100.

**Theme: match the Vigil app** (`brand/BRAND.md`, `brand/preview.png`). In Gamma → Theme → Custom:
- Background **Paper 50 `#FAF8F4`**. Cards are white `#FFFFFF` with a 1px **Paper 200 `#E6E0D4`** border, 10px corners and no shadow.
- Text **Night 950 `#0B1120`**. Secondary text is **Night 600 `#4A5570`**.
- One accent, **Lamp 500 `#F5A524`**, used only for "look here": a 3px left border on quotes. Amber text on paper must be **Lamp 700 `#9A5B00`**. Never use amber for backgrounds, buttons or decoration.
- Fonts: **Geist** (headings 600, slight negative tracking, sentence case) and **Geist Mono** for quotes, URLs, eval numbers and timestamps.
- Quotes look like the app's flagged-quote box: a **Lamp 100 `#FFF1D6`** background, a 3px Lamp 500 left border, Geist Mono text.
- Logo: `brand/logo/vigil-lockup.svg`, small, top left of the title card only. Don't recolor or redraw it.
- Footer on every card, small, in Night 600: "Not legal advice. All flags require human review."

**Before presenting**, fill or delete every `[[…]]`. An eval cell showing `—` means "not measured yet". Leave it as `—`. Never estimate a number or paraphrase a quote.

---

# Vigil

Keeps watch over everything a small advisory firm has published, and flags what may conflict with the SEC Marketing Rule, for a human to review.

---

# The SEC fines advisers for single sentences on public pages

**$75,000**
One adviser, Sept 2025. Its website said it had no conflicts of interest, while its own Form ADV disclosed conflicts.

**9 advisers, $1.24M**
One day in Sept 2024. The claims were on websites, third-party sites and social media: "conflict-free", "Top 12" when the ranking was Top 1200, and undated awards.

**9 advisers, $850k**
Sept 2023, for hypothetical performance shown on their websites.

Sources: SEC IA-6916; SEC press release 2023-173; Goodwin, Lowenstein client alerts.

---

# Small firms can't watch everything they've published

- The median SEC-registered adviser has **8 employees**. The compliance officer usually has other jobs too.
- In Dec 2025, SEC examiners reported stale marketing, and written policies that **don't cover websites or social media**.
- Advisers must keep **a copy of every ad for five years** (Rule 204-2). A website changes without anyone filing a copy.

> "I put the name of the firm into a search … and said the name of the firm news today."
> — compliance tester, on how they find content that skipped review

> "it's easy to do shortcuts. And so when that happens, you're probably missing such a a global view"
> — compliance tester

---

# And the volume is growing

Advisers now write marketing with AI, so there's more of it to review, and it goes out faster.

> "AI in this environment is contributing to the production of misleading information and can be, in fact, making it harder to identify truth from fiction."
> — former regulator tester

A weekly search can't keep up. Vigil uses AI to review it, and a person makes every call.

---

# How Vigil works

**Discover → Capture → Detect → Review**

Everything runs inside one Base44 app. Bright Data does the web access. The LLM only suggests. A person decides.

---

# 1 · Discover: find what the firm has published

- **The firm's own site:** homepage links, `sitemap.xml` and sitemaps listed in `robots.txt`. Scoped to the firm's path.
- **Pages about the firm:** 5 Bright Data SERP queries (LinkedIn, reviews, "top advisor", press releases, podcasts). At least a third of the slots go to off-site pages.
- **Filtered:** at most 25 URLs, deduped, each labelled by channel. Tracking parameters and personal profiles are dropped. Business pages only.

Live on the demo firm: **10 of 10 pages found**.

---

# 2 · Capture: keep evidence of what the page said

- Bright Data **Web Unlocker** fetches each page as markdown and a full-page screenshot, **in parallel** (~13 s per URL).
- Each page is stored with its URL, channel, **UTC capture time** and **SHA-256 hash**. The screenshot is stored as a file in Base44.
- Cost guards: up to 25 URLs per scan in batches of 5, no retries, and every call is logged.

`{url, channel, markdown, fetched_at, sha256, screenshot_ref}`

---

# 3 · Detect: read for meaning, then prove every flag

1. Split each page into chunks of 6,000 characters.
2. A regex pre-pass finds cues ("guarantee", "gross", "back-tested", ranked) and passes them to the LLM as **hints, not flags**.
3. The LLM reads each chunk against **8 Marketing Rule categories**, with "flag" and "don't flag" examples. Page text is fenced off as **data, never instructions**. Output must match a JSON schema.
4. Filters: drop confidence below 0.5; drop a flag when the required disclosure is nearby; **keep a flag only if its quote is an exact substring of the page.**

> "Our clients have never lost money in a down year."

No trigger word. A keyword list misses it. Vigil flags it.

---

# 4 · Review: the AI suggests, the compliance officer decides

- Each flag shows the **exact quote highlighted**, the screenshot, the capture time and a link to the live page.
- On request, Vigil drafts a rewrite that replaces the whole sentence and adds any missing disclosure.
- **Approve, edit or dismiss.** Nothing publishes on its own. Every decision is stored with a timestamp in an audit log.
- A printable "before your exam" summary lists every open flag with its quote, page and capture date.

[[Screenshot: flag detail with the highlighted quote and page screenshot]]

---

# What testers told us, and what we changed

| They said | We changed |
|---|---|
| "I would be doubting the flag if I found that the tool was repeatedly … having false positives." | We optimize for precision first. One-click dismiss, and every dismissal is logged. |
| "actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad" | Every flag shows a screenshot, the capture time and a live link. |
| "verify that it was … not a sample of something that somebody was using to illustrate a misleading advertisement" | Vigil no longer flags examples of what not to say, or quoted rule text. |
| "people continue to use new words that that aren't part of the the typical lexicon" | An LLM that reads for meaning instead of a word list. |
| "it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results." | A human decides every flag. Audit log and disclaimer on every screen. |

---

# Evals: what we measured

| Test | Keyword baseline | Vigil |
|---|---|---|
| 37 synthetic cases: F1 | 0.70 | **0.95** |
| Clean documents wrongly flagged | 28% | **0%** |
| Flags quoting text that exists on the page | — | **100%** |
| Real crawl of the demo firm: planted issues found | — | **9 / 11**, 0 false alarms |
| Hard cases (paraphrase, buried claims): F1 | — | — |
| Educational text and quoted bad ads: wrongly flagged | — | — |
| Prompt-injection pages: wrongly steered | — | — |
| Same page run 3 times: identical flags | — | — |
| Testers' "don't flag examples" fix: before → after | — | — |

All test cases are synthetic and haven't been reviewed by a compliance professional yet. `—` means not measured yet.

---

# Next

Dated snapshots of every page, so a firm can show an examiner what its site said on any past date.

Built with Base44 and Bright Data.
