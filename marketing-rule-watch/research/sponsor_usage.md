# Sponsor usage: what we actually used, where, and the evidence

Facts only, for judges and the submission. Counts come from read-only queries of the live app's data on 2026-10-10 at about 5:45 PM PT. Paths are relative to `marketing-rule-watch/base44/app/`. No keys, zone names or promo codes appear here on purpose.

## Base44: the whole product runs on it

- **Hosting.** The live app is https://marketing-rule-watch-a0747dd2.base44.app. It's built and deployed with the Base44 CLI (`base44/config.jsonc`, `npx base44 deploy`).
- **Entities (data model).** There are five: Firm, Page, Flag, Decision and Recheck. Schemas are in `base44/entities/*.jsonc`.
  - Live today: 6 firms, 29 pages, 39 flags, 12 decisions and 3 recheck rows.
- **Row-level security.** Every entity can be read publicly, because demo testers aren't signed in. Who can write is limited:
  - Firm, Page and Flag: writes are admin-only (`{"user_condition":{"role":"admin"}}`).
  - Recheck: create, update and delete are admin-only. The function writes it as the service role (`asServiceRole`).
  - Decision: anyone can create one, but nobody can update or delete one, so the audit log is append-only.
- **Backend functions.** Nine Deno functions live in `base44/functions/<name>/entry.ts`. Code shared between them is in `base44/shared/`.

  | Function | What it does | Who can call it |
  |---|---|---|
  | `scan` | Fetches page text and a screenshot (optionally raw HTML) through Bright Data and stores Page rows | Admin |
  | `discover` | Finds a firm's pages: its own site (homepage links, sitemap, robots.txt) and, optionally, Bright Data search results | Site pages: any signed-in user, or signed out for the demo firm's site only. Search: admin |
  | `detect` | Runs the LLM detector on one stored page and writes its Flags | Admin |
  | `detect-text` | Runs the same detector on posted text without saving anything; the eval calls it | Admin; opened only for planned eval runs |
  | `rewrite` | Drafts a suggested rewrite for one flag, then runs detection again on it | Anyone on demo-firm flags; admin otherwise |
  | `recheck` | Fetches a flagged page again live and checks whether the quote is still there; one fetch per page per 10 minutes | Admin, the firm's owner, or anyone on the demo firm |
  | `page-html` | Returns the page as captured, with scripts removed | Anyone for demo-firm pages; admin otherwise |
  | `capture-html` | Adds a captured HTML copy to an existing page without re-scanning it | Admin |
  | `check-calculation` | Recomputes a stated return in a Daytona sandbox | Admin |

- **LLM: Base44 InvokeLLM.** It's the only LLM the live app uses, called via `asServiceRole.integrations.Core.InvokeLLM` in `base44/shared/llm.ts`.
  - **Attribution.** Every detect and rewrite response carries `provider` and `model`. Today's runs all report `base44` / `base44-invokellm`.
  - **Today's calls.** These are counts by run, not platform telemetry:
    - The live eval made 69 calls after 4:00 PM, all answered by `base44`.
    - The post-deploy preview on the demo site made 10 calls.
  - **Fallback that wasn't used.** There's a Groq fallback in the code, but no Groq key is set in the app, so it never ran.
- **Google sign-in.** It's Base44's built-in auth: `base44/auth/config.jsonc` sets `enableGoogleLogin: true` and turns username/password off. The demo needs no login.
- **File storage.** Screenshots and captured HTML are saved with `integrations.Core.UploadFile` (`functions/scan`, `functions/capture-html`).

## Bright Data: every page we read comes through it

- **Web Unlocker via the request API** (`POST https://api.brightdata.com/request`). One zone is used in two modes, and the zone name is kept in a Base44 secret.
  - **Markdown text** (`data_format: "markdown"`) and **screenshots** (`data_format: "screenshot"`). Both go through `base44/shared/brightdata.ts` (`fetchPage`), called by `scan`. `recheck` uses the same code for text only.
  - **Raw HTML** (`format: "raw"`, no data_format) for the "page as captured" view: `base44/shared/page-html.ts` (`fetchRawHtml`), called by `capture-html` and by `scan` when `capture_html` is set.
