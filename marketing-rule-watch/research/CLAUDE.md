# Person 1 — Lead: users, mentors, pitch

Read the root `CLAUDE.md` first. You own the team's contact with reality: testers, mentors, and the final pitch.

## Tools
- Claude Code with the **Sense Check MCP** (launches tester calls and fetches results)
- Google Docs for slides; this folder for the feedback log
- Devin (you kick off its job)
- You run **no product code**

## Manual setup
1. Sign the team up **once** at `check.testwithsenseai.com` with event code `TALKTOUSERS`. One person, one token for the whole team. Signing up again doesn't work, because the name is taken.
2. Copy the Claude Code command from the sign-up page, run it in this repo, and restart Claude Code.
3. Ask the agent to call `list_tests`. It should say **3 sense checks left**.
4. Put the token in the team note. It's shown once. If lost, ask an organizer.

## Sense Checks

| Block | Time | Send | Ask |
|---|---|---|---|
| 1 | 12–1 | Idea + theme (description below) | Hypotheses 1 and 2 |
| 2 | 3–4 | Live Base44 link from P2 (or 1–3 screenshots) + one-line description | What would stop you from using this? |
| 3 | 6–7 | Live link + your own question | Would you trust these flags without checking each one? |

**Rules:**
- Each launch spends **1 of 3**. Edits are free until launch. **Confirm with the team before saying "launch."**
- **Testers hear the description word for word.** Describe the product; don't instruct.
- **Open the preview before launching.** Screenshots must hide keys, tokens, team names and client data.
- Calls under 7 minutes don't count. A check closes after 3 calls or 1 hour.
- Ask open questions ("what would stop you…"), not "do you like it?"

**Block 1 description:**
> An AI tool for compliance officers at small investment advisory firms. It continuously scans everything a firm has published online — its website, blog, social posts and third-party pages — and flags language that may conflict with the SEC marketing rule, such as guarantees, testimonials without disclosures, or performance numbers without the required context. It keeps dated snapshots of what each page said, and drafts a compliant rewrite for the compliance officer to approve.

**Who it's for:** compliance officers and advisors at small investment advisory firms. **Theme:** catch what humans miss.

## Feedback log (`research/sense_checks.md`)
After every call, add:
```
## Check <n> — <time>
Asked: <question>
Tester <A/B/C> (<role>): "<verbatim quote>"
Insight: <one line>
Change we made: <what> — commit <sha> — eval delta <from P4's compare report>
```
**Quotes are verbatim.** Never paraphrase them into something stronger. Send new insights to P2 (UI) and P4 (detector) within 15 minutes of each check closing.

## Mentor questions

| Mentor hour | Ask |
|---|---|
| **1:30, urgent** | Can Base44 backend functions make outbound HTTPS calls and be exposed as an endpoint? Is there a built-in LLM on the Builder plan? |
| 2–3 | Does Bright Data used inside the app count for the Bright Data track? Are our rule paragraph refs right? Prize amounts? |
| 5–6 | Demo feedback; does our "what we changed" story land? |

Broadcast the 1:30 answer to everyone. It decides plan A or B in `base44/CLAUDE.md`.

## Kick off Devin (by 1:15)
Give Devin the brief in `demo-site/CLAUDE.md`. Claim your code at trydevin.ai/talk-to-users-hackathon (expires Oct 17). Check in at 1:30 for the public URL and pass it to P3.

## Pitch (1–3 slides, built from 5:00, final by 7:30)
1. **Problem in their words:** the strongest tester quote plus the hidden problem we found.
2. **Live demo:** crawl → flag with quote and screenshot → rewrite → approve. Have a recorded fallback video.
3. **What we changed and why:** quote → change → eval delta (from P4). Roadmap in one line.

Judges look for: works live, user feedback, the hidden problem, real pain, creativity. Only claim sponsor integrations that shipped.

## Submit by 7:45.
