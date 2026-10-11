# How we used Devin and Daytona

Two sponsor tools, two different jobs. Devin built the third-party review site our product finds. Daytona runs the math our reviewers check.

## Devin — the fictional firm we scan

> **VERIFY: who built the Quarrywick firm site?** This section says Devin built it, but no Devin-authored commit or PR for it exists. Its only commit, `e73f178`, is by Nathan Qiu, and `PROJECT.md` says a Claude agent built it while Devin was down. Don't claim this half without a Devin session link. The AdvisorQuill site below is proven Devin work.

**What Devin is:** Cognition's AI software agent. You give it a written brief; it writes the code, deploys it, and hands back a live URL.

**What we handed it:** `demo-site/CLAUDE.md` — a self-contained brief: build a static website for a fictional investment advisory firm called **Quarrywick Wealth**. Plain HTML/CSS, no JavaScript, so a crawler can read every word.

**The catch that made it useful:** we asked Devin to plant 11 real Marketing Rule problems on purpose — "#1 retirement firm in the region", a client testimonial with no disclosure, gross returns shown without net — and to write an answer key (`demo-site/ANSWER_KEY.md`) listing each one by page and exact sentence. It also planted clean, correctly-disclosed content so we could prove the tool stays quiet when it should.

**The result:** a live public site — https://nathanqiu07.github.io/quarrywick-wealth-demo/ — ten pages with a visible "fictional firm" banner. This is what Vigil crawls in the demo. Because Devin wrote the site from the same taxonomy our detector scores against, the demo is honest: we know exactly what should be flagged (the answer key) and can measure what the tool actually caught (eval `cases_demo_site.jsonl`: 11/11 planted spans survive extraction).

## Devin — built the third-party review site (verified)

We gave Devin a second brief (`demo-site/DEVIN_THIRD_PARTY.md`): a fictional advisor-review directory, the "risk lives on third-party pages" half of the story. **Devin built it.** It's called **AdvisorQuill** and is live at https://nathanqiu07.github.io/advisorquill/. It lists four invented firms; the Quarrywick Wealth profile has 4 planted issues, and there's one fictional press article. Every page carries a "Fictional website for a hackathon demo" banner. The planted sentences are in `demo-site/ANSWER_KEY.md` under "Third-party site", and the source is in `demo-site/third-party/`.

**Evidence:** PR #4 (`devin/advisorquill-third-party`, merged), with commits `4b6d46b` and `d0d51be` authored by `Devin <devin@cognition.ai>`.

## Daytona — runs the "Check calculation" math

**What Daytona is:** instant, isolated cloud sandboxes. You send code, it runs in a throwaway environment, you get the output back, the sandbox is destroyed.

**The feature:** on a flag's detail screen, a reviewer can check the arithmetic behind a return claim. Example: the page says *"$10,000 grew to $15,000, a 60% cumulative return."* The reviewer picks "cumulative return", enters start 10,000, end 15,000, stated 60%, hits Run — and the result comes back: calculated 50%, does not match. Two modes: cumulative return from start/end values, and compounded total return from a constant annual rate over N years.

**Why a sandbox for arithmetic:** the point is not the math — a calculator could do it. The point is running a **fixed, auditable script in an isolated environment**, exactly the pattern a compliance tool needs for untrusted inputs: nothing scraped or LLM-generated is ever executed, the inputs are JSON, the output is bounded, and the environment is destroyed after every run.

**How it works end to end:**

1. Reviewer fills the form → Base44 backend function `check-calculation` (admin-only, server-side).
2. Backend validates the numbers (finite, start > 0, end ≥ 0, annual ≥ −100%, integer years ≤ 100) — bad input never creates a sandbox.
3. The function embeds one fixed Python script (`shared/calc-check.ts`), feeds it the inputs as JSON, and calls the Daytona SDK: `create sandbox → codeRun(30s timeout) → delete sandbox` in a `finally` block. No retries, output capped.
4. Result returns as JSON: stated %, calculated %, difference in percentage points, match/no-match at a documented 0.05 pp tolerance, the formula used, and a timestamp.
5. Spending protection: identical checks hit a 10-minute result cache, back-to-back launches get a ~5-second cooldown with HTTP 429.

**Verification:** mocked tests cover the math, validation, tolerance boundary, and cleanup on failure. One live smoke test ran the real path — actual sandbox created, script executed, 50% vs claimed 60% returned, sandbox deleted — confirmed on 2026-10-11. In-app admin click-through after deploy is the one check run by hand.

**What it does not claim:** it checks arithmetic against numbers the reviewer typed. It does not verify that the return happened, look at records, or say anything about legal compliance — the UI says exactly that.

## Where the code lives

| Piece | Path |
|---|---|
| Devin brief (firm site) | `demo-site/CLAUDE.md` |
| Devin brief (review directory, built by Devin, PR #4) | `demo-site/DEVIN_THIRD_PARTY.md` |
| Built review directory (AdvisorQuill) | `demo-site/third-party/` |
| Built site + answer key | `demo-site/site/`, `demo-site/ANSWER_KEY.md` |
| Daytona shared module (script, validation, executor) | `base44/app/base44/shared/calc-check.ts` |
| Backend function | `base44/app/base44/functions/check-calculation/entry.ts` |
| UI panel | `base44/app/src/components/CalcCheck.jsx` |
| Live smoke script | `base44/app/scripts/smoke-calc-check.ts` |
| PRs | #2 (feature) and #3 (hardening) on github.com/jadenvv/talktousers-Group3 |
