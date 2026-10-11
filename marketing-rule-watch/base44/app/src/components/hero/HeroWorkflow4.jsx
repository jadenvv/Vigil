// Hero variant "Workflow 4 · log" (lab only). The product pipeline as a minimalist run log on real demo data:
// GET lines for real captured pages (fetched_at as HH:MM UTC), then the real flag's check line with its real
// confidence, the rewrite line, and a waiting line. Beside the log, the about.html capture: amber brackets lock
// on the check line, the real rewrite card appears on the suggest line, the approval chip on the waiting line.
// Lines reveal with opacity + a small translateY (never typed). The completed log is the default render; the
// sequence is layered on with WAAPI before first paint, holds ~5 s, softly resets and repeats when loop=true.
// Pauses on its own Pause button, the `paused` prop, < 10% visible, or a hidden tab.
// Reduced motion: the still, completed log, no loop and no Pause button.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { findDemoFirm } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { latestPerUrl } from "@/lib/snapshots";
import "./schemes.css";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const GET_SLOTS = 4;

// Timeline (ms from cycle start).
const T = {
  firstGet: 200,
  getGap: 340,
  check: 2750,
  suggest: 4450,
  waiting: 6100,
  end: 6500,
};
const HOLD_MS = 5000;
const RESET_MS = 400;

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

