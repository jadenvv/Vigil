# Person 2 — App builder (Base44)

Read the root `CLAUDE.md` first. You own **the product people actually see**: the live link Sense testers open and the thing we demo to judges.

## Tools
- **Base44 in the browser** (prompt its AI builder). No local code.
- This folder holds **copies** of Base44 backend function code and entity schemas, so the team and agents can review them. Paste in after each meaningful change.

## Manual setup
1. Create the Base44 account.
2. Get the **Builder plan** applied. It was covered in Ore Segal's 10 AM talk, so ask an organizer if unsure.
3. Create the app.

## Entities (mirror the shared contracts in root `CLAUDE.md`)
- `Firm {name, domain, advisor_names[]}`
- `Page {firm_id, url, channel, markdown, fetched_at, sha256, screenshot_ref}`
- `Flag {page_id, category, span, rule, confidence, why, status: open|approved|rejected}`
- `Decision {flag_id, action: approve|edit|reject, final_text, decided_at}`
- `Snapshot` (stretch): same fields as `Page`, one row per crawl

## Screens, in build order
1. **Firm setup:** name, domain, advisor names → "Scan" button.
2. **Findings inbox:** flags sorted by severity × confidence, grouped by page.
3. **Flag detail:** the page text with `span` highlighted in context, the screenshot, category, "why", and the rule ref (hide the ref until a mentor confirms it).
4. **Demo mode (by 2:45):** a no-login path preloaded with the demo firm's findings. Testers open the link mid-call and must see findings instantly.
5. **Rewrite drawer (after Check 2):** side-by-side original vs suggested text with Approve, Edit and Reject. Writes a `Decision`.
6. **Snapshot timeline (stretch).**

## Copy rules
- "**Potential issue for review**", never "violation" or "non-compliant".
- Footer on every screen: "Not legal advice. All flags require human review."
- No login wall in front of testers. Base44 built-in auth only. No Clerk.

## Backend functions: plan A or B (P1 confirms by 1:30)

**Plan A — Base44 can make outbound calls (VERIFY):**
- `scan(firm_id)`: calls Bright Data (P3 provides the request code) → creates `Page` rows.
- `detect(page_id)`: calls the LLM with P4's prompt, applies the grounding filter (drop any flag whose span isn't an exact substring of the page) → creates `Flag` rows.
- `rewrite(flag_id)`: calls the LLM with P4's rewrite prompt.
- If possible, expose `detect` as an HTTP endpoint so P4 can run the eval against the live version.

**Plan B — no outbound calls:**
- Detection uses Base44's built-in LLM integration (**VERIFY** it exists on the plan) with P4's prompt.
- P3 crawls from a laptop and imports `Page` rows (CSV/JSON import or an admin form).
- Demo still works end to end on stored pages.

## Inputs and outputs
| From | What | When |
|---|---|---|
| P3 | Bright Data request code + sample `Page` JSON | 1:45 |
| P4 | Detection prompt + grounding logic | 2:30 |
| P4 | Rewrite prompt | ~5:00 |
| P1 | Tester feedback to act on | within 15 minutes of each check |

| To | What | When |
|---|---|---|
| P1 | **Live link with demo mode** | **2:45** |
| P1 | Screenshots for slides | 7:00 |

## Done means
A tester opens the link, sees the demo firm's flags, clicks one, and sees the quote highlighted with a screenshot and a plain-English "why". No login, no error, under 10 seconds.
