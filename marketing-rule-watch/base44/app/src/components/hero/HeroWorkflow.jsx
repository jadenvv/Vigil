// Hero variant "Workflow" (?hero=workflow). The product pipeline as one continuous loop on real demo data:
// CRAWL (Bright Data captures the firm's pages) → CHECK (the captured text runs past the Marketing Rule checks
// and one locks on) → SUGGEST (Vigil's real rewrite fades in word by word) → DECIDE (awaiting a person).
// The completed diagram is the default render; the sequence is layered on with WAAPI after mount, holds ~2.5 s,
// softly resets and repeats. It pauses on the Pause button, the `paused` prop, off-screen or a hidden tab.
// Reduced motion: the still, completed diagram, no loop and no Pause button.
import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { findDemoFirm } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { latestPerUrl } from "@/lib/snapshots";
import "./schemes.css";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.2, 1)";
const TAXONOMY = [
  "UNSUBSTANTIATED_CLAIM",
  "BENEFITS_WITHOUT_RISK",
  "UNBALANCED_SPECIFIC_ADVICE",
  "UNFAIR_PERFORMANCE_PRESENTATION",
  "GROSS_WITHOUT_NET",
  "HYPOTHETICAL_PERFORMANCE",
  "TESTIMONIAL_NO_DISCLOSURE",
  "RATING_NO_DISCLOSURE",
];

// Timeline (ms from cycle start). Each step dwells about a second longer than the one before it, and once
// revealed, every step's text stays on screen until the reset, so it can be read.
const T = {
  domain: 100,
  rows: 300, // first captured page; then every ROW_GAP
  rowGap: 230,
  check: 2450, // text starts streaming, the check marker walks the list
  checkMs: 900,
  lock: 3400, // matched check locks on
  quote: 3550, // quote lifts out, brackets lock
  suggest: 5150, // rewrite fades in word by word, ≤ 900 ms
  suggestMs: 850,
  decide: 7150,
  end: 7500,
};
const HOLD_MS = 5000;
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

// Four pages for the crawl: the home page, the featured page, one blog post, testimonials; then fill.
function pickPages(pages, featuredUrl) {
  const picked = [];
  const add = (page) => page && !picked.includes(page) && picked.length < 4 && picked.push(page);
  add(pages.find((p) => p.label === "index.html"));
  add(pages.find((p) => p.url === featuredUrl));
  add(pages.find((p) => p.label.startsWith("blog/")));
  add(pages.find((p) => p.label.startsWith("testimonials")));
  [...pages].sort((a, b) => a.label.localeCompare(b.label)).forEach(add);
  return picked;
}

