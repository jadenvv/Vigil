# Vigil pitch: 3-slide script

The text of the final deck ("Vigil Pitch"), which is the ground truth for what we present. Every number is mapped to its source in `slide_numbers.md` → "What the final deck says"; quotes are verbatim from `what_we_changed.md` / `sense_checks.md`. The Gamma and theme notes below are from the first draft.

**Gamma instructions:** Keep it simple above everything else. Use the text exactly as given and add nothing: no icons, stock photos, AI images, gradients or emoji. Lots of empty space, left-aligned. Plain tables with hairline rows. Quotes in a light amber box with a thin amber left border, in a monospace font.

**Theme (match the app):** background `#FAF8F4`; white cards, 1px `#E6E0D4` border, 10px corners, no shadow; text `#0B1120`, secondary `#4A5570`; accent `#F5A524` only on quote borders, quote fill `#FFF1D6`; Geist (headings 600) + Geist Mono for quotes and numbers; logo `brand/logo/vigil-lockup.svg` small on card 1; footer "Not legal advice. All flags require human review."

---

# One sentence on a website can cost a small firm $75,000

- **01 · It goes up:** "no conflicts of interest". One adviser's website said this, word for word.
- **02 · Nobody reads it:** **8** employees at the median SEC-registered adviser. No one's job is reading every page.
- **03 · The SEC reads it:** **$75,000**, the SEC's fine for that one sentence, Sept 2025.
- Today the only check is **a person with a search box**, and AI-written marketing teams keep adding inconsistent pages for them to read.

If asked whether it's a one-off: on one day in Sept 2024, the SEC fined nine advisers $1.24M in total for claims on websites, third-party sites and social media.

> "I put the name of the firm into a search, um, and said the name of the firm news today."
> — Sense interviewee, on the search they run by hand **every week**

> "you're gonna have to have a person or people go through and review them and make judgment calls." … "you're probably missing such a a global view."
> — a second Sense interviewee

---

# So Vigil reads every page before an examiner does

Built for firms extremely slow to adopt AI: a Sense interviewee in the field assumed AI tools just match keywords.

- **01 Finds the pages:** its own site and sites about it. Live: **15 potential issues on 9 of 11 pages**, 4 of them on a third-party review site.
- **02 Saves · 03 Reads:** the exact quote, highlighted on the page as captured, and why.
- **04 A person decides:** approve, edit or dismiss proposed changes. All logged.
- **Base44** runs all of it: screens, data, 9 functions, its built-in LLM, sign-in. **Bright Data** fetches every page and screenshot; SERP finds pages about the firm. **Daytona**: a sandbox recomputes a stated return to check the math. **Devin** built AdvisorQuill, the fictional review site we scan.

Demo firm: **11 of 11** planted issues on its own site, 0 false alarms (9 of 11 at first; we fixed both misses on that site). AdvisorQuill: **4 of 4** planted issues, 0 clean passages flagged; one page, one run.

---

# Then we showed testers, and their worries shaped it

| They said | So we | Measured |
|---|---|---|
| "AI is … making it harder to identify truth from fiction" | Scraped their actual pages to test on | **24** eval cases from real fined ads and the firms' archived pages |
| "I would be doubting the flag … repeatedly having false positives" | Made sure to perfect precision | Clean docs wrongly flagged **28% → 0%** (5 of 18 → 0 of 18) |
| "not a sample … to illustrate a misleading advertisement" | Skip examples and quoted rules | Examples wrongly flagged **6/6 → 0/6**; the firm's own claim still caught |

**Wrong flags vs a plain one-prompt LLM: 4 vs 111.** Same model, all 125 cases in 8 sets: Vigil caught 76 of 77 issues, the plain prompt 75. But the plain prompt flagged 19 of 56 clean cases; Vigil flagged 3. F1 0.97 vs 0.57 (Claude Haiku). On cases inspired by tester feedback and worries: 0 vs 10 wrong flags.

Footer: 13% of our 180 eval cases come from 12 real SEC orders that fined advisers; we wrote the rest. One run each. Not legal advice.

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

**Slide 3 (45 s).** Each row is a worry we heard on a call. The biggest was false positives. We'd already built for precision, and the call told us to keep it that way: on 18 test documents with nothing wrong in them, keyword rules raised a false alarm on 5; Vigil on none. A former regulator wanted proof a flag was a real ad, not an example in an article, so we stopped flagging examples, and every flag carries the screenshot and a live link to re-find it. They also told us regulators search public ads and follow up. Vigil searches those same pages first. Bottom band: is this just ChatGPT with a prompt? We built that too and ran both on the same model over all 125 cases: wrong flags 4 vs 111, F1 0.97 vs 0.57 (Claude Haiku, next detector version, not yet live). These are our own cases, one run each.
