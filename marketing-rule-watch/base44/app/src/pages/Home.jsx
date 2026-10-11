// Home: one real before/after from the demo firm, then the two ways in (scan your site, or open the demo).
// Everything on the evidence card is read live from stored rows; nothing here calls the LLM.
import { lazy, Suspense, useState } from "react";
import { SeverityBadge } from "@/components/Badges";
import { Shell } from "@/components/Chrome";
import HeroContact from "@/components/hero/HeroContact";
import "@/components/hero/schemes.css";
import { UrlText } from "@/components/UrlText";
import { loadFlag } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { Link, navigate } from "@/lib/router";
import { EVAL_CAVEAT, EVAL_RESULTS, EVAL_TITLE } from "@/lib/evalResults";
import { categoryLabel } from "@/lib/severity";
import { useAsync } from "@/lib/useAsync";

// "Our clients have never lost money in a down year." on the fictional Quarrywick Wealth about page.
export const FEATURED_FLAG_ID = "6acab8a4d5e4233dd70d831d";

// Vigil's real output from the live `rewrite` function for the featured flag, copied verbatim
// (provider base44-invokellm, no placeholders). With null the card shows the stored reason instead.
// Never write or edit one by hand.
export const FEATURED_REWRITE = {
  text: "While we strive to protect assets during downturns, market volatility means that investment returns can fluctuate and clients may experience losses.",
  generatedAt: "2026-10-10T23:01:46Z",
};

const STEPS = [
  ["Find the pages", "Vigil reads your website and, if you ask, looks for pages about your firm elsewhere on the web."],
  ["Flag the exact words", "Each potential issue for review comes with the sentence as published, a screenshot and a plain reason."],
  ["Suggest a rewrite", "On request, Vigil drafts new wording. Facts it can't know stay as blanks for you to fill in."],
  ["You decide", "Approve, edit or dismiss. Nothing is final until a person signs off."],
];

function captureStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}



// Hero prototypes, picked with ?hero=contact|redline|headline. Loaded on demand, so without the parameter
// the page and its bundle are exactly the current hero.
const HERO_VARIANTS = {
  contact: lazy(() => import("@/components/hero/HeroContact")),
  redline: lazy(() => import("@/components/hero/HeroRedline")),
  headline: lazy(() => import("@/components/hero/HeroHeadline")),
};

function heroVariant() {
  try {
    return HERO_VARIANTS[new URLSearchParams(window.location.search).get("hero")] ?? null;
  } catch {
    return null;
  }
}

export default function Home() {
  const Variant = heroVariant();
  return (
    <Shell>
      <div className="space-y-20 sm:space-y-28">
        <div className="hero-scope" data-scheme="paper">
        {Variant ? (
          <Suspense fallback={<CurrentHero />}>
            <Variant ScanForm={ScanForm} featuredFlagId={FEATURED_FLAG_ID} featuredRewrite={FEATURED_REWRITE} />
          </Suspense>
        ) : (
          <HeroContact ScanForm={ScanForm} featuredFlagId={FEATURED_FLAG_ID} featuredRewrite={FEATURED_REWRITE} />
        )}
        </div>

        <EvalResults />

        <section aria-labelledby="loop-title" className="space-y-8">
          <h2 id="loop-title" className="text-2xl font-semibold tracking-tight">
            How a page gets from published to reviewed
          </h2>
          <ol className="grid gap-x-8 gap-y-8 border-t border-paper-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="space-y-2">
                <span className="font-mono text-sm tabular-nums text-night-400">{i + 1}</span>
                <h3 className="font-semibold text-night-950">{title}</h3>
                <p className="text-sm leading-relaxed text-night-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

      </div>
    </Shell>
  );
}

// Our measured results, straight from src/lib/evalResults.js (which copies research/slide_numbers.md).
function EvalResults() {
  return (
    <section aria-labelledby="eval-title" className="space-y-6" data-testid="eval-results">
      <h2 id="eval-title" className="text-2xl font-semibold tracking-tight">
        {EVAL_TITLE}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EVAL_RESULTS.map((result) => (
          <li key={result.label} className="flex flex-col rounded-[10px] border border-paper-200 bg-white p-5">
            <span className="text-sm font-medium text-night-950">{result.label}</span>
            <span className="mt-2 whitespace-nowrap font-mono text-3xl tabular-nums tracking-tight text-night-950">
              {result.value}
            </span>
            <span className="mt-3 text-sm leading-relaxed text-night-600">{result.detail}</span>
            <span className="mt-auto pt-3 text-xs text-night-600">{result.set}</span>
          </li>
        ))}
      </ul>
      <p className="max-w-3xl text-sm text-night-600">{EVAL_CAVEAT}</p>
    </section>
  );
}

function CurrentHero() {
  return (
    <section aria-labelledby="home-title" className="space-y-5 sm:space-y-8">
      <div className="max-w-3xl space-y-3 sm:space-y-4">
        <h1 id="home-title" className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-night-950 sm:text-5xl">
          Vigil finds what slipped past review.
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-night-600 sm:text-lg">
          Vigil scans what your firm has published online and flags anything that may conflict with your
          compliance policy, with the exact quote, for a human to review.
        </p>
      </div>
      <EvidencePair />
      <ScanForm />
    </section>
  );
}