// Plain-text lines of the captured page leading up to the quote, for the stream in the CHECK step.
function streamLines(markdown, span) {
  const plain = String(markdown || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`|]/g, " ");
  const lines = plain
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 12);
  const at = lines.findIndex((l) => l.includes(span));
  const end = at >= 0 ? at : lines.length;
  return lines.slice(Math.max(0, end - 5), end).map((l) => (l.length > 64 ? `${l.slice(0, 64)}…` : l));
}

// Three reads: the demo firm, then its pages and all flags together.
function useWorkflow(featuredFlagId) {
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
      if (!featured || !featuredPage) throw new Error("Featured flag not found");
      const labelled = latestPerUrl(allPages).map((page) => ({ ...page, label: fileName(page.url, firm.domain) }));
      const pages = pickPages(labelled, featuredPage.url);
      const lines = streamLines(featuredPage.markdown, featured.span);
      const domain = String(firm.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (alive) setState({ status: "ready", firm, domain, pages, featured, featuredPage, lines });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroWorkflow({ ScanForm, featuredFlagId, featuredRewrite, paused = false }) {
  const data = useWorkflow(featuredFlagId);
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
      {data.status === "error" ? null : <Pipeline data={data} rewrite={featuredRewrite} paused={paused} />}
    </section>
  );
}

function Step({ n, name, label, children, className = "" }) {
  return (
    <li className={`hw-step relative min-w-0 p-4 sm:p-5 ${className}`}>
      <p className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--h-muted)]">
        <span className="tabular-nums">{n}</span>
        <span className="text-[color:var(--h-fg)]">{name}</span>
      </p>
      <p className="mt-1 text-sm font-medium text-[color:var(--h-fg)]">{label}</p>
      <div className="mt-3">{children}</div>
    </li>
  );
}

function Pipeline({ data, rewrite, paused }) {
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
    const q = (sel) => Array.from(stage.querySelectorAll(sel));

    const layCycle = () => {
      const run = (el, frames, options) => {
        if (!el) return null;
        const anim = el.animate(frames, { fill: "backwards", easing: EASE_OUT, ...options });
        animations.push(anim);
        return anim;
      };
      const fadeUp = [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];
      const fadeIn = [{ opacity: 0 }, { opacity: 1 }];

      // CRAWL: the domain appears, then each page is captured along the crawler path.
      q("[data-hw-domain]").forEach((el) => run(el, fadeIn, { duration: 300, delay: T.domain }));
      q("[data-hw-row]").forEach((row, i) => {
        const at = T.rows + i * T.rowGap;
        run(row.querySelector("[data-hw-branch]"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 260,
          delay: at,
        });
        run(row.querySelector("[data-hw-path]"), [
          { opacity: 0, transform: "translateX(-6px)" },
          { opacity: 1, transform: "translateX(0)" },
        ], { duration: 320, delay: at + 80 });
        // Capture: the thumbnail flashes in like a shutter, the timestamp follows.
        run(row.querySelector("[data-hw-thumb]"), [
          { opacity: 0, transform: "scale(0.85)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 300, delay: at + 160 });
        run(row.querySelector("[data-hw-time]"), fadeIn, { duration: 260, delay: at + 240 });
      });

      // CHECK: captured text streams up behind the window while the marker walks the checks.
      const stream = stage.querySelector("[data-hw-stream]");
      if (stream) {
        // The window is bottom-anchored (the quote line shows at rest), so the stream rises from below into it.
        const shift = Math.max(0, stream.scrollHeight - 28);
        run(stream, [
          { opacity: 0, transform: `translateY(${shift}px)` },
          { opacity: 1, transform: `translateY(${shift}px)`, offset: 0.12 },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: T.checkMs + 200, delay: T.check, easing: EASE_IN_OUT, fill: "both" });
      }
      const marker = stage.querySelector("[data-hw-marker]");
      const list = stage.querySelector("[data-hw-checks]");
      const hit = stage.querySelector("[data-hw-hit]");
      if (marker && list && hit) {
        const first = list.querySelector("li");
        const top = first ? first.offsetTop : 0;
        const target = hit.offsetTop;
        run(marker, [
          { opacity: 0, transform: `translateY(${top}px)` },
          { opacity: 1, transform: `translateY(${top}px)`, offset: 0.1 },
          { opacity: 1, transform: `translateY(${list.scrollHeight - 18}px)`, offset: 0.7 },
          { opacity: 1, transform: `translateY(${target}px)` },
        ], { duration: T.checkMs, delay: T.check, easing: EASE_IN_OUT, fill: "both" });
        run(marker, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: T.lock, fill: "forwards" });
      }
      q("[data-hw-lock]").forEach((el) => run(el, fadeIn, { duration: 260, delay: T.lock }));
      q("[data-hw-quote]").forEach((el) => run(el, fadeUp, { duration: 380, delay: T.quote }));
      q("[data-hw-bracket]").forEach((el) =>
        run(el, [
          { opacity: 0, transform: "scale(1.12)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 340, delay: T.quote + 120 }),
      );

      // SUGGEST: the rewrite resolves word by word, inside 900 ms.
      const words = q("[data-hw-word]");
      run(stage.querySelector("[data-hw-rewrite]"), fadeIn, { duration: 240, delay: T.suggest - 120 });
      words.forEach((w, i) =>
        run(w, [
          { opacity: 0, transform: "translateY(3px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 260, delay: T.suggest + (i / Math.max(1, words.length - 1)) * (T.suggestMs - 260) }),
      );

      // DECIDE: the approval chip settles.
      q("[data-hw-decide]").forEach((el, i) =>
        run(el, [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 320, delay: T.decide + i * 120 }),
      );

      // Hold, then a soft reset: the animated layer fades out and is held there until the next cycle.
      const reset = { duration: RESET_MS, delay: T.end + HOLD_MS, fill: "forwards" };
      const out = [{ opacity: 1 }, { opacity: 0 }];
      let tail = null;
      q("[data-hw-anim]").forEach((el) => {
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
  }, [ready, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const { domain = "", pages = [], featured, featuredPage, lines = [] } = ready ? data : {};
  const words = rewrite ? rewrite.text.split(/\s+/) : [];
  const slots = ready ? pages : [null, null, null, null];

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
            className="hw-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--h-border)] px-2.5 text-xs font-medium text-[color:var(--h-fg)]"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="currentColor">
              {userPaused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
            </svg>
            {userPaused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <ol className="grid divide-y divide-[color:var(--h-border)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <Step n="01" name="Crawl" label="Crawled with Bright Data">
          <p data-hw-domain data-hw-anim className="truncate font-mono text-[11px] text-[color:var(--h-fg)]">
            {ready ? domain : " "}
          </p>
          <ul className="mt-2 space-y-1.5 border-l border-[color:var(--h-border)] pl-0">
            {slots.map((page, i) => (
              <li key={page?.id ?? i} data-hw-row className="flex items-center gap-2">
                <span data-hw-branch data-hw-anim className="hw-branch h-px w-3 shrink-0 bg-[color:var(--h-accent)]" />
                <span
                  data-hw-thumb
                  data-hw-anim
                  className="h-8 w-6 shrink-0 overflow-hidden rounded-[3px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]"
                >
                  {page?.screenshot_ref ? (
                    <img src={page.screenshot_ref} alt="" loading="eager" decoding="async" className="h-full w-full object-cover object-top" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span data-hw-path data-hw-anim className="block truncate font-mono text-[11px] leading-4 text-[color:var(--h-fg)]">
                    {page ? page.label : " "}
                  </span>
                  <span data-hw-time data-hw-anim className="block truncate font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
                    {page ? stamp(page.fetched_at) : " "}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Step>

        <Step n="02" name="Check" label="Checked against Marketing Rule checks">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <div className="relative flex h-9 flex-col justify-end overflow-hidden rounded-[6px] bg-[color:var(--h-surface-2)] px-2 py-1" aria-hidden="true">
              <div data-hw-stream data-hw-anim className="hw-stream font-mono text-[10px] leading-[14px] text-[color:var(--h-muted)]">
                {lines.map((line, i) => (
                  <p key={i} className="truncate">{line}</p>
                ))}
                <p className="truncate text-[color:var(--h-fg)]">{ready ? featured.span : " "}</p>
              </div>
            </div>
            <ul data-hw-checks className="relative space-y-0.5">
              <span
                data-hw-marker
                aria-hidden="true"
                className="hw-marker pointer-events-none absolute left-0 top-0 h-[18px] w-[2px] rounded-full bg-[color:var(--h-accent)]"
              />
              {TAXONOMY.map((id) => {
                const isHit = ready && featured.category === id;
                return (
                  <li
                    key={id}
                    data-hw-hit={isHit ? "" : undefined}
                    className="relative truncate pl-2.5 text-[11px] leading-[18px] text-[color:var(--h-muted)]"
                  >
                    {isHit ? (
                      <span
                        data-hw-lock
                        data-hw-anim
                        className="absolute inset-0 z-10 truncate rounded-[3px] bg-[color:var(--h-quote-bg)] pl-2.5 font-medium text-[color:var(--h-quote-fg)]"
                      >
                        {categoryLabel(id)}
                      </span>
                    ) : null}
                    <span className="relative" aria-hidden={isHit ? "true" : undefined}>{categoryLabel(id)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="relative mt-1">
              <blockquote
                data-hw-quote
                data-hw-anim
                className="rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-2.5 py-1.5 font-mono text-[12px] leading-snug text-[color:var(--h-quote-fg)]"
              >
                {ready ? quoted(featured.span) : " "}
              </blockquote>
              <Brackets />
            </div>
            <p className="truncate font-mono text-[10px] text-[color:var(--h-muted)]">
              {ready ? `${fileName(featuredPage.url, data.firm.domain)}` : " "}
            </p>
          </div>
        </Step>

        <Step n="03" name="Suggest" label="AI suggests a rewrite">
          {rewrite ? (
            <div data-hw-rewrite data-hw-anim className="rounded-md bg-[color:var(--h-surface-2)] px-3 py-2">
              <p className="text-[11px] font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</p>
              <p className="sr-only">{rewrite.text}</p>
              <p aria-hidden="true" className="mt-1 text-[13px] leading-relaxed text-[color:var(--h-fg)]">
                {words.map((w, i) => (
                  <span key={i} data-hw-word data-hw-anim className="inline-block">
                    {w}
                    {i < words.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </Step>

        <Step n="04" name="Decide" label="A person decides">
          <span
            data-hw-decide
            data-hw-anim
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2.5 py-1 text-xs text-[color:var(--h-fg)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" aria-hidden="true" />
            Awaiting your approval
          </span>
          <p data-hw-decide data-hw-anim className="mt-2 text-xs leading-relaxed text-[color:var(--h-muted)]">
            A person approves, edits or dismisses it.
          </p>
          {rewrite ? (
            <p data-hw-decide data-hw-anim className="mt-2 font-mono text-[10px] text-[color:var(--h-muted)]">Generated by Vigil on {stamp(rewrite.generatedAt)}</p>
          ) : null}
        </Step>
      </ol>
    </div>
  );
}

// Viewfinder corners (the logo's brackets) around the flagged quote.
function Brackets() {
  return (
    <svg
      data-hw-bracket
      data-hw-anim
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[4px] h-[calc(100%+8px)] w-[calc(100%+8px)] overflow-visible"
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
.hw-branch { transform-origin: left center; }
.hw-marker { opacity: 0; will-change: transform, opacity; }
.hw-btn { transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease; }
.hw-btn:hover { background-color: var(--h-surface-2); }
.hw-btn:active { transform: scale(0.97); }
.hw-btn:focus-visible { outline: 2px solid var(--h-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .hw-marker { display: none; }
  .hw-btn { transition: none; }
}
`;
