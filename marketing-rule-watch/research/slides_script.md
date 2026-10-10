# Vigil pitch: slide script (paste into Gamma)

Brief: 1–3 slides. Paste everything below the line into Gamma → Create new → **Paste in text** → choose **Preserve this exact text** (not "generate"), card count 3. `---` splits cards.

Before pasting, fill every `[[…]]` placeholder with a measured number or a verbatim quote, or delete it. Don't round up and don't paraphrase quotes.

**Theme settings (Gamma → Theme → Custom):** background Paper 50 `#FAF8F4`, text Night 950 `#0B1120`, accent Lamp 500 `#F5A524` (only for highlights), font Geist (headings 600) with Geist Mono for quotes. Upload `brand/logo/vigil-lockup.svg` as the logo. No stock photos, no gradients, no emoji.

---

# Small advisory firms get fined for one sentence on their own website

Vigil keeps watch over everything you've published.

- The median SEC-registered adviser has **8 employees**. The compliance officer usually has other jobs too.
- The SEC fined one adviser **$75,000** in Sept 2025 over a single line of website copy ("no conflicts of interest").
- In one day in 2024, the SEC settled with **nine advisers for $1.24M**. The claims sat on websites, third-party sites and social media.

**What we only learned by asking:**

> "I put the name of the firm into a search … and said the name of the firm news today."
> — compliance tester, describing their weekly check for content that skipped review

> "an examiner … knows things, and they use that information to get additional information about your company"
> — compliance tester

The tool for finding unreviewed content today is a weekly Google search. Meanwhile, regulators search the same public pages.

**And the volume is growing.** Advisers now write marketing with AI, so there's more of it to review, and it goes out faster.

> "AI in this environment is contributing to the production of misleading information and can be, in fact, making it harder to identify truth from fiction."
> — former regulator tester

A weekly search can't keep up with AI-written copy. Vigil uses AI to review it, and a person makes every call.

[[Check 2: add the strongest verbatim quote about how issues slip through, or delete this line]]

---

# Live: Vigil scans a firm's public pages and flags what needs review

Scan → flag with evidence → suggested rewrite → a person approves, edits or dismisses.

- **Scan:** Bright Data fetches each page and a screenshot, inside a Base44 app.
- **Flag:** an LLM reads for meaning, not keywords, across 8 SEC Marketing Rule categories. Each flag shows the exact quote, the screenshot, capture time and a link to the live page. No quote, no flag.
- **Decide:** the AI suggests, the compliance officer decides. Nothing publishes on its own, and every decision is logged.

**On a real crawl of our fictional demo firm (10 pages, 11 planted issues):**
Vigil found **9 of 11**, with **0 false alarms** and **0 flags on clean content**. [[update if the final run changed]]

**People don't know what AI can do.** We described Vigil, an AI tool, to a compliance professional. They assumed it was keyword matching that can't keep up with new wording:

> "I just don't think any... everything can be caught because people continue to use new words that that aren't part of the the typical lexicon"
>
> "When you find new things, find new words that mean the same thing, you're just adding to that list of words"
> — compliance tester, hearing Vigil described

That's a word list, not AI. Even someone whose job is catching misleading marketing didn't know a model can read for meaning.

Vigil reads for meaning. On the demo site, "Our clients have never lost money in a down year." has no trigger word: the keyword list misses it and flags the risk disclaimer ("guarantee future results") instead. Vigil flags the promise and leaves the disclaimer alone.

**Against a keyword list (37 synthetic test cases):**

| | Keyword baseline | Vigil |
|---|---|---|
| F1 | 0.70 | **0.95** |
| Clean documents wrongly flagged | 28% | **0%** |

Test cases are synthetic and not yet reviewed by a compliance professional. Not legal advice. All flags require human review.

[[Screenshot: flag detail with highlighted quote + page screenshot]]

---

# What testers told us, and what we changed

| They said | We changed |
|---|---|
| "I would be doubting the flag if I found that the tool was repeatedly … having false positives." | Precision first: 0% of clean documents flagged (keyword list: 28%). One-click dismiss, logged. |
| "actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad" | Every flag shows the captured screenshot, capture time and a link to the live page. |
| "verify that it was … not a sample of something that somebody was using to illustrate a misleading advertisement" | Vigil no longer flags examples of what not to say, or quoted rule text. [[eval before → after]] |
| "they use that information to get additional information about your company" | A printable "before your exam" summary of every open flag, with quote, page and capture date. |
| Their unreviewed content was employees venting, not firm marketing | We narrowed scope to content the firm publishes or adopts. |
| "it must be overseen. It must be audited … there must be disclaimer on AI results." | Human decision on every flag, an audit log of decisions, and a disclaimer on every screen. |

[[Check 2 / Check 3 row: quote → change → eval delta, or delete]]

**Next:** dated snapshots of every page, so a firm can show an examiner what its site said on any past date. Advisers must keep copies of every ad for five years (Rule 204-2).

Built with Base44 and Bright Data.