// Shows the stored number as is; only whole numbers gain ".0" (1 → 1.0), nothing is rounded.
function confidenceText(value) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function fileName(url, domain = "") {
  const bare = String(url).replace(/^https?:\/\//, "");
  const root = String(domain).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (root && bare.startsWith(`${root}/`)) return bare.slice(root.length + 1) || "index.html";
  return bare.split("/").filter(Boolean).pop() || "index.html";
}

// Three other real pages (home, a blog post, testimonials, then fill), with the featured page last so its
// check follows straight after it.
function pickPages(pages, featuredUrl) {
  const featured = pages.find((p) => p.url === featuredUrl);
  const picked = [];
  const add = (page) => page && page !== featured && !picked.includes(page) && picked.length < GET_SLOTS - 1 && picked.push(page);
  add(pages.find((p) => p.label === "index.html"));
  add(pages.find((p) => p.label.startsWith("blog/")));
  add(pages.find((p) => p.label.startsWith("testimonials")));
  [...pages].sort((a, b) => a.label.localeCompare(b.label)).forEach(add);
  return featured ? [...picked, featured] : picked;
}

// Three reads: the demo firm, then its pages and all flags together.
function useLogData(featuredFlagId) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      const firm = await findDemoFirm();
      if (!firm) throw new Error("No demo firm");
      const [allPages, allFlags] = await Promise.all([
        base44.entities.Page.filter({ firm_id: firm.id }),
        base44.entities.Flag.list("-created_date", 1000),
      ]);
      const featured = allFlags.find((flag) => flag.id === featuredFlagId);
      const featuredPage = featured && allPages.find((page) => page.id === featured.page_id);
      if (!featured || !featuredPage) throw new Error(`Featured flag ${featuredFlagId} not found`);
      const labelled = latestPerUrl(allPages).map((page) => ({ ...page, label: fileName(page.url, firm.domain) }));
      const pages = pickPages(labelled, featuredPage.url);
      const featuredLabel = fileName(featuredPage.url, firm.domain);
      if (alive) setState({ status: "ready", pages, featured, featuredPage, featuredLabel });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroWorkflow4({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  const data = useLogData(featuredFlagId);
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
      {data.status === "error" ? null : <RunLog data={data} rewrite={featuredRewrite} loop={loop} paused={paused} />}
    </section>
  );
}

function RunLog({ data, rewrite, loop, paused }) {
  const ready = data.status === "ready";
  const stageRef = useRef(null);
  const controlRef = useRef(null);
  const blockers = useRef({ paused: false, user: false, offscreen: false, hidden: false });
  const [userPaused, setUserPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

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

  // Layout effect: the first cycle's start state is applied before paint, so the completed log never flashes.
  useLayoutEffect(() => {
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
    const q = (sel) => Array.from(stage.querySelectorAll(sel));
    const one = (sel) => stage.querySelector(sel);

    const layCycle = () => {
      const run = (el, frames, options) => {
        if (!el) return null;
        const anim = el.animate(frames, { fill: "backwards", easing: EASE_OUT, ...options });
        animations.push(anim);
        return anim;
      };
      const rise = [
        { opacity: 0, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];

      // Each log line prints: a short fade-and-rise, one after another.
      const lines = q("[data-hl-get]");
      lines.forEach((el, i) => run(el, rise, { duration: 320, delay: T.firstGet + i * T.getGap }));
      // The capture appears with its own GET line (the featured page is the last GET).
      const capturedAt = T.firstGet + Math.max(0, lines.length - 1) * T.getGap;
      run(one("[data-hl-thumb]"), [
        { opacity: 0, transform: "scale(0.97)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 380, delay: capturedAt + 60 });

      // CHECK: the line prints, the brackets lock onto the capture, the quote lifts in.
      run(one("[data-hl-check]"), rise, { duration: 320, delay: T.check });
      run(one("[data-hl-bracket]"), [
        { opacity: 0, transform: "scale(1.08)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 360, delay: T.check + 80 });
      run(one("[data-hl-quote]"), rise, { duration: 360, delay: T.check + 200 });

      // SUGGEST: the line prints, the real rewrite card settles in.
      run(one("[data-hl-suggest]"), rise, { duration: 320, delay: T.suggest });
      run(one("[data-hl-rewrite]"), rise, { duration: 400, delay: T.suggest + 100 });

      // WAITING: the line prints, the approval chip settles.
      run(one("[data-hl-wait]"), rise, { duration: 320, delay: T.waiting });
      q("[data-hl-decide]").forEach((el) =>
        run(el, [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 300, delay: T.waiting + 100 }),
      );

      if (!loop) return;
      // Hold, then a soft reset: everything animated fades out together, then the next cycle starts.
      const reset = { duration: RESET_MS, delay: T.end + HOLD_MS, fill: "forwards", easing: "cubic-bezier(0.45, 0, 0.2, 1)" };
      const out = [{ opacity: 1 }, { opacity: 0 }];
      let tail = null;
      q("[data-hl-anim]").forEach((el) => {
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

  const { pages = [], featured, featuredPage, featuredLabel = "about.html" } = ready ? data : {};
  const slots = ready ? pages : Array.from({ length: GET_SLOTS }, () => null);
  const conf = ready ? confidenceText(featured.confidence) : "";

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
        {reduced || !loop ? null : (
          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            aria-label={userPaused ? "Play the animation" : "Pause the animation"}
            className="hl-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--h-border)] px-2.5 text-xs font-medium text-[color:var(--h-fg)]"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="currentColor">
              {userPaused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
            </svg>
            {userPaused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="min-w-0 px-4 py-4 font-mono text-[12px] leading-5 sm:px-5">
          {slots.map((page, i) => (
            <li
              key={page?.id ?? i}
              data-hl-get=""
              data-hl-anim=""
              className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-[3px]"
            >
              <span className="min-w-0 text-[color:var(--h-fg)]">
                {page ? (
                  <>
                    <span className="hl-verb text-[color:var(--h-muted)]">GET</span>{" "}
                    {page.label} <span className="text-[color:var(--h-muted)]">200 · captured</span> {clock(page.fetched_at)}
                  </>
                ) : (
                  " "
                )}
              </span>
              {page ? <span className="text-[color:var(--h-muted)] sm:ml-auto">Crawled with Bright Data</span> : null}
            </li>
          ))}
          <li data-hl-check="" data-hl-anim="" className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-[3px]">
            <span className="min-w-0 text-[color:var(--h-fg)]">
              <span className="hl-verb text-[color:var(--h-accent-text)]">check:</span>{" "}
              {ready ? categoryLabel(featured.category) : " "}
              {conf ? <span className="text-[color:var(--h-muted)]"> · confidence </span> : null}
              {conf}
            </span>
            <span className="text-[color:var(--h-muted)] sm:ml-auto">Marketing Rule checks</span>
          </li>
          <li data-hl-suggest="" data-hl-anim="" className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-[3px]">
            <span className="min-w-0 text-[color:var(--h-fg)]">
              <span className="hl-verb text-[color:var(--h-muted)]">suggest:</span>{" "}
              rewrite drafted
            </span>
            <span className="text-[color:var(--h-muted)] sm:ml-auto">AI suggests a rewrite</span>
          </li>
          <li data-hl-wait="" data-hl-anim="" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 py-[3px]">
            <span className="min-w-0 text-[color:var(--h-fg)]">
              <span className="hl-verb text-[color:var(--h-muted)]">waiting:</span>{" "}
              a person decides
            </span>
            <span
              data-hl-decide=""
              data-hl-anim=""
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2.5 py-0.5 font-sans text-xs text-[color:var(--h-fg)] sm:ml-auto"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" aria-hidden="true" />
              Awaiting your approval
            </span>
          </li>
        </ol>

        <div className="min-w-0 space-y-3 border-t border-[color:var(--h-border)] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 lg:grid-cols-[112px_minmax(0,1fr)]">
            <div className="relative">
              <div
                data-hl-thumb=""
                data-hl-anim=""
                className="h-[112px] overflow-hidden rounded-[6px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]"
              >
                {ready && featuredPage.screenshot_ref ? (
                  <img
                    src={featuredPage.screenshot_ref}
                    alt={`Captured ${featuredLabel}`}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                ) : null}
              </div>
              <Brackets />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="truncate font-mono text-[11px] text-[color:var(--h-muted)]">
                {ready ? `${featuredLabel} · ${clock(featuredPage.fetched_at)}` : " "}
              </p>
              <blockquote
                data-hl-quote=""
                data-hl-anim=""
                className="rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-2.5 py-1.5 font-mono text-[12px] leading-snug text-[color:var(--h-quote-fg)]"
              >
                {ready ? quoted(featured.span) : " "}
              </blockquote>
            </div>
          </div>
          {rewrite ? (
            <div data-hl-rewrite="" data-hl-anim="" className="rounded-md bg-[color:var(--h-surface-2)] px-3 py-2.5">
              <p className="text-[11px] font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--h-fg)]">{rewrite.text}</p>
              <p className="mt-1.5 font-mono text-[10px] text-[color:var(--h-muted)]">
                Generated by Vigil on {stamp(rewrite.generatedAt)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Viewfinder corners (the logo's brackets) around the captured page.
function Brackets() {
  return (
    <svg
      data-hl-bracket=""
      data-hl-anim=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[5px] h-[calc(100%+10px)] w-[calc(100%+10px)] overflow-visible"
    >
      <g fill="none" style={{ stroke: "var(--h-accent)" }} strokeWidth="2" strokeLinecap="square">
        <path d="M0 14V0h14" vectorEffect="non-scaling-stroke" />
        <path d="M86 0h14v14" vectorEffect="non-scaling-stroke" />
        <path d="M100 86v14H86" vectorEffect="non-scaling-stroke" />
        <path d="M14 100H0V86" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

const CSS = `
.hl-btn { transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease; }
.hl-btn:hover { background-color: var(--h-surface-2); }
.hl-btn:active { transform: scale(0.97); }
.hl-btn:focus-visible { outline: 2px solid var(--h-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .hl-btn { transition: none; }
}
`;
