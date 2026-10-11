// Hero variant "Redline" (?hero=redline). The rewrite happens on screen, like an editor's marked-up proof:
// viewfinder brackets lock on to the real flagged quote, a rule strikes it through line by line, and
// Vigil's real rewrite decodes in beneath it, then waits for a person's approval.
// The final frame is the default render. The sequence is a class added at mount (CSS keyframes with
// backwards fill) plus one rAF loop for the decode, all driven by one pausable clock. loop=false plays
// once; loop=true holds the final frame, fades the animated layer out and repeats. Never with reduced motion.
// Colours come only from the scheme tokens in schemes.css (set by the page on a .hero-scope wrapper).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./schemes.css";
import { SeverityBadge } from "@/components/Badges";
import { loadFlag } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { useAsync } from "@/lib/useAsync";

// Beat timings, in ms of active (unpaused) time from the start of each cycle.
const LOCK_AT = 150;
const LOCK_MS = 520;
const STRIKE_AT = 620;
const STRIKE_MS = 560; // shared across all lines of the quote, in proportion to their width
const LABEL_AT = 1100;
const DECODE_AT = 1160;
const DECODE_MS = 900; // hard cap: every character has settled by DECODE_AT + DECODE_MS
const PILL_AT = 2150;
const SEQUENCE_END = 2800; // play class removed; the base styles are already the final frame
// Loop only: the final frame is complete at ~2570 ms (pill settles); hold it ~2.5 s, then fade out.
const HOLD_END = 5100;
const FADE_MS = 400;
const CYCLE_END = HOLD_END + FADE_MS;

const GLYPHS = "#%&*+=<>/\\|[]{}_~^$@abcdefghkmnpqrstuvwxyz0123456789";

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function fileName(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const last = pathname.replace(/\/+$/, "").split("/").pop();
    return last || hostname;
  } catch {
    return url;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Active time only: halt() freezes it, run() resumes from where it stopped, reset() starts a new cycle.
function createClock() {
  let banked = 0;
  let startedAt = null;
  return {
    now: () => banked + (startedAt === null ? 0 : performance.now() - startedAt),
    run: () => {
      if (startedAt === null) startedAt = performance.now();
    },
    halt: () => {
      if (startedAt === null) return;
      banked += performance.now() - startedAt;
      startedAt = null;
    },
    reset: () => {
      banked = 0;
      if (startedAt !== null) startedAt = performance.now();
    },
  };
}

// The strike uses the quote's own text colour: the quote ground is Lamp 100 in every scheme, so this pair
// always reads, where an amber line on Lamp 100 would nearly vanish.
const STYLES = `
.hr-corner { position: absolute; width: 14px; height: 14px; color: var(--h-accent); }
.hr-strike {
  position: absolute; height: 2px; margin-top: -1px; border-radius: 1px;
  background: var(--h-quote-fg); transform-origin: left center; pointer-events: none;
}
.hr-ch { position: relative; }
.hr-ch[data-s] { color: transparent; }
.hr-ch[data-g]::after {
  content: attr(data-g); position: absolute; left: 0; top: 0;
  color: var(--h-muted); font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.hr-play .hr-corner { animation: hr-lock ${LOCK_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${LOCK_AT}ms both; }
.hr-play .hr-strike { animation: hr-draw var(--hr-d) cubic-bezier(0.23, 1, 0.32, 1) var(--hr-at) both; }
.hr-play .hr-label { animation: hr-fade 360ms cubic-bezier(0.23, 1, 0.32, 1) ${LABEL_AT}ms both; }
.hr-play .hr-pill { animation: hr-rise 420ms cubic-bezier(0.16, 1, 0.3, 1) ${PILL_AT}ms both; }
.hr-out .hr-corner, .hr-out .hr-strike, .hr-out .hr-label, .hr-out .hr-rewrite, .hr-out .hr-pill {
  animation: hr-out ${FADE_MS}ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
.hr-halted * { animation-play-state: paused !important; }

@keyframes hr-lock {
  from { opacity: 0; transform: translate(var(--hr-dx), var(--hr-dy)); }
  30% { opacity: 1; }
  to { opacity: 1; transform: none; }
}
@keyframes hr-draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes hr-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes hr-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes hr-out { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .hr-play .hr-corner, .hr-play .hr-strike, .hr-play .hr-label, .hr-play .hr-pill,
  .hr-out .hr-corner, .hr-out .hr-strike, .hr-out .hr-label, .hr-out .hr-rewrite, .hr-out .hr-pill {
    animation: none;
  }
}
`;

// The four viewfinder corners. Each starts offset outward, so the frame closes in on the quote.
const CORNERS = [
  { key: "tl", style: { top: -7, left: -7 }, d: "M1 13V1h12", dx: "-9px", dy: "-6px" },
  { key: "tr", style: { top: -7, right: -7 }, d: "M1 1h12v12", dx: "9px", dy: "-6px" },
  { key: "bl", style: { bottom: -7, left: -7 }, d: "M1 1v12h12", dx: "-9px", dy: "6px" },
  { key: "br", style: { bottom: -7, right: -7 }, d: "M13 1v12H1", dx: "9px", dy: "6px" },
];

export default function HeroRedline({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  return (
    <section aria-labelledby="home-title" className="space-y-6 sm:space-y-8">
      <style>{STYLES}</style>
      <div className="max-w-3xl space-y-3 sm:space-y-4">
        <h1
          id="home-title"
          className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-[color:var(--h-fg)] sm:text-5xl"
        >
          Vigil finds what slipped past review.
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-[color:var(--h-muted)] sm:text-lg">
          Vigil scans what your firm has published online and flags anything that may conflict with your
          compliance policy, with the exact quote, for a human to review.
        </p>
      </div>
      <ScanForm />
      <ProofCard flagId={featuredFlagId} rewrite={featuredRewrite} loop={loop} paused={paused} />
    </section>
  );
}

function ProofCard({ flagId, rewrite, loop, paused }) {
  const { status, data } = useAsync(() => loadFlag(flagId), [flagId]);
  if (status === "error" || !rewrite?.text) return null;
  if (status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading example"
        className="h-[393px] rounded-[10px] border border-[color:var(--h-border)] bg-[color:var(--h-surface)] p-4 sm:h-[276px] sm:p-6"
      >
        <div className="h-5 w-48 rounded-full bg-[color:var(--h-surface-2)]" />
        <div className="mt-5 h-12 rounded-md bg-[color:var(--h-surface-2)]" />
      </div>
    );
  }
  return <Proof flag={data.flag} page={data.page} rewrite={rewrite} loop={loop} paused={paused} />;
}

// Halted when the page asks (Pause button), when under ~10% of the card is on screen, or when the tab is hidden.
function useHalted(targetRef, paused) {
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!(entry.isIntersecting && entry.intersectionRatio >= 0.1)),
      { threshold: [0, 0.1] },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  return paused || offscreen || hidden;
}

