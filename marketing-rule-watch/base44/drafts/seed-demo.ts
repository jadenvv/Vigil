// Seeds the fictional demo firm that /demo shows. Run from base44/app:
//   cat scripts/seed-demo.ts | npx base44 exec --privileged
// Runs server-side with a global `base44` client, so all data is inline.
// Idempotent: deletes the previous demo firm, its pages and flags, then recreates them
// (Decision rows stay as an audit log).
// Placeholder content until Devin's ANSWER_KEY.md and the Phase 4 real run replace it.
// Every span must be an exact substring of its page's markdown; the script aborts before writing if not.

const FIRM = {
  name: "Hartwell Wealth",
  domain: "hartwell-wealth.example",
  advisor_names: ["Jordan Hale"],
  is_demo: true,
};

const FETCHED_AT = "2026-10-10T18:00:00Z";

// Mirrors TAXONOMY rule refs in eval/compliance_eval.py. Unverified; the UI hides them.
const RULES = {
  UNSUBSTANTIATED_CLAIM: "206(4)-1(a)(2)",
  BENEFITS_WITHOUT_RISK: "206(4)-1(a)(4)",
  UNBALANCED_SPECIFIC_ADVICE: "206(4)-1(a)(5)",
  UNFAIR_PERFORMANCE_PRESENTATION: "206(4)-1(a)(6)",
  GROSS_WITHOUT_NET: "206(4)-1(d)(1)",
  HYPOTHETICAL_PERFORMANCE: "206(4)-1(d)(6)",
  TESTIMONIAL_NO_DISCLOSURE: "206(4)-1(b)",
  RATING_NO_DISCLOSURE: "206(4)-1(c)",
};

const PAGES = [
  {
    url: "https://hartwell-wealth.example/",
    channel: "website",
    markdown: `# Hartwell Wealth

Fictional firm for a hackathon demo. Not a real investment adviser.

## Retirement planning for families who have worked hard for it

Hartwell Wealth is the #1 retirement firm in the region, helping more than 400 households plan for the years after work.

Ranked #3 by Bay Area Advisor Monthly.

We build financial plans around your goals, your timeline and your tolerance for risk. Every client works with a dedicated advisor and a support team.

[Book an intro call](/contact)

---

Investing involves risk, including the possible loss of principal. Past performance does not guarantee future results. Hartwell Wealth is a registered investment adviser; registration does not imply a certain level of skill or training.`,
    flags: [
      {
        category: "UNSUBSTANTIATED_CLAIM",
        span: "Hartwell Wealth is the #1 retirement firm in the region",
        confidence: 0.91,
        why: "A \"#1\" claim is a statement of fact, and the page gives no source or basis for it.",
      },
      {
        category: "RATING_NO_DISCLOSURE",
        span: "Ranked #3 by Bay Area Advisor Monthly.",
        confidence: 0.86,
        why: "The ranking has no date, no criteria, and no note on whether the firm paid to be considered.",
      },
    ],
  },
  {
    url: "https://hartwell-wealth.example/about",
    channel: "website",
    markdown: `# About us

Jordan Hale founded Hartwell Wealth in 2011 after twelve years as a portfolio manager. The firm is fee-only: we are paid by our clients, not by commissions on products we recommend.

## Our approach

We start with your cash needs for the next five years, then invest the rest for growth. Our clients have never lost money in a down year. That is what disciplined planning does.

## Our team

Six advisors and four support staff, all based in our Oakland office.`,
    flags: [
      {
        category: "BENEFITS_WITHOUT_RISK",
        span: "Our clients have never lost money in a down year.",
        confidence: 0.9,
        why: "It suggests the strategy carries no risk of loss, and the page mentions no risks.",
      },
    ],
  },
  {
    url: "https://hartwell-wealth.example/performance",
    channel: "website",
    markdown: `# Performance

## Core Growth strategy

Our Core Growth strategy returned 18.4% gross of fees in 2025.

Since the March 2020 low, client portfolios have gained 142%.

## The Hartwell Momentum Model

Our back-tested Momentum Model would have returned 21% a year from 2005 to 2020, beating the S&P 500 in 13 of those 16 years.

Contact us to learn how the Momentum Model could work for your portfolio.`,
    flags: [
      {
        category: "GROSS_WITHOUT_NET",
        span: "Our Core Growth strategy returned 18.4% gross of fees in 2025.",
        confidence: 0.93,
        why: "A return before fees is shown with no after-fee figure next to it.",
      },
      {
        category: "UNFAIR_PERFORMANCE_PRESENTATION",
        span: "Since the March 2020 low, client portfolios have gained 142%.",
        confidence: 0.88,
        why: "Measuring from the market's lowest point makes results look better than a standard 1, 5 and 10-year period would.",
      },
      {
        category: "HYPOTHETICAL_PERFORMANCE",
        span: "Our back-tested Momentum Model would have returned 21% a year from 2005 to 2020",
        confidence: 0.9,
        why: "Back-tested results are hypothetical, and they appear on a public page with no explanation of how they were produced.",
      },
    ],
  },
  {
    url: "https://hartwell-wealth.example/testimonials",
    channel: "website",
    markdown: `# What our clients say

> "Jordan turned our retirement around. We doubled our savings in four years and I sleep better than ever." - R.K., Walnut Creek

> "Jordan explained every fee before we signed anything. We always knew what we were paying for." - J.P., Oakland
>
> J.P. is a current client of Hartwell Wealth and was not compensated for this statement. Hartwell Wealth has no material conflict of interest with J.P.`,
    flags: [
      {
        category: "TESTIMONIAL_NO_DISCLOSURE",
        span: "\"Jordan turned our retirement around. We doubled our savings in four years and I sleep better than ever.\"",
        confidence: 0.87,
        why: "The quote doesn't say whether the person is a current client or whether they were paid, unlike the one below it.",
      },
    ],
  },
  {
    url: "https://hartwell-wealth.example/blog/how-we-spotted-northline",
    channel: "blog",
    markdown: `# How we spotted Northline Semiconductor early

*Posted March 2024 by Jordan Hale*

In 2021 we added Northline Semiconductor to client portfolios. Our 2021 pick, Northline Semiconductor, tripled in under two years.

Our research process looks for companies with strong balance sheets and growing demand.

For clients who want certainty, our income portfolios offer guaranteed income for life, so you never have to worry about the market again.`,
    flags: [
      {
        category: "UNBALANCED_SPECIFIC_ADVICE",
        span: "Our 2021 pick, Northline Semiconductor, tripled in under two years.",
        confidence: 0.84,
        why: "One winning recommendation is highlighted with no mention of picks that lost money in the same period.",
      },
      {
        category: "BENEFITS_WITHOUT_RISK",
        span: "guaranteed income for life, so you never have to worry about the market again",
        confidence: 0.92,
        why: "It promises a guaranteed outcome and states no risks or conditions.",
      },
    ],
  },
  {
    url: "https://advisorstars.example/firms/hartwell-wealth",
    channel: "review_site",
    markdown: `# Hartwell Wealth · AdvisorStars profile

**Oakland, CA · Fee-only · 4.8 average from 37 reviews**

## About this firm (provided by the firm)

Hartwell Wealth was named a Top 50 Advisor by Wealth Horizons Magazine. We consistently beat the market because we do the homework other advisors skip.

## Recent reviews

"Responsive team, clear quarterly reports." - verified reviewer, 2026`,
    flags: [
      {
        category: "RATING_NO_DISCLOSURE",
        span: "Hartwell Wealth was named a Top 50 Advisor by Wealth Horizons Magazine.",
        confidence: 0.82,
        why: "The award has no date, no criteria, and no note on who paid for it, and it sits on a third-party page outside the firm's review process.",
      },
      {
        category: "UNSUBSTANTIATED_CLAIM",
        span: "We consistently beat the market",
        confidence: 0.85,
        why: "A claim of beating the market needs supporting performance data, and none is given.",
      },
    ],
  },
  {
    url: "https://hartwell-wealth.example/fees",
    channel: "website",
    markdown: `# Fees and net performance

## Advisory fee schedule

| Assets under management | Annual fee |
|---|---|
| First $1,000,000 | 1.00% |
| Next $4,000,000 | 0.75% |
| Above $5,000,000 | 0.50% |

## Core Growth composite, net of fees (as of June 30, 2026)

| Period | Net return | Benchmark (60/40 index) |
|---|---|---|
| 1 year | 7.2% | 7.9% |
| 5 years (annualized) | 6.1% | 6.4% |
| 10 years (annualized) | 6.8% | 6.6% |

Net returns reflect the deduction of actual advisory fees and transaction costs. Investing involves risk, including the possible loss of principal. Past performance does not guarantee future results.`,
    flags: [],
  },
];

