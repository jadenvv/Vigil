// Hero variant "Workflow 3 · journey" (lab only). One real captured page (about.html, Page.screenshot_ref) travels
// through the four pipeline stations and changes at each: captured (UTC stamp) → scanned (amber scan line, matching
// category) → the exact quote lifts out in brackets beside Vigil's real rewrite → awaiting a person's approval.
// The completed journey is the default render; the sequence is layered on with WAAPI after mount, holds ~2.5 s,
// softly resets and repeats. It pauses on its own Pause button, the `paused` prop, off-screen or a hidden tab.
// Reduced motion: the still, completed journey, no loop and no Pause button.
import { useEffect, useRef, useState } from "react";
import { loadFlag } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import "./schemes.css";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.2, 1)";

// Timeline (ms from cycle start). The page rests at a station, then glides to the next.
const T = {
  arrive: 0, // page appears at station 1
  capture: 200, // viewfinder snaps on, stamp follows
  move1: 1000, // → station 2
  scan: 1650, // scan line sweeps the page
  scanMs: 900,
  category: 2350,
  move2: 2750, // → station 3
  quote: 3400, // the quote lifts out, brackets lock
  rewrite: 3700,
  move3: 4250, // → station 4
  decide: 4900,
  end: 5250,
};
const MOVE_MS = 650;
const HOLD_MS = 2500;
const RESET_MS = 400;

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function fileName(url, domain = "") {
  const bare = String(url).replace(/^https?:\/\//, "");
  const root = String(domain).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (root && bare.startsWith(`${root}/`)) return bare.slice(root.length + 1) || "index.html";
  return bare.split("/").filter(Boolean).pop() || "index.html";
}

// loadFlag makes three reads (flag, its page, its firm).
function useJourney(featuredFlagId) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadFlag(featuredFlagId)
      .then(({ flag, page, firm }) => {
        if (!flag || !page) throw new Error(`Featured flag ${featuredFlagId} not found`);
        if (alive) setState({ status: "ready", flag, page, label: fileName(page.url, firm?.domain) });
      })
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroWorkflow3({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  const data = useJourney(featuredFlagId);
  return (
    <section aria-labelledby="home-title" className="space-y-8 sm:space-y-10">
      <style>{CSS}</style>
      <div className="max-w-2xl space-y-5 sm:space-y-7">
        <div className="space-y-3 sm:space-y-4">
          <h1
            id="home-title"
            className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-[color:var(--h-fg)] sm:text-5xl lg:text-[2.75rem] lg:leading-[1.1]"
          >
            Vigil finds what slipped past review.
          </h1>
          <p className="max-w-xl text-pretty text-base leading-relaxed text-[color:var(--h-muted)] sm:text-lg">
            Vigil scans what your firm has published online and flags anything that may conflict with your
            compliance policy, with the exact quote, for a human to review.
          </p>
        </div>
        <ScanForm />
      </div>
      {data.status === "error" ? null : <Journey data={data} rewrite={featuredRewrite} loop={loop} paused={paused} />}
    </section>
  );
}

// One station: on phones a row (page slot left, text right); from lg a column (label, page slot, detail).
function Station({ n, label, slot, children }) {
  return (
    <li className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 p-4 sm:p-5 lg:flex lg:flex-col lg:gap-0">
      <div className="row-span-2 lg:order-2 lg:mt-3">{slot}</div>
      <p className="flex items-baseline gap-2 text-sm font-medium text-[color:var(--h-fg)] lg:order-1 lg:min-h-[2.5rem]">
        <span className="font-mono text-[11px] tabular-nums text-[color:var(--h-muted)]">{n}</span>
        <span>{label}</span>
      </p>
      <div className="min-w-0 lg:order-3 lg:mt-3">{children}</div>
    </li>
  );
}

function Slot({ k, src, traveller = false, children }) {
  return (
    <div data-w3-slot={k} className="relative h-[90px] w-[72px] lg:h-[128px] lg:w-full">
      <div className="absolute inset-0 rounded-[6px] border border-dashed border-[color:var(--h-border)]" aria-hidden="true" />
      {traveller ? (
        <div
          data-w3-traveller
          data-w3-anim
          className="w3-traveller absolute inset-0 z-10 overflow-hidden rounded-[6px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]"
          style={{ boxShadow: "var(--h-shadow)" }}
        >
          {src ? <img src={src} alt="" loading="eager" decoding="async" className="h-full w-full object-cover object-top" /> : null}
        </div>
      ) : (
        // Where the page has been: a dimmed copy stays behind once it moves on.
        <div data-w3-ghost={k} data-w3-anim className="absolute inset-0 overflow-hidden rounded-[6px]" aria-hidden="true">
          {src ? (
            <img
              src={src}
              alt=""
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover object-top"
              style={{ opacity: "var(--h-thumb-dim)" }}
            />
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}

function Journey({ data, rewrite, loop, paused }) {
  const ready = data.status === "ready";
  const stageRef = useRef(null);
  const controlRef = useRef(null);
  const blockers = useRef({ paused: false, user: false, offscreen: false, hidden: false });
  const [userPaused, setUserPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const applyRunning = () => {
    const b = blockers.current;
    controlRef.current?.setRunning(!(b.paused || b.user || b.offscreen || b.hidden));
  };

  useEffect(() => {
    blockers.current.paused = paused;
    blockers.current.user = userPaused;
    applyRunning();
  });

  useEffect(() => {
    const onVisibility = () => {
      blockers.current.hidden = document.hidden;
      applyRunning();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    let observer;
    if (stageRef.current && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          blockers.current.offscreen = entry.intersectionRatio < 0.1;
          applyRunning();
        },
        { threshold: [0, 0.1] },
      );
      observer.observe(stageRef.current);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || reduced) return undefined;
    const stage = stageRef.current;
    if (!stage || !stage.animate) return undefined;
    let animations = [];
    let running = true;
    const sync = () =>
      animations.forEach((a) => {
        if (!running && a.playState === "running") a.pause();
        else if (running && a.playState === "paused") a.play();
      });
    controlRef.current = {
      setRunning(next) {
        running = next;
        sync();
      },
    };
    const one = (sel) => stage.querySelector(sel);
    const all = (sel) => Array.from(stage.querySelectorAll(sel));

    const layCycle = () => {
      const run = (el, frames, options) => {
        if (!el) return null;
        const anim = el.animate(frames, { fill: "backwards", easing: EASE_OUT, ...options });
        animations.push(anim);
        return anim;
      };
      const fadeIn = [{ opacity: 0 }, { opacity: 1 }];

      // The page rests in station 4 in the layout; measure where stations 1–3 are relative to it (this cycle).
      const home = one('[data-w3-slot="4"]')?.getBoundingClientRect();
      const offset = (k) => {
        const r = one(`[data-w3-slot="${k}"]`)?.getBoundingClientRect();
        return r && home ? `translate(${r.left - home.left}px, ${r.top - home.top}px)` : "none";
      };
      const [p1, p2, p3] = [offset(1), offset(2), offset(3)];
      const total = T.move3 + MOVE_MS;
      const k = (ms) => ms / total;
      run(one("[data-w3-traveller]"), [
        { offset: 0, opacity: 0, transform: `${p1} scale(0.94)` },
        { offset: k(T.capture + 150), opacity: 1, transform: `${p1} scale(1)`, easing: "linear" },
        { offset: k(T.move1), opacity: 1, transform: `${p1} scale(1)`, easing: EASE_IN_OUT },
        { offset: k(T.move1 + MOVE_MS), opacity: 1, transform: `${p2} scale(1)`, easing: "linear" },
        { offset: k(T.move2), opacity: 1, transform: `${p2} scale(1)`, easing: EASE_IN_OUT },
        { offset: k(T.move2 + MOVE_MS), opacity: 1, transform: `${p3} scale(1)`, easing: "linear" },
        { offset: k(T.move3), opacity: 1, transform: `${p3} scale(1)`, easing: EASE_IN_OUT },
        { offset: 1, opacity: 1, transform: "translate(0px, 0px) scale(1)" },
      ], { duration: total, easing: "linear" });

      // Each station keeps a dimmed copy once the page moves on.
      [T.move1, T.move2, T.move3].forEach((ms, i) =>
        run(one(`[data-w3-ghost="${i + 1}"]`), fadeIn, { duration: 400, delay: ms + 120 }),
      );

      // 1 · Captured: the viewfinder snaps onto the page, then the stamp.
      run(one("[data-w3-viewfinder]"), [
        { opacity: 0, transform: "scale(1.1)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 340, delay: T.capture });
      all("[data-w3-s1]").forEach((el, i) =>
        run(el, [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 300, delay: T.capture + 260 + i * 90 }),
      );

      // 2 · Scanned: the amber line sweeps the page and settles; the matching check appears.
      run(one("[data-w3-scanline]"), [
        { opacity: 0, transform: "translateY(-100%)" },
        { opacity: 1, transform: "translateY(-100%)", offset: 0.08 },
        { opacity: 1, transform: "translateY(0%)", offset: 0.75 },
        { opacity: 1, transform: "translateY(-35%)" },
      ], { duration: T.scanMs, delay: T.scan, easing: EASE_IN_OUT });
      all("[data-w3-s2]").forEach((el, i) =>
        run(el, [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 300, delay: T.category + i * 90 }),
      );

      // 3 · The quote lifts out of the page, brackets lock on, the real rewrite settles beside it.
      run(one("[data-w3-quote]"), [
        { opacity: 0, transform: "translateY(10px) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ], { duration: 420, delay: T.quote });
      run(one("[data-w3-bracket]"), [
        { opacity: 0, transform: "scale(1.12)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 340, delay: T.quote + 140 });
      run(one("[data-w3-rewrite]"), [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 420, delay: T.rewrite });

      // 4 · A person decides: the approval chip settles.
      all("[data-w3-s4]").forEach((el, i) =>
        run(el, [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 320, delay: T.decide + i * 110 }),
      );

      if (!loop) return;
      // Hold, then a soft reset: the animated layer fades out and is held there until the next cycle.
      const reset = { duration: RESET_MS, delay: T.end + HOLD_MS, fill: "forwards" };
      const out = [{ opacity: 1 }, { opacity: 0 }];
      let tail = null;
      all("[data-w3-anim]").forEach((el) => {
        tail = run(el, out, reset);
      });
      if (tail) tail.onfinish = playCycle;
    };

    function playCycle() {
      const previous = animations;
      animations = [];
      layCycle();
      previous.forEach((a) => a.cancel());
      sync();
    }

    playCycle();
    applyRunning();
    return () => {
      controlRef.current = null;
      animations.forEach((a) => a.cancel());
    };
  }, [ready, reduced, loop]); // eslint-disable-line react-hooks/exhaustive-deps

  const { flag, page, label = "" } = ready ? data : {};
  const src = page?.screenshot_ref;

  return (
    <div
      ref={stageRef}
      className="relative overflow-hidden rounded-[10px] border border-[color:var(--h-border)] bg-[color:var(--h-surface)]"
      style={{ boxShadow: "var(--h-shadow)" }}
      aria-busy={!ready}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--h-border)] px-4 py-2.5 sm:px-5">
        <p className="truncate text-xs text-[color:var(--h-muted)]">
          How Vigil works, on a fictional firm we built for this demo
        </p>
        {reduced ? null : (
          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            aria-label={userPaused ? "Play the animation" : "Pause the animation"}
            className="w3-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--h-border)] px-2.5 text-xs font-medium text-[color:var(--h-fg)]"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="currentColor">
              {userPaused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
            </svg>
            {userPaused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <ol className="grid divide-y divide-[color:var(--h-border)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <Station
          n="01"
          label="Crawled with Bright Data"
          slot={
            <Slot k={1} src={src}>
              <Corners attr={{ "data-w3-viewfinder": "", "data-w3-anim": "" }} pad={5} />
            </Slot>
          }
        >
          <p data-w3-s1 data-w3-anim className="truncate font-mono text-[11px] leading-4 text-[color:var(--h-fg)]">
            {ready ? label : " "}
          </p>
          <p data-w3-s1 data-w3-anim className="truncate font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
            {ready ? `Captured ${stamp(page.fetched_at)}` : " "}
          </p>
        </Station>

        <Station
          n="02"
          label="Checked against Marketing Rule checks"
          slot={
            <Slot k={2} src={src}>
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[6px]" aria-hidden="true">
                <div data-w3-scanline data-w3-anim className="w3-scanline h-full w-full border-b-2 border-[color:var(--h-accent)]" />
              </div>
            </Slot>
          }
        >
          <p data-w3-s2 data-w3-anim className="truncate font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
            Matched check
          </p>
          <p
            data-w3-s2
            data-w3-anim
            className="mt-1 inline-block max-w-full truncate rounded-[3px] bg-[color:var(--h-quote-bg)] px-1.5 text-[11px] font-medium leading-[18px] text-[color:var(--h-quote-fg)]"
          >
            {ready ? categoryLabel(flag.category) : " "}
          </p>
        </Station>

        <Station n="03" label="AI suggests a rewrite" slot={<Slot k={3} src={src} />}>
          <div className="relative">
            <blockquote
              data-w3-quote
              data-w3-anim
              className="min-h-[3.25rem] rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-2.5 py-1.5 font-mono text-[12px] leading-snug text-[color:var(--h-quote-fg)]"
            >
              {ready ? quoted(flag.span) : " "}
            </blockquote>
            <Corners attr={{ "data-w3-bracket": "", "data-w3-anim": "" }} pad={4} />
          </div>
          {rewrite ? (
            <div data-w3-rewrite data-w3-anim className="mt-2.5 rounded-md bg-[color:var(--h-surface-2)] px-3 py-2">
              <p className="text-[11px] font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[color:var(--h-fg)]">{rewrite.text}</p>
            </div>
          ) : null}
        </Station>

        <Station n="04" label="A person decides" slot={<Slot k={4} src={src} traveller />}>
          <span
            data-w3-s4
            data-w3-anim
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2.5 py-1 text-xs text-[color:var(--h-fg)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" aria-hidden="true" />
            Awaiting your approval
          </span>
          <p data-w3-s4 data-w3-anim className="mt-2 text-xs leading-relaxed text-[color:var(--h-muted)]">
            A person approves, edits or dismisses it.
          </p>
          {rewrite ? (
            <p data-w3-s4 data-w3-anim className="mt-1.5 font-mono text-[10px] text-[color:var(--h-muted)]">
              Generated by Vigil on {stamp(rewrite.generatedAt)}
            </p>
          ) : null}
        </Station>
      </ol>
    </div>
  );
}

// Viewfinder corners (the logo's brackets).
function Corners({ attr, pad }) {
  return (
    <svg
      {...attr}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute z-20 overflow-visible"
      style={{ left: -pad, top: -pad, width: `calc(100% + ${pad * 2}px)`, height: `calc(100% + ${pad * 2}px)` }}
    >
      <g fill="none" style={{ stroke: "var(--h-accent)" }} strokeWidth="2" strokeLinecap="square">
        <path d="M0 10V0h8" vectorEffect="non-scaling-stroke" />
        <path d="M92 0h8v10" vectorEffect="non-scaling-stroke" />
        <path d="M100 30v10h-8" vectorEffect="non-scaling-stroke" />
        <path d="M8 40H0V30" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

const CSS = `
.w3-traveller { will-change: transform, opacity; }
.w3-scanline { transform: translateY(-35%); }
.w3-btn { transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease; }
.w3-btn:hover { background-color: var(--h-surface-2); }
.w3-btn:active { transform: scale(0.97); }
.w3-btn:focus-visible { outline: 2px solid var(--h-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .w3-btn { transition: none; }
}
`;
