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