function EvidencePair() {
  const { status, data } = useAsync(() => loadFlag(FEATURED_FLAG_ID), []);
  if (status === "error") return null;
  if (status === "loading")
    return (
      <div aria-busy="true" aria-label="Loading example" className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
        <div className="h-56 animate-pulse rounded-[10px] bg-paper-100" />
        <div className="hidden md:block md:w-8" />
        <div className="h-56 animate-pulse rounded-[10px] bg-paper-100" />
      </div>
    );
  const { flag, page } = data;
  return (
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4" data-testid="home-pair">
      <figure className="relative overflow-hidden rounded-[10px] border border-paper-200 bg-white p-4 sm:p-6">
        <span aria-hidden="true" className="vigil-scan pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-lamp-500" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SeverityBadge category={flag.category} />
          <span className="font-medium text-night-950">{categoryLabel(flag.category)}</span>
        </div>
        <blockquote
          data-testid="home-quote"
          className="mt-3 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono text-sm leading-relaxed text-night-950 sm:mt-4 sm:px-4 sm:py-3 sm:text-[15px]"
        >
          {quoted(flag.span)}
        </blockquote>
        <figcaption className="mt-3 font-mono text-xs leading-relaxed text-night-600">
          <a href={page.url} target="_blank" rel="noreferrer noopener" className="underline decoration-paper-200 underline-offset-2 hover:decoration-night-600">
            <UrlText url={page.url} />
          </a>
          <span className="block">captured {captureStamp(page.fetched_at)}</span>
        </figcaption>
        <p className="mt-3 text-xs text-night-600 sm:mt-4">Published by Quarrywick Wealth, a fictional firm we built for this demo.</p>
      </figure>

      <div aria-hidden="true" className="hidden items-center justify-center text-night-400 md:flex">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>

      {FEATURED_REWRITE ? (
        <figure className="rounded-[10px] border border-paper-200 bg-white p-4 sm:p-6" data-testid="home-rewrite">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-night-950">Vigil's suggested rewrite</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper-200 px-2.5 py-0.5 text-xs text-night-600">
              <span className="h-1.5 w-1.5 rounded-full bg-lamp-500" />
              Awaiting your approval
            </span>
          </div>
          <p className="mt-3 rounded-md bg-paper-100 px-3 py-2 text-sm leading-relaxed text-night-950 sm:mt-4 sm:px-4 sm:py-3 sm:text-[15px]">
            {FEATURED_REWRITE.text}
          </p>
          <figcaption className="mt-2 text-xs leading-relaxed text-night-600 sm:mt-3">
            Generated by Vigil on <span className="font-mono">{captureStamp(FEATURED_REWRITE.generatedAt)}</span>.
            <span className="hidden sm:inline"> A person approves, edits or dismisses it.</span>
          </figcaption>
        </figure>
      ) : (
        <figure className="rounded-[10px] border border-paper-200 bg-white p-4 sm:p-6" data-testid="home-why">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-night-950">Why Vigil flagged it</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper-200 px-2.5 py-0.5 text-xs text-night-600">
              <span className="h-1.5 w-1.5 rounded-full bg-lamp-500" />
              Awaiting your review
            </span>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-night-950 sm:mt-4">{flag.why}</p>
          <figcaption className="mt-3 hidden text-xs leading-relaxed text-night-600 sm:block">
            Vigil suggests a rewrite when you ask. A person approves, edits or dismisses it.
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function ScanForm() {
  const [site, setSite] = useState("");
  const onSubmit = (event) => {
    event.preventDefault();
    const value = site.trim();
    if (!value) return;
    navigate(`/setup?site=${encodeURIComponent(value)}`);
  };
  return (
    <div className="space-y-3 sm:space-y-4">
      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-2 sm:flex-row" data-testid="home-scan">
        <label htmlFor="home-site" className="sr-only">
          Your firm's website
        </label>
        <input
          id="home-site"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck="false"
          required
          value={site}
          onChange={(event) => setSite(event.target.value)}
          placeholder="Your firm's website, e.g. example.com"
          className="h-11 w-full min-w-0 rounded-[10px] border border-[color:var(--h-input-border)] bg-[color:var(--h-input-bg)] px-4 text-[15px] text-[color:var(--h-input-fg)] placeholder:text-[color:var(--h-muted)] focus:border-[color:var(--h-accent)] focus:outline-none focus:ring-2 focus:ring-lamp-500/40 sm:flex-1"
        />
        <button
          type="submit"
          className="h-11 rounded-[10px] bg-[color:var(--h-btn-bg)] px-6 text-[15px] font-medium text-[color:var(--h-btn-fg)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--h-bg)]"
        >
          Scan
        </button>
      </form>
      <Link to="/demo" className="inline-block text-[15px] font-medium text-[color:var(--h-fg)] underline decoration-[color:var(--h-muted)] decoration-2 underline-offset-4 hover:decoration-[color:var(--h-fg)]">
        See a live demo →
      </Link>
      <p className="text-xs text-[color:var(--h-muted)]">Try it on our demo firm, no sign-in needed. Scanning your own firm needs a team sign-in.</p>
    </div>
  );
}
