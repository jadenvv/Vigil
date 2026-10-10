# Sponsor tooling setup

Everything here is project-scoped. Nothing was added to `~/.claude`.
**This repo is public.** Promo codes, coupon codes, API tokens and the Sense Check
bearer live only in the gitignored PDFs and `.mcp.json`. Never paste them into a
committed file.

## What is wired up

| Server (`.mcp.json`) | Needs | Status after clone |
|---|---|---|
| `sense-check` | team bearer token (shared out of band) | works once token pasted |
| `base44` | browser OAuth, no key | run `/mcp` in Claude Code → Authenticate |
| `brightdata` | API token from Bright Data account settings | replace `REPLACE_WITH_BRIGHTDATA_API_TOKEN` |
| `mongodb` | Atlas connection string | replace `REPLACE_WITH_ATLAS_CONNECTION_STRING` |
| `daytona` | `daytona login --api-key <key>` once | CLI stores the login |

`.mcp.json` is gitignored. New machine: `cp .mcp.json.example .mcp.json`, fill it
in, start `claude` in this folder and approve the project servers when asked.

Skills in `.claude/skills/` (committed, auto-load in Claude Code):
`base44-cli`, `base44-sdk`, `base44-remote-dev`, `base44-troubleshooter`,
`scrape`, `search` (Bright Data CLI), `daytona`, `mongodb-mcp-setup`,
`fish-audio-api`, `clerk-setup`. Tracked in `skills-lock.json`.

CLIs installed on Nathan's Mac: `bdata` (Bright Data, `npm i -g @brightdata/cli`)
and `daytona` (prebuilt binary; the brew formula needs Xcode CLT to build).

## Getting each key

Codes and promo links are in **Tech Sponsor Credits - Talk to Users.pdf** and
**Ore Base44.pdf** (both gitignored, ask a teammate).

1. **Bright Data** (grand prize, must be used). Register through the promo link in
   the PDF so the $300 lands. Account settings → API token → paste into
   `.mcp.json`, then `bdata login --api-key <token>` for the CLI. The hosted MCP
   URL has `&pro=1` (60+ tools incl. Yahoo Finance, Reddit, LinkedIn, YouTube,
   TikTok, Crunchbase). To shrink the tool list swap it for
   `&groups=social,finance,business`.
2. **Base44** (track prize, must be used). Builder plan coupon is in Ore's slides.
   In Claude Code run `/mcp`, pick `base44`, sign in. In the Base44 editor the
   **Send to Coding Agent** button gives a paste-ready prompt. Base44 also lets you
   add the Sense Check MCP under Settings → MCP connections (Builder plan).
3. **MongoDB Atlas**. Create an org + free cluster, Billing → Apply Code (code in
   PDF, needs Org Owner), copy the `mongodb+srv://` string into `.mcp.json`.
4. **Daytona**. Sign up at app.daytona.io, Billing → Wallet → redeem the code from
   the PDF, Dashboard → Keys → create key, then `daytona login --api-key <key>`.
   Use the SDK from the app for "recompute in a sandbox" ideas; the MCP is for
   spinning sandboxes from Claude Code.
5. **Fish Audio**. Claim link in the PDF. API key goes in the app's env, not
   here; the `fish-audio-api` skill has the REST/WebSocket contract.
6. **Clerk** ($250, auth/org roles). Only relevant if the app is *not* on Base44
   (Base44 ships its own auth). `clerk-setup` skill covers the quickstart.
7. **Devin** codes expire Oct 17; it is a separate agent, nothing to install here.

## Sense Check reminders

Three checks for the whole day, one per round (12–1, 3–4, 6–7pm). Ask Claude to
call `list_tests`; it should say 3 left. Round 2 needs a live link or 1–3
screenshots. Testers hear the product description word for word: describe, don't
instruct. Launching is irreversible; edit the draft until you are sure.
