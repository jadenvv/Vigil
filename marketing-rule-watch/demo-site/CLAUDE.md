# Devin — Demo firm website

Read the root `CLAUDE.md` first. This is a self-contained job: a static website for a **fictional** investment advisory firm, with Marketing Rule issues planted on purpose so our tool has something to find.

## Deliverable (by 1:30 PM PT)
A public URL hosting the site (GitHub Pages or any free static host). Send it to Person 1.

## Requirements
1. **Firm name:** obviously fictional. Before using it, search it on adviserinfo.sec.gov and make sure **no real firm** has that name. The eval currently uses "Hartwell Wealth". If that matches a real firm, pick another and replace it in `eval/cases.jsonl` too.
2. **Pages:** Home, About, Services, Performance, Testimonials, Blog index + 3 posts, Fees. Plain HTML/CSS. No JavaScript-rendered content (the crawler needs text in the HTML).
3. **Plant 8–12 issues across pages, at least one per category:**
   - `UNSUBSTANTIATED_CLAIM`: e.g. "#1 retirement firm in the region"
   - `BENEFITS_WITHOUT_RISK`: e.g. "guaranteed income", "never lost money"
   - `UNBALANCED_SPECIFIC_ADVICE`: a past stock pick that "tripled", no losers mentioned
   - `UNFAIR_PERFORMANCE_PRESENTATION`: "since the March 2020 low…"
   - `GROSS_WITHOUT_NET`: gross returns, no net
   - `HYPOTHETICAL_PERFORMANCE`: back-tested results on a public page
   - `TESTIMONIAL_NO_DISCLOSURE`: client quote with no client-status or compensation disclosure
   - `RATING_NO_DISCLOSURE`: "Ranked #3 by <fictional magazine>" with no date or methodology
4. **Include clean content too:** a proper risk disclaimer, a fee schedule, a correctly disclosed testimonial, and a full net 1/5/10-year performance table. The tool must stay quiet on these.
5. **Answer key:** add `demo-site/ANSWER_KEY.md` listing each planted issue as page, exact text and category.
6. **Mirror into the eval:** for each planted issue, append a case to `eval/cases.jsonl` with `"provenance": "demo_site"`, `"reviewed": false`, and the exact span. Run `python3 eval/compliance_eval.py --detector baseline_regex` to confirm the file still loads.

## Don'ts
- No real firm names, real people, real addresses or real phone numbers.
- No tracking scripts or forms that collect data.
- Add a visible banner to every page: "Fictional firm for a hackathon demo. Not a real investment adviser."
