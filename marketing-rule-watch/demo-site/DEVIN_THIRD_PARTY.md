# Devin brief: fictional third-party review site

Hand this to Devin when it's back up. It's a self-contained job with one deliverable: a public URL.

## Why
Our product's claim is that marketing risk lives **outside** the firm's own review process, on third-party pages the compliance officer never sees. The firm's own fictional site is in `demo-site/site/` (see `demo-site/ANSWER_KEY.md` for its name). This job builds the **other** half: a fictional advisor-review directory with a profile of that firm, which our crawler finds as "elsewhere on the web".

## Deliverable
A static site (plain HTML/CSS, **no JavaScript**, all text in the HTML) at a public URL on a **different host** from the firm's site (a separate GitHub Pages repo is fine). Send the URL to Person 1.

## Requirements
1. **Directory name:** obviously fictional (for example "AdvisorQuill"). Search it first and make sure no real review site uses the name.
2. **Pages:** a directory home listing 3–4 fictional firms, and a full profile page for **our firm** (exact name from `demo-site/ANSWER_KEY.md`). Optionally one fictional press article about the firm.
3. **Plant 3–5 issues on the profile page, as single clear sentences:**
   - `RATING_NO_DISCLOSURE`: "Rated #1 Advisor in the Region by …" with no date, methodology or compensation disclosure
   - `TESTIMONIAL_NO_DISCLOSURE`: a client review quote with no client-status or compensation disclosure
   - `UNSUBSTANTIATED_CLAIM`: e.g. "The firm consistently outperforms the market."
   - `BENEFITS_WITHOUT_RISK`: e.g. a firm-provided blurb promising "guaranteed income"
4. **Clean content too:** one properly disclosed review and a neutral factual firm description.
5. **Banner on every page:** "Fictional website for a hackathon demo. Not a real review site."
6. **No real firms, people, addresses or phone numbers.** No tracking scripts, no forms that collect data.
7. Add `sitemap.xml` and append the planted sentences (page, exact text, category) to the "Third-party site" section of `demo-site/ANSWER_KEY.md`.

## Done means
The profile URL returns 200, the banner and every planted sentence are in the raw HTML, and the answer key is updated.