// ---- Assert before writing anything ----
const problems = [];
for (const p of PAGES) {
  for (const f of p.flags) {
    if (!p.markdown.includes(f.span)) problems.push(`${p.url}: span not found: ${f.span}`);
    if (!RULES[f.category]) problems.push(`${p.url}: unknown category ${f.category}`);
  }
}
const covered = new Set(PAGES.flatMap((p) => p.flags.map((f) => f.category)));
for (const c of Object.keys(RULES)) if (!covered.has(c)) problems.push(`category not covered: ${c}`);
if (problems.length) {
  console.error("Seed aborted:\n" + problems.join("\n"));
  throw new Error("seed assertions failed");
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Remove the previous demo firm ----
let deletedFirms = 0;
for (const firm of await base44.entities.Firm.filter({ is_demo: true })) {
  for (const page of await base44.entities.Page.filter({ firm_id: firm.id })) {
    await base44.entities.Flag.deleteMany({ page_id: page.id });
  }
  await base44.entities.Page.deleteMany({ firm_id: firm.id });
  await base44.entities.Firm.delete(firm.id);
  deletedFirms++;
}

// ---- Create ----
const firm = await base44.entities.Firm.create(FIRM);
let flagsWritten = 0;
for (const p of PAGES) {
  const page = await base44.entities.Page.create({
    firm_id: firm.id,
    url: p.url,
    channel: p.channel,
    markdown: p.markdown,
    fetched_at: FETCHED_AT,
    sha256: await sha256(p.markdown),
    screenshot_ref: "",
  });
  if (p.flags.length) {
    await base44.entities.Flag.bulkCreate(
      p.flags.map((f) => ({ ...f, page_id: page.id, rule: RULES[f.category], status: "open" })),
    );
    flagsWritten += p.flags.length;
  }
}

// ---- Read back and re-assert grounding against what was stored ----
const pages = await base44.entities.Page.filter({ firm_id: firm.id });
let flagsReadBack = 0;
for (const page of pages) {
  for (const f of await base44.entities.Flag.filter({ page_id: page.id })) {
    flagsReadBack++;
    if (!page.markdown.includes(f.span)) throw new Error(`stored span not found on ${page.url}: ${f.span}`);
  }
}
console.log(JSON.stringify({
  firm_id: firm.id,
  deleted_previous_demo_firms: deletedFirms,
  pages: pages.length,
  flags_written: flagsWritten,
  flags_read_back: flagsReadBack,
  categories_covered: covered.size,
}));