- **SERP API.** It runs in a separate zone, also kept in a Base44 secret, and reads Google results in JSON (`brd_json=1`).
  - The code is in `base44/functions/discover/entry.ts` (`serp()`), with the query list in `base44/shared/discover.ts`. Search is admin-only and off by default.
- **Limits in code.**
  - At most 25 URLs per scan.
  - Fetches run one at a time and are never retried.
  - Re-checks are capped at one live fetch per page per 10 minutes.
- **Evidence from stored data** (read-only, 5:45 PM):
  - **Pages:** 29 stored. Those created by `scan` are one Bright Data markdown fetch each. The two Hartwell firms' 14 pages are hand-written seed data and may not have been crawled, so treat "up to 29" as the ceiling for markdown fetches, not a count.
  - **Screenshots:** 13 pages have one.
  - **Captured HTML:** 11 pages have it. All 10 demo pages were backfilled at about 4:05 PM.
  - **Re-checks:** 2 live fetches.
  - **Diagnostics:** 1 extra markdown call (5 PM).
  - **Discovery:** the site-only path (homepage, sitemap.xml, robots.txt) uses plain GETs, not Bright Data.
  - **What these numbers miss:** SERP calls made from the app, and the crawl testing on laptops (`crawl/`), aren't recorded in app data, so they're not counted here.
- **Known limitation, confirmed with one call on 2026-10-10.** Bright Data's markdown output drops the last few characters of a page, one for each extra UTF-8 byte (·, ®, curly quotes). On the demo pages only the end of the footer disclaimer is lost. Raw HTML captures are complete.

## Daytona: the "Check calculation" sandbox

- **What it does.** `check-calculation` (`base44/functions/check-calculation/entry.ts`) recomputes a stated return. It runs one fixed Python script, from `base44/shared/calc-check.ts`, in a fresh Daytona sandbox:
  - Create, then `codeRun` with a 30 s timeout, then delete in a `finally` block.
  - The inputs are validated JSON numbers. Nothing scraped or written by the LLM is ever executed.
- **Limits.** Admin-only, with a 10-minute result cache and a 5 s cooldown between launches. No retries. The key is in the `DAYTONA_API_KEY` Base44 secret.
- **Live evidence.** Deployed 2026-10-10 at 5:15 PM PT. One live admin call checked $10,000 → $15,000 against a stated 60%. It returned HTTP 200 in 2.4 s with `ok: true`, `calculated_pct: 50`, `difference_pp: 10`, `match: false`.
  - **Not verified:** that this run's sandbox was deleted. The function logs were empty.
- **Explainer.** See `research/how-we-used-devin-and-daytona.md`.

## Devin (Cognition)

- **Verified: Devin built AdvisorQuill**, the fictional third-party review site, live at https://nathanqiu07.github.io/advisorquill/.
  - **Evidence:** PR #4 (`devin/advisorquill-third-party`, merged), with commits `4b6d46b` and `d0d51be` authored by `Devin <devin@cognition.ai>`.
  - **What it contains:** four invented firms, a Quarrywick Wealth profile with 4 planted issues, one fictional press article, and a "fictional" banner on every page. Source is in `demo-site/third-party/`; the planted sentences are in `demo-site/ANSWER_KEY.md` under "Third-party site".
  - **In the app (confirmed by the orchestrator, about 6:45 PM):** the Quarrywick profile is stored on the demo firm as Page `6acae98a770ded722c7108da`, channel `review_site`.
    - Live detector v3 on Base44 InvokeLLM flagged all 4 planted issues with the answer key's categories, and 0 clean controls.
    - `/demo` shows the 4 flags signed out. The demo firm now has 11 pages and 15 flags. Its own site still has 11 planted issues.
    - *Caveats: one page, one run, and the site was written from our own taxonomy brief, so this is not an independent test.*
- **VERIFY: did Devin build the Quarrywick firm site?** Its only commit (`e73f178`) is by Nathan Qiu, and `PROJECT.md` says a Claude agent built it while Devin was down. Don't claim it without a Devin session link.

The firm site is live at https://nathanqiu07.github.io/quarrywick-wealth-demo/, with its answer key in `demo-site/ANSWER_KEY.md`.
