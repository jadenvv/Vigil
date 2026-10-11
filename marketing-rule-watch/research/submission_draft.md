# Submission draft

Draft for P1 to edit before submitting by 7:45. Every number and claim is from `slide_numbers.md`, `what_we_changed.md` and `sponsor_usage.md`. Anything marked **VERIFY** is not confirmed and must not be submitted as fact.

## Submission text (~250 words)

**Vigil keeps watch over everything a small investment adviser has published.**

Compliance officers at small SEC-registered advisers have to stand behind every piece of marketing their firm puts out: the website, old blog posts, third-party pages. Much of it was never reviewed. One tester told us they search the firm's name plus "news" by hand every week.

Vigil finds what a firm has published online, flags language that may conflict with the SEC Marketing Rule, and shows the evidence for every flag: the exact quote highlighted on the page, a screenshot and the page as captured. A person then approves, edits or dismisses each flag, and every choice goes into an append-only audit log. Vigil says "potential issue for review", never "violation". It isn't legal advice.

One tester said they would doubt the flags if the tool kept raising false alarms; another said people keep using new words that no list anticipates. So we measured both. On our own 37-case synthetic set, clean documents wrongly flagged fell from 28% with keyword rules to 0% with our live LLM detector (one run; we wrote the cases and developed the prompt with them visible). On 10 cases we wrote from testers' comments, keyword rules caught 0 of 5 issues and the live detector caught 5 of 5. On our fictional demo firm, the first scan found 9 of 11 planted issues; we fixed both misses and it now finds 11 of 11 with no false alarms. That site is one we built ourselves, so this is not real-world accuracy.

Everything runs live inside Base44: https://marketing-rule-watch-a0747dd2.base44.app/

## Sponsor tracks

**Base44.** The whole product runs on Base44: the React app and hosting, five entities (Firm, Page, Flag, Decision, Recheck) with row-level security, and nine Deno backend functions (scan, discover, detect, detect-text, rewrite, recheck, page-html, capture-html, check-calculation). Decisions are append-only: anyone can create one, but no one can update or delete it. The detector and rewrite use Base44's built-in InvokeLLM. All 69 calls in the live eval run were answered by it. Screenshots and captured HTML go to Base44 file storage, and sign-in is Base44's Google auth. The demo itself needs no login.

**Bright Data.** Every page Vigil reads comes through Bright Data, called from inside Base44's backend functions. The Web Unlocker request API returns page markdown for detection, a screenshot for evidence, and raw HTML for the "page as captured" view. The re-check button uses it to fetch the live page again and see whether a flagged quote is still there. The SERP API finds pages about the firm elsewhere on the web (admin-only, off in the demo to save credits). Each scan reads at most 25 URLs, one at a time, with no retries. Re-checks are capped at one per page every 10 minutes.

**Daytona.** On a flag's detail screen, a reviewer can check the arithmetic behind a return claim, for example "$10,000 grew to $15,000, a 60% return". A Base44 function validates the numbers and runs one fixed Python script in a fresh Daytona sandbox, which is deleted afterwards. Nothing scraped or written by the LLM is ever executed. A live call on the deployed app returned calculated 50% against the stated 60%: does not match. The tool is admin-only and checks arithmetic only, not whether the performance was real. One gap: we have not confirmed that the sandbox from that live call was deleted, because the function logs were empty.

**Cognition / Devin.** Our product's claim is that risk lives outside the firm's own review process, on pages the compliance officer never sees. Devin built that half of the demo: **AdvisorQuill**, a fictional advisor-review directory (https://nathanqiu07.github.io/advisorquill/). We gave it a written brief. It built a static site listing four invented firms, planted 4 Marketing Rule issues on our demo firm's profile alongside properly disclosed content, added a "fictional website" banner to every page, published the site and updated our answer key. Evidence: PR #4, with commits authored by `Devin <devin@cognition.ai>`. Vigil then caught Devin's issues live: the profile is in the app as a review-site page, and the detector flagged all 4 planted issues under the right categories with none on the clean content. They appear in the public demo. This was one page and one run, and the site was written from our own issue categories, so it is not an independent test.

> **VERIFY before adding:** that Devin built the main firm site, Quarrywick Wealth. There is no Devin commit or PR for it, so leave it out unless we find one.
