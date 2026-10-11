// Dev-only hero lab: every hero animation in every colour scheme, linkable as /hero-lab?a=<animation>&s=<scheme>.
// App.jsx registers this route only when import.meta.env.DEV, so production builds never include it.
import { lazy, Suspense, useEffect, useState } from "react";
import "@/components/hero/schemes.css";
import { FEATURED_FLAG_ID, FEATURED_REWRITE, ScanForm } from "@/pages/Home";

const HeroContact = lazy(() => import("@/components/hero/HeroContact"));
const HeroRedline = lazy(() => import("@/components/hero/HeroRedline"));
const HeroHeadline = lazy(() => import("@/components/hero/HeroHeadline"));
const HeroScroll = lazy(() => import("@/components/hero/HeroScroll"));
const HeroWorkflow = lazy(() => import("@/components/hero/HeroWorkflow"));

export const ANIMATIONS = [
  { id: "contact", label: "Contact sheet", Comp: HeroContact, kind: "once" },
  { id: "redline", label: "Redline", Comp: HeroRedline, kind: "once" },
  { id: "headline", label: "Scanned headline", Comp: HeroHeadline, kind: "once" },
  { id: "contact-loop", label: "Contact sheet · loop", Comp: HeroContact, kind: "loop" },
  { id: "redline-loop", label: "Redline · loop", Comp: HeroRedline, kind: "loop" },
  { id: "headline-loop", label: "Scanned headline · loop", Comp: HeroHeadline, kind: "loop" },
  { id: "scroll", label: "Scroll-driven", Comp: HeroScroll, kind: "scroll" },
  { id: "workflow", label: "Workflow · loop", Comp: HeroWorkflow, kind: "loop" },
];

export const SCHEMES = [
  { id: "paper", label: "Paper" },
  { id: "night", label: "Night" },
  { id: "split", label: "Split" },
  { id: "dusk", label: "Dusk" },
];

const DARK = new Set(["night", "split"]);

function initialSelection() {
  const query = new URLSearchParams(window.location.search);
  const a = ANIMATIONS.some((x) => x.id === query.get("a")) ? query.get("a") : "contact";
  const s = SCHEMES.some((x) => x.id === query.get("s")) ? query.get("s") : "paper";
  return { a, s };
}

function TabRow({ label, items, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 w-24 text-xs font-medium text-night-600">{label}</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className={`rounded-md px-2.5 py-1 text-xs ${
            value === item.id ? "bg-night-950 text-paper-50" : "border border-paper-200 text-night-700 hover:bg-paper-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function HeroLab() {
  const [{ a, s }, setSelection] = useState(initialSelection);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const animation = ANIMATIONS.find((x) => x.id === a);
  const Comp = animation.Comp;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set("a", a);
    query.set("s", s);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }, [a, s]);

  const pick = (key) => (id) => {
    setPaused(false);
    setSelection((current) => ({ ...current, [key]: id }));
  };

  return (
    <div className="min-h-screen bg-paper-50 text-night-950">
      <div className="sticky top-0 z-30 space-y-2 border-b border-paper-200 bg-white px-4 py-2" data-testid="lab-controls">
        <TabRow label="Animation" items={ANIMATIONS} value={a} onChange={pick("a")} />
        <div className="flex flex-wrap items-center gap-3">
          <TabRow label="Colour" items={SCHEMES} value={s} onChange={pick("s")} />
          {animation.kind === "once" && (
            <button type="button" onClick={() => setRun((n) => n + 1)} className="rounded-md border border-night-950 px-2.5 py-1 text-xs">
              Replay
            </button>
          )}
          {animation.kind === "loop" && (
            <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-md border border-night-950 px-2.5 py-1 text-xs">
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <span className="text-xs text-night-600">Dev-only lab. Not part of the shipped app.</span>
        </div>
      </div>

      <div className="hero-scope" data-scheme={s} data-testid="lab-stage">
        <header className="border-b border-[color:var(--h-border)]">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <img src={DARK.has(s) ? "/vigil-lockup-reversed.svg" : "/vigil-lockup.svg"} alt="Vigil" className="h-6 w-auto" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
          <Suspense fallback={<div className="h-[28rem]" aria-busy="true" />}>
            <Comp
              key={`${a}-${run}`}
              ScanForm={ScanForm}
              featuredFlagId={FEATURED_FLAG_ID}
              featuredRewrite={FEATURED_REWRITE}
              loop={animation.kind === "loop"}
              paused={paused}
            />
          </Suspense>
        </main>
      </div>

      {/* The rest of the page, so Split reads as a dark hero band over the Paper page. */}
      <div className="hero-scope" data-scheme={s === "split" ? "paper" : s}>
        <section className="mx-auto max-w-5xl space-y-3 px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">How a page gets from published to reviewed</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--h-muted)]">
            Find the pages, flag the exact words, suggest a rewrite, and you decide.
          </p>
        </section>
        <footer className="border-t border-[color:var(--h-border)] py-6 text-center text-sm text-[color:var(--h-muted)]">
          Not legal advice. All flags require human review.
        </footer>
      </div>
    </div>
  );
}
