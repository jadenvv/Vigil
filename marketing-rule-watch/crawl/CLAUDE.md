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

## Status and hand-off (updated 3:50 PM; P3's work picked up by Ethan)

### Shipped on `main` (`python3 -m pytest -q crawl/tests`: 47 pass offline, no credits; the TS parity tests need Node ≥ 22.6)
| File | What | Live-tested? |
|---|---|---|
| `fetch.py` | URL → `Page` JSON (+ PNG screenshot, sha256, UTC `fetched_at`), `chunk()` with char offsets | Via its TS port (below) |
| `discover.py` | firm + site → ≤25 deduped, channel-labelled URLs: homepage links + sitemap + robots.txt sitemaps (free), then 5 Bright Data SERP queries: LinkedIn, reviews, "top advisor", **press releases**, **podcasts/interviews**. At least a third of the slots go to off-site hits. A site under a path (`user.github.io/repo`) is scoped to that path, so another repo on the same account counts as third-party. Drops personal profiles (LinkedIn `/in/`, Instagram, Facebook people/posts, Forbes `/profile/`), net-worth spam and tracking params. Same rules as `base44/app/base44/shared/discover.ts` (parity test: `tests/test_discover_ts.py`). Writes `out/urls.txt` for `fetch.py --urls-file` | **Yes**: SERP on a public business earlier (shape `organic[].link`); site-only on the live demo, 10/10 pages (3:50 PM). The 2 new queries are **not** live-tested yet |
| `snapshot.py` | Version history per URL, `difflib` diff on change, `as_of(url, date)` | Yes (no network) |
| `base44/brightdata.ts` | TS port of `fetch.py` for Base44, parity-tested against Python. Markdown and screenshot now fetched **in parallel** | **Yes**: example.com in 12.9 s total (7.4 s markdown, 12.8 s screenshot, 89 KB PNG) vs ~20 s back to back |
| `base44/scan.entry.ts` | `scan` backend function: admin only, ≤25 URLs, sequential URLs, no retries | **Yes, by P2 inside Base44** (2 pages + screenshots, HTTP 200) |

Zones (both active): Web Unlocker `web_unlocker1`, SERP `serp_api1`. Set in `.env` as `BRIGHTDATA_ZONE` / `BRIGHTDATA_SERP_ZONE`.

### Known live quirks
- **Speed:** ~13 s per URL with a screenshot (the screenshot is the slow part). The Base44 docs we have don't state a function time limit (**VERIFY**), so keep P2's batches of 5 per `scan` call.
- **SERP:** one query returned HTTP 200 with an empty body after ~50 s. It's logged as a warning and not retried; that query just contributes no URLs.
- **Parallel fetch cost:** a screenshot credit is spent even when the markdown fetch for that URL fails.

### For P1
- **Bright Data track:** Bright Data runs **inside Base44** (P2's `scan` run, 2 pages, HTTP 200). Still ask the Bright Data mentor whether that counts, and don't claim more than that.
- Discovery's off-site search works live, so the "risk lives outside the review workflow" story can be shown with real LinkedIn/review URLs. It's a laptop script today, not in the app.
- Demo site: `https://nathanqiu07.github.io/quarrywick-wealth-demo/`. Discovery finds all 10 pages (it found 2 before the subpath fix).
- Discovery now also searches **press releases** and **podcast/interview appearances** (offline eval: third-party recall 5/7 → 7/7, `eval/reports/discovery_v2.json`). That's a simulated web; say "in our offline test", not "finds every podcast".
- `.mcp.json` (committed by a teammate) contains the Sense token and a Bright Data token. Rotate both and swap it for `.mcp.json.example`.

### For P2
- **Re-copy `crawl/base44/brightdata.ts` → `base44/app/base44/shared/brightdata.ts` and redeploy functions** to get the parallel fetch (~35% faster per URL). Same exports, same `scan` input/output; `scan.entry.ts` didn't change.
- `scan` input `{firm_id, urls[], screenshot?=true}` → output `{created, failed: [{url, error}], log[]}`. `screenshot_ref` is the `UploadFile` URL, or `""` if the screenshot or upload failed (show the "screenshot unavailable" placeholder).
- Keep `SCAN_BATCH_SIZE = 5` until someone confirms Base44's function time limit.
- Chunk offsets from `chunk()` are UTF-16 units in TS, so they line up with `markdown.indexOf(span)` in the UI.
- **Redeploy `discover` and `scan`**: `shared/discover.ts` (2 new queries) and `shared/brightdata.ts` (`guessChannel`: podcasts → `other`, AdvisorQuill → `review_site`) changed. A scan with search on now makes 5 SERP calls instead of 3 (about 5 × up to 45 s, sequential), Setup.jsx copy now says "press releases and podcasts" and "about a minute" (estimate from ~13 s per call before; not timed with 5).
- Snapshots: `snapshot.py` runs on the laptop. A `Snapshot` entity only if the timeline stretch goal gets picked up.

### Next for P3
1. Crawl the demo site to Page JSON (needs `.env`, not on this laptop; restore it from the team note after rotating the leaked tokens).
2. Live-test the press and podcast queries once (2 SERP calls) and note whether real results look like the eval's.
3. Stretch, first to cut: snapshot timeline in the app.