function Proof({ flag, page, rewrite, loop, paused }) {
  // Decided once, before first paint of the card, so the final frame never flashes before the sequence.
  const [play] = useState(() => !prefersReducedMotion());
  // "play" (sequence running) → "rest" (final frame held, loop only) → "out" (fade) → "play" again,
  // or "done" (final frame for good: once mode, or reduced motion).
  const [phase, setPhase] = useState(play ? "play" : "done");
  const [cycle, setCycle] = useState(1);
  const [clock] = useState(createClock);
  const figureRef = useRef(null);
  const quoteRef = useRef(null);
  const textRef = useRef(null);
  const lines = useLineRects(quoteRef, textRef);
  const halted = useHalted(figureRef, paused) && phase !== "done";

  useEffect(() => {
    if (phase === "done") return undefined;
    if (!loop && phase !== "play") {
      setPhase("done");
      return undefined;
    }
    if (halted) {
      clock.halt();
      return undefined;
    }
    clock.run();
    const due = phase === "play" ? SEQUENCE_END : phase === "rest" ? HOLD_END : CYCLE_END;
    const timer = setTimeout(() => {
      if (phase === "play") setPhase(loop ? "rest" : "done");
      else if (phase === "rest") setPhase("out");
      else {
        // At this point the animated layer is fully transparent, so returning it to its start state is invisible.
        clock.reset();
        setCycle((n) => n + 1);
        setPhase("play");
      }
    }, Math.max(0, due - clock.now()));
    return () => clearTimeout(timer);
  }, [phase, halted, loop, clock]);

  // Each line of the strike starts as the previous one is most of the way across, like one pen stroke.
  const total = lines.reduce((sum, line) => sum + line.width, 0) || 1;
  let at = STRIKE_AT;
  const strikes = lines.map((line) => {
    const duration = Math.max(180, Math.round((STRIKE_MS * line.width) / total));
    const strike = { ...line, at, duration };
    at += Math.round(duration * 0.7);
    return strike;
  });

  const motionClass = [phase === "play" && "hr-play", phase === "out" && "hr-out", halted && "hr-halted"]
    .filter(Boolean)
    .join(" ");

  return (
    <figure
      ref={figureRef}
      data-testid="hero-redline"
      data-phase={phase}
      className={`rounded-[10px] border border-[color:var(--h-border)] bg-[color:var(--h-surface)] p-4 sm:p-6 ${motionClass}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SeverityBadge category={flag.category} />
          <span className="font-medium text-[color:var(--h-fg)]">{categoryLabel(flag.category)}</span>
        </div>
        <p className="font-mono text-xs text-[color:var(--h-muted)]">
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-[color:var(--h-border)] underline-offset-2 hover:decoration-[color:var(--h-muted)]"
          >
            {fileName(page.url)}
          </a>
          <span aria-hidden="true"> · </span>
          <span>captured {stamp(page.fetched_at)}</span>
        </p>
      </div>

      <div className="relative mt-5">
        {CORNERS.map((corner) => (
          <svg
            key={corner.key}
            aria-hidden="true"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            className="hr-corner"
            style={{ ...corner.style, "--hr-dx": corner.dx, "--hr-dy": corner.dy }}
          >
            <path d={corner.d} />
          </svg>
        ))}
        <blockquote
          ref={quoteRef}
          className="relative rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-3 py-2.5 font-mono text-sm leading-relaxed text-[color:var(--h-quote-fg)] sm:px-4 sm:py-3 sm:text-[15px]"
        >
          <span ref={textRef}>
            {quoted(flag.span)}
          </span>
          {strikes.map((line, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="hr-strike"
              style={{
                left: line.left,
                top: line.top,
                width: line.width,
                "--hr-at": `${line.at}ms`,
                "--hr-d": `${line.duration}ms`,
              }}
            />
          ))}
        </blockquote>
      </div>

      <div className="mt-5 sm:mt-6">
        <p className="hr-label text-sm font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</p>
        <DecodeText text={rewrite.text} run={cycle} active={phase === "play"} halted={halted} clock={clock} />
      </div>

      <figcaption className="mt-4 flex flex-col gap-2 text-xs text-[color:var(--h-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="hr-pill flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2.5 py-0.5 text-[color:var(--h-fg)]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" />
            Awaiting your approval
          </span>
          <span>
            Generated by Vigil on <span className="font-mono">{stamp(rewrite.generatedAt)}</span>
          </span>
        </span>
        <span>Quarrywick Wealth is a fictional firm we built for this demo.</span>
      </figcaption>
    </figure>
  );
}

// One rect per rendered line of the quote, relative to the blockquote's padding box. Re-measured on resize.
function useLineRects(boxRef, textRef) {
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return undefined;
    let last = "";
    const measure = () => {
      const outer = box.getBoundingClientRect();
      const originX = outer.left + box.clientLeft;
      const originY = outer.top + box.clientTop;
      const next = Array.from(text.getClientRects())
        .filter((rect) => rect.width > 1)
        .map((rect) => ({
          left: Math.round(rect.left - originX),
          top: Math.round(rect.top - originY + rect.height * 0.54),
          width: Math.round(rect.width),
        }));
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setLines(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [boxRef, textRef]);
  return lines;
}

// The real rewrite is always in the DOM and never changes (screen readers get the same text on every
// cycle); while decoding it is transparent and holds the block's height, and an aria-hidden per-character
// layer of the same exact text sits on top of it. Each character keeps its final width, so wrapping never
// changes and nothing shifts. The layer is mounted fresh for each cycle (`run`) and timed by the shared clock.
function DecodeText({ text, run, active, halted, clock }) {
  const [finishedRun, setFinishedRun] = useState(0);
  const decoding = active && finishedRun !== run;
  const layerRef = useRef(null);
  const planRef = useRef(null);

  useEffect(() => {
    if (!decoding || halted) return undefined;
    if (planRef.current?.run !== run) {
      const spans = Array.from(layerRef.current?.children ?? []);
      const n = spans.length || 1;
      const items = spans.map((span, i) => {
        const progress = i / n;
        const appear = Math.round(progress * 280);
        const settle = Math.min(DECODE_MS, Math.round(240 + progress * 540 + Math.random() * 120));
        return { span, appear, settle, blank: /\s/.test(span.textContent), swappedAt: -Infinity, done: false };
      });
      planRef.current = { run, items };
    }
    const { items } = planRef.current;
    let frame = 0;
    const tick = () => {
      const now = clock.now();
      const t = now - DECODE_AT;
      let remaining = 0;
      for (const item of items) {
        if (item.done) continue;
        if (t >= item.settle) {
          item.span.removeAttribute("data-g");
          item.span.removeAttribute("data-s");
          item.done = true;
          continue;
        }
        remaining += 1;
        if (t < item.appear || item.blank) continue;
        if (now - item.swappedAt > 55) {
          item.span.setAttribute("data-g", GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
          item.swappedAt = now;
        }
      }
      if (remaining === 0) {
        setFinishedRun(run);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [decoding, halted, run, clock]);

  const textClass = "text-[15px] leading-relaxed text-[color:var(--h-fg)] sm:text-base";
  return (
    <div className="hr-rewrite relative mt-2">
      <p className={textClass} style={decoding ? { opacity: 0 } : undefined} data-testid="hero-redline-rewrite">
        {text}
      </p>
      {decoding && (
        <p
          key={run}
          ref={layerRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 select-none ${textClass}`}
        >
          {Array.from(text).map((ch, i) => (
            <span key={i} className="hr-ch" data-s="">
              {ch}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
