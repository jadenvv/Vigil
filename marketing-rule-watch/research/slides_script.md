# Vigil pitch: 3-slide script

Paste the three cards below the line into Gamma → Paste in text → **Preserve this exact text**. Numbers and their caveats come from `slide_numbers.md`; quotes are verbatim from `what_we_changed.md` / `sense_checks.md`.

**Gamma instructions:** Keep it simple above everything else. Use the text exactly as given and add nothing: no icons, stock photos, AI images, gradients or emoji. Lots of empty space, left-aligned. Plain tables with hairline rows. Quotes in a light amber box with a thin amber left border, in a monospace font.

**Theme (match the app):** background `#FAF8F4`; white cards, 1px `#E6E0D4` border, 10px corners, no shadow; text `#0B1120`, secondary `#4A5570`; accent `#F5A524` only on quote borders, quote fill `#FFF1D6`; Geist (headings 600) + Geist Mono for quotes and numbers; logo `brand/logo/vigil-lockup.svg` small on card 1; footer "Not legal advice. All flags require human review."

---

# Small advisory firms get fined for one sentence on a public page

- **$75,000:** one adviser, Sept 2025. Its website said "no conflicts of interest".
- **9 advisers, $1.24M:** one day in Sept 2024. Claims on websites, third-party sites and social media.
- The median SEC-registered adviser has **8 employees**. Nobody's job is watching every page.
- **AI-written content is growing that pile.** Posts drafted in seconds get published faster than anyone can review them, and each one can carry the same one-sentence risk.
- **What we replace: a person and a search box.** Compliance tools mostly review what staff submit before it goes out, or archive the firm's own site. Finding what's already public, including pages about the firm, and reading every sentence of it is still done by hand.

> "I put the name of the firm into a search, um, and said the name of the firm news today."
> — Sense interviewee, on the search they run by hand **every week** to find what skipped review

> "you're gonna have to have a person or people go through and review them and make judgment calls." … "you're probably missing such a a global view"
> — a second Sense interviewee, asked how marketing issues slip through

---

# Vigil finds what the firm has published and flags what needs review

**Discover → Capture → Detect → Review**, inside one Base44 app

- **Discover + capture:** Bright Data search and Web Unlocker find the firm's pages and pages about it, and save each with a screenshot, capture time and hash.
- **Snapshots:** when a page changes, Vigil keeps a new dated copy and the exact diff, so a firm can show an examiner what any page said on any past date.
- **Detect:** an LLM reads for meaning across 8 Marketing Rule categories. No quote found word for word on the page, no flag.
- **Review:** the AI suggests a rewrite. The compliance officer approves, edits or dismisses, and every decision is logged.

On our fictional demo firm: found 9 of 11 planted issues, we fixed the 2 misses, now **11 of 11, 0 false alarms**.

---

# What testers told us, and what we changed

| They said | We changed | Measured |
|---|---|---|
| "I would be doubting the flag if I found that the tool was repeatedly … having false positives." | Precision first, one-click dismiss | Clean docs wrongly flagged: **28% → 0%** |
| "people continue to use new words that that aren't part of the the typical lexicon" | An LLM that reads for meaning, not a word list | F1 **0.70 → 0.98**; tester-style issues caught **0/5 → 5/5** |
| "verify that it was … not a sample of something that somebody was using to illustrate a misleading advertisement" | Don't flag examples or quoted rule text | Example text wrongly flagged **2/2 → 0/2**; the firm's own claim still caught |
| "actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad" | Every flag shows the exact quote, a full-size screenshot, the capture time and a live link | — |
| "when the advertising department would identify misleading ads, they would request follow-up information." | Vigil searches the same public pages, including pages about the firm, so the firm sees them first | Pages found: firm's own **10/10**, third-party **7/7** |
| "it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results." | Human decides every flag, audit log, disclaimer on every screen | — |

Rows 2–3 changed after the calls; rows 1 and 4–6 were already built, and the calls told us to keep them. Keyword baseline → Vigil. One run each, on synthetic test cases we wrote; not reviewed by a compliance professional. Row 5 is a simulated search over 13 pages we labeled.

---

## Run of show (~3¼ minutes, not for the slides)

Order: **Slide 1 → Slide 2 → live demo → Slide 3.** Slide 2 sets up the demo, so keep it short and let the app show the details.

**Slide 1 (30 s).** The SEC fines small advisers for single sentences: $75k for "no conflicts of interest" on a website. These firms have about 8 people. Today the check is manual. One person we interviewed through Sense types the firm's name into a search engine every week. Another said that, a lot of times, this manual search misses a global view. Compliance software exists, but it mostly reviews what staff submit or archives the firm's own site. Going out and reading what's already public about the firm is still a person with a search box. That's what we replace. And AI-written posts mean there's more to review every month, published faster than anyone can read them.

**Slide 2 (20 s).** Vigil does that search for them, on every page. Four steps: discover, capture, detect, review. And every capture is kept with its date, so when a page changes the firm can show an examiner exactly what it said before. Let me show you.

**Demo (90 s).** Switch to the Base44 app.
1. **Scan.** Enter the fictional firm, Quarrywick Wealth, and start a scan. Say: "Bright Data finds the firm's own pages and pages about it." If the live scan is slow, open the stored results (demo mode) and say so.
2. **Findings.** Show the list of potential issues across pages. Say "potential issues for review", never "violations".
3. **Open one flag.** Point at the highlighted quote, the page screenshot and capture time, and the plain-English why. Say: "No quote found word for word on the page, no flag."
4. **Rewrite → approve.** Ask for a rewrite, edit a word, approve. Say: "The AI suggests; the compliance officer decides."
5. **Audit log / exam view.** Show the logged decision with its timestamp. Say: "This is what you hand an examiner."

Fallback: a recorded video of the same five steps. Never demo on a real firm.

**Slide 3 (45 s).** Each row is a worry we heard on a call. The biggest was false positives. We'd already built for precision, and the call told us to keep it that way: on 18 test documents with nothing wrong in them, keyword rules raised a false alarm on 5; Vigil on none. A tester assumed AI meant a word list. On issues worded without the usual trigger words, a word list caught 0 of 5 and Vigil caught 5 of 5. A former regulator wanted proof a flag was a real ad, not an example in an article, so we stopped flagging examples, and every flag carries the screenshot and a live link to re-find it. They also told us regulators search public ads and follow up. Vigil searches those same pages first. These are our own synthetic cases, one run each.
