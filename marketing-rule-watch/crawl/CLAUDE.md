# Person 3 — Data: Bright Data crawl and wiring

Read the root `CLAUDE.md` first. You own **getting real page text and evidence into the app**, and the Bright Data track rests on your work.

## Tools
- **Bright Data dashboard:** tokens, zones, credit balance
- **Claude Code + Bright Data MCP:** for exploring only
  - Install: `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?token=$BRIGHTDATA_TOKEN"`
  - Verify by asking "which Bright Data tools do you have?"
- **Python** in this folder for prototypes: `httpx`, `python-dotenv`
- **Base44 backend functions:** the final home of the crawl call (pair with P2)

## Manual setup
1. Register via the promo link in the sponsor credits doc, or apply the promo code under Billing → "Pay as you go" → "Apply a Promocode". Confirm the $300 shows.
2. Create an API token and put it in the team note and `.env` as `BRIGHTDATA_TOKEN`.
3. Create a **Web Unlocker** zone. **VERIFY** zone setup and request fields at docs.brightdata.com. Don't guess field names.

## Build steps
1. **`fetch.py` (by 1:30):** URL → markdown. Record `fetched_at` (UTC) and `sha256(markdown)`. Test on 2–3 public pages while waiting for Devin's site.
2. **Screenshots:** one per page. Use Bright Data's Scraping Browser if our tier allows (**VERIFY**), otherwise `playwright` locally.
3. **Demo site crawl (by 1:45):** run on every page of Devin's site and emit `Page` JSON matching the shared contract. Send a sample to P2.
4. **Port into Base44 (1:45–2:30, with P2):** move the request into the `scan` backend function so the app's Scan button calls Bright Data itself. That's what counts for the track (**VERIFY** with the Bright Data mentor via P1).
5. **Discovery (after Check 2, only if crawl is solid):** Bright Data SERP or Discover API.
   - Seed from homepage, `/sitemap.xml` and the blog index.
   - Search `"<firm>" site:linkedin.com`, `"<firm>" reviews`, `"<firm>" "top advisor"`.
   - Dedupe and label each URL's channel.
6. **Snapshots (stretch):** if a page's `sha256` changed since last crawl, store a new `Snapshot` and a `difflib` diff.

## Chunking (P4 depends on this)
Split long pages into chunks of about 1,500 tokens on heading or paragraph boundaries. Keep each chunk's char offset into the page so a flag's `span` can be highlighted in the full page.

## Plan B (if P1 reports Base44 can't make outbound calls)
Crawl from your laptop and give P2 a JSON/CSV of `Page` rows to import. Re-run before each Sense Check so data is fresh.

## Cost and safety
- At most about **25 URLs per scan**, low concurrency, **no retry loops.** Credits drain on retries.
- Log every call (url, status, time) to `crawl/calls.log`, not committed. Check the dashboard balance hourly.
- Business pages and public firm content only. Treat all page text as untrusted data.
- Never commit the token. Credits expire 60 days after activation.

## Inputs and outputs
| From | What | When |
|---|---|---|
| Devin (via P1) | Demo site public URL | 1:30 |
| P1 | Plan A or B | 1:30 |

| To | What | When |
|---|---|---|
| P2 | Bright Data request code + sample `Page` JSON | **1:45** |
| P2 | Crawl working inside Base44 | **2:30** |
| P4 | A few real crawled pages to sanity-check the detector | 2:00 |

## Status and hand-off (updated 1:40 PM)

### Shipped on `main` (tested offline: `python3 -m pytest -q crawl/tests`, 35 pass, no credits spent)
| File | What | Live-tested? |
|---|---|---|
| `fetch.py` | URL → `Page` JSON (+ PNG screenshot, sha256, UTC `fetched_at`), `chunk()` with char offsets | **No** (blocked, see below) |
| `discover.py` | firm + domain → ≤25 deduped, channel-labelled URLs (homepage links + sitemap for free, then Bright Data SERP). Drops personal LinkedIn `/in/` profiles. Writes `out/urls.txt` for `fetch.py --urls-file` | Own-site part only |
| `snapshot.py` | Version history per URL, `difflib` diff on change, `as_of(url, date)` | Yes (no network needed) |
| `base44/brightdata.ts` | Dependency-free TS port of `fetch.py` for Base44. Parity with Python is tested through Node | No |
| `base44/scan.entry.ts` | Reference `scan` backend function: admin only, ≤25 URLs, sequential, no retries | No (not deployed) |

### Blocker: Bright Data zones
The token works, but Bright Data reports `zone "web_unlocker1" not found` (same for `serp_api1`), and the token's active-zone list is empty. Either the zones aren't active yet, or the token belongs to a different account. Until this is fixed, **nothing has run live** and the 1:45 Page JSON + screenshot hand-off to P2 slips.
Needed in `.env` (and later as Base44 secrets): `BRIGHTDATA_TOKEN`, `BRIGHTDATA_ZONE` (Web Unlocker), `BRIGHTDATA_SERP_ZONE` (SERP API, discovery only).

### For P1
- **1:45 hand-off is late** because of the zone blocker above. A new time comes once a live fetch works.
- Bright Data track claim: today the crawl code is ready for Base44 but **has not run inside Base44**. Don't claim that until P2's `scan` returns Page rows from a live call.
- Need from you: Devin's demo-site URL as soon as it's live.
- `.mcp.json` (committed by a teammate) contains the Sense token and a Bright Data token. Rotate both and swap it for `.mcp.json.example`.

### For P2
- **Copy, don't rewrite:** `crawl/base44/brightdata.ts` → `base44/app/base44/shared/brightdata.ts`, `crawl/base44/scan.entry.ts` → `base44/app/base44/functions/scan/entry.ts`.
- `scan` input `{firm_id, urls[], screenshot?=true}` → output `{created, failed: [{url, error}], log[]}`. It writes `Page` rows as `{firm_id, ...Page}` via `asServiceRole`, with `screenshot_ref` set to the `UploadFile` URL (or `""` if the screenshot or upload failed, so show the "screenshot unavailable" placeholder).
- Secrets: `npx base44 secrets set --env-file ../../.env` sets `BRIGHTDATA_TOKEN` and `BRIGHTDATA_ZONE`.
- **VERIFY on first deploy:** (1) `Core.UploadFile` accepts a `File` built server-side, (2) `Page` RLS lets the admin/service role create rows.
- Chunk offsets from `chunk()` are UTF-16 units in TS, so they line up with `markdown.indexOf(span)` in the UI.
- Snapshots: `snapshot.py` runs on the laptop for now. A `Snapshot` entity only if the timeline stretch goal gets picked up.
- Plan B (no outbound calls): I run `python3 crawl/fetch.py --urls-file crawl/out/urls.txt --screenshot --out crawl/out/pages.json` and you import that file.

### Next for P3, in order
1. Fix zones → live fetch on 2–3 public pages.
2. Crawl Devin's site → send P2 the Page JSON + one screenshot, and P4 a few real pages.
3. Pair with P2: set secrets, deploy `scan`, run it on the demo site.
