// Hero variant "Workflow 2 · rail" (lab: ?a=workflow-2). The product pipeline as a vertical rail on real demo data.
// Headline, subhead and ScanForm on top; below, four steps hang off one hairline rail. A single amber pulse travels
// down the rail and each step's content expands as the pulse reaches it:
// CRAWL (domain + captured pages with capture times) → CHECK (the matching category rolls in and locks on, then the
// exact quote in brackets) → SUGGEST (Vigil's real rewrite, word by word) → DECIDE (awaiting a person).
// The completed rail is the default render; the sequence is layered on with WAAPI after mount (transform/opacity only,
// all heights reserved), holds ~5 s, softly resets and repeats. It pauses on its own Pause button, the `paused` prop,
// off-screen (<10% visible) or a hidden tab. Reduced motion: the still, completed rail, no loop, no Pause button.
import { Fragment, useEffect, useRef, useState } from "react";
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
const TICK = 20; // px height of one category line in the CHECK window

// Timeline (ms from cycle start). `at` = the pulse arrives at that step's node; `leave` = it sets off for the next.
const T = {
  crawl: { at: 150, leave: 2250 },
  check: { at: 2700, leave: 5000 },
  suggest: { at: 5450, leave: 7350 },
  decide: { at: 7800 },
  rowGap: 200,
  rollMs: 650,
  suggestMs: 800,
  end: 8200,
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

// Three reads: the demo firm, then its pages and all flags together.
function useRailData(featuredFlagId) {
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
      const domain = String(firm.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (alive) setState({ status: "ready", firm, domain, pages, featured, featuredPage });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroWorkflow2({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  const data = useRailData(featuredFlagId);
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
      {data.status === "error" ? null : <Rail data={data} rewrite={featuredRewrite} loop={loop} paused={paused} />}
    </section>
  );
}

// One step on the rail: the node sits on the rail line, the label and content sit to its right.
function Step({ n, name, label, last = false, children }) {
  return (
    <li data-w2-step className={`relative grid gap-x-8 gap-y-2 pl-9 sm:grid-cols-[13rem_minmax(0,1fr)] ${last ? "" : "pb-7"}`}>
      {last ? null : (
        <span aria-hidden="true" className="absolute -bottom-[3px] left-[11px] top-[16px] w-px bg-[color:var(--h-border)]" />
      )}
      <span
        data-w2-node
        aria-hidden="true"
        className="absolute left-[5px] top-[3px] grid h-[13px] w-[13px] place-items-center rounded-full border border-[color:var(--h-border)] bg-[color:var(--h-surface)]"
      >
        <span data-w2-fill data-w2-anim className="h-[5px] w-[5px] rounded-full bg-[color:var(--h-fg)]" />
      </span>
      <div data-w2-label className="min-w-0">
        <p className="flex items-baseline gap-2 font-mono text-[11px] uppercase leading-5 tracking-[0.08em] text-[color:var(--h-muted)]">
          <span className="tabular-nums">{n}</span>
          <span className="text-[color:var(--h-fg)]">{name}</span>
        </p>
        <p className="text-sm font-medium text-[color:var(--h-fg)]">{label}</p>
      </div>
      <div data-w2-body data-w2-anim className="w2-body min-w-0">
        {children}
      </div>
    </li>
  );
}

function Rail({ data, rewrite, loop, paused }) {
  const ready = data.status === "ready";
  const stageRef = useRef(null);
  const railRef = useRef(null);
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
    const rail = railRef.current;
    if (!stage || !rail || !stage.animate) return undefined;
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
    const q = (sel, root = stage) => Array.from(root.querySelectorAll(sel));

    const layCycle = () => {
      const run = (el, frames, options) => {
        if (!el) return null;
        const anim = el.animate(frames, { fill: "backwards", easing: EASE_OUT, ...options });
        animations.push(anim);
        return anim;
      };
      const fadeIn = [{ opacity: 0 }, { opacity: 1 }];
      const steps = q("[data-w2-step]", rail);
      const stops = [T.crawl, T.check, T.suggest, T.decide];

      // The pulse: one amber dot that travels the rail, dwelling on each node while its step expands.
      const pulse = stage.querySelector("[data-w2-pulse]");
      const ys = steps.map((s) => {
        const node = s.querySelector("[data-w2-node]");
        return s.offsetTop + node.offsetTop + node.offsetHeight / 2;
      });
      const total = T.end + (loop ? HOLD_MS + RESET_MS : 0);
      const k = (ms) => Math.min(1, ms / total);
      const at = (y) => `translateY(${y}px)`;
      const frames = [
        { offset: 0, opacity: 0, transform: at(ys[0]) },
        { offset: k(T.crawl.at), opacity: 1, transform: at(ys[0]) },
        { offset: k(T.crawl.leave), opacity: 1, transform: at(ys[0]), easing: EASE_IN_OUT },
        { offset: k(T.check.at), opacity: 1, transform: at(ys[1]) },
        { offset: k(T.check.leave), opacity: 1, transform: at(ys[1]), easing: EASE_IN_OUT },
        { offset: k(T.suggest.at), opacity: 1, transform: at(ys[2]) },
        { offset: k(T.suggest.leave), opacity: 1, transform: at(ys[2]), easing: EASE_IN_OUT },
        { offset: k(T.decide.at), opacity: 1, transform: at(ys[3]) },
      ];
      if (loop) {
        frames.push({ offset: k(T.end + HOLD_MS), opacity: 1, transform: at(ys[3]) });
        frames.push({ offset: 1, opacity: 0, transform: at(ys[3]) });
      } else {
        frames.push({ offset: 1, opacity: 0, transform: at(ys[3]) });
      }
      run(pulse, frames, { duration: total, easing: "linear", fill: "both" });

      // Each step: its node fills with a pop, its label brightens, its content expands from the top.
      steps.forEach((step, i) => {
        const t = stops[i].at;
        run(step.querySelector("[data-w2-fill]"), [
          { opacity: 0, transform: "scale(0.2)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 320, delay: t });
        run(step.querySelector("[data-w2-label]"), [{ opacity: 0.45 }, { opacity: 1 }], { duration: 280, delay: t });
        run(step.querySelector("[data-w2-body]"), [
          { opacity: 0, transform: "scaleY(0.94)" },
          { opacity: 1, transform: "scaleY(1)" },
        ], { duration: 360, delay: t + 40 });
      });

      // CRAWL: the domain, then each captured page with its capture time.
      run(stage.querySelector("[data-w2-domain]"), fadeIn, { duration: 260, delay: T.crawl.at + 60 });
      q("[data-w2-row]").forEach((row, i) => {
        const t = T.crawl.at + 220 + i * T.rowGap;
        run(row.querySelector("[data-w2-thumb]"), [
          { opacity: 0, transform: "scale(0.85)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 280, delay: t });
        run(row.querySelector("[data-w2-path]"), [
          { opacity: 0, transform: "translateX(-6px)" },
          { opacity: 1, transform: "translateX(0)" },
        ], { duration: 300, delay: t + 40 });
        run(row.querySelector("[data-w2-time]"), fadeIn, { duration: 240, delay: t + 140 });
      });

      // CHECK: the category window rolls through the checks and lands on the match, which locks on;
      // then the exact quote lifts in and the viewfinder brackets close around it.
      const ticker = stage.querySelector("[data-w2-ticker]");
      if (ticker) {
        const hit = Number(ticker.dataset.w2Hit || 0);
        const from = hit < TAXONOMY.length / 2 ? TAXONOMY.length - 1 : 0;
        run(ticker, [
          { transform: `translateY(${-from * TICK}px)` },
          { transform: `translateY(${-hit * TICK}px)` },
        ], { duration: T.rollMs, delay: T.check.at + 100, easing: EASE_IN_OUT });
      }
      const lock = T.check.at + 100 + T.rollMs;
      run(stage.querySelector("[data-w2-lock]"), [
        { opacity: 0, transform: "scale(1.04)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 240, delay: lock });
      run(stage.querySelector("[data-w2-quote]"), [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 340, delay: lock + 120 });
      run(stage.querySelector("[data-w2-bracket]"), [
        { opacity: 0, transform: "scale(1.12)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 320, delay: lock + 220 });
      run(stage.querySelector("[data-w2-source]"), fadeIn, { duration: 240, delay: lock + 320 });

      // SUGGEST: the rewrite resolves word by word.
      const words = q("[data-w2-word]");
      words.forEach((w, i) =>
        run(w, [
          { opacity: 0, transform: "translateY(3px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 240, delay: T.suggest.at + 120 + (i / Math.max(1, words.length - 1)) * (T.suggestMs - 240) }),
      );

      // DECIDE: the approval chip settles, then its provenance line.
      q("[data-w2-decide]").forEach((el, i) =>
        run(el, [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 300, delay: T.decide.at + 60 + i * 120 }),
      );

      if (!loop) return;
      // Hold, then a soft reset: the animated layer fades out (labels dim back) and the next cycle starts there.
      const reset = { duration: RESET_MS, delay: T.end + HOLD_MS, fill: "forwards" };
      q("[data-w2-label]").forEach((el) => run(el, [{ opacity: 1 }, { opacity: 0.45 }], reset));
      let tail = null;
      q("[data-w2-anim]").forEach((el) => {
        tail = run(el, [{ opacity: 1 }, { opacity: 0 }], reset);
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

  const { domain = "", pages = [], featured, featuredPage } = ready ? data : {};
  const words = rewrite ? rewrite.text.split(/\s+/) : [];
  const slots = ready ? pages : [null, null, null, null];
  const hit = ready ? Math.max(0, TAXONOMY.indexOf(featured.category)) : 0;

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
            className="w2-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--h-border)] px-2.5 text-xs font-medium text-[color:var(--h-fg)]"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="currentColor">
              {userPaused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
            </svg>
            {userPaused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <div className="relative px-4 py-6 sm:px-6 sm:py-7">
        {/* The rail: hairline segments between the nodes, with the amber pulse riding on them. */}
        <div ref={railRef} className="relative">
          <span
            data-w2-pulse
            aria-hidden="true"
            className="w2-pulse pointer-events-none absolute left-[11px] top-0 z-10 h-0 w-0"
          >
            <span className="absolute -top-7 left-[-1px] h-7 w-[3px] rounded-full" style={{ background: "linear-gradient(to bottom, transparent, var(--h-accent))" }} />
            <span className="absolute left-[-5px] top-[-5px] h-[11px] w-[11px] rounded-full bg-[color:var(--h-accent)]" />
          </span>

          <ol className="relative">
            <Step n="01" name="Crawl" label="Crawled with Bright Data">
              <p data-w2-domain data-w2-anim className="truncate font-mono text-[12px] leading-5 text-[color:var(--h-fg)]">
                {ready ? domain : " "}
              </p>
              <ul className="mt-1.5 max-w-[30rem] space-y-1">
                {slots.map((page, i) => (
                  <li key={page?.id ?? i} data-w2-row className="flex items-center gap-2.5">
                    <span
                      data-w2-thumb
                      data-w2-anim
                      className="h-6 w-[18px] shrink-0 overflow-hidden rounded-[3px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]"
                    >
                      {page?.screenshot_ref ? (
                        <img src={page.screenshot_ref} alt="" loading="eager" decoding="async" className="h-full w-full object-cover object-top" />
                      ) : null}
                    </span>
                    <span data-w2-path data-w2-anim className="min-w-0 flex-1 truncate font-mono text-[11px] leading-4 text-[color:var(--h-fg)]">
                      {page ? page.label : " "}
                    </span>
                    <span data-w2-time data-w2-anim className="shrink-0 font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
                      {page ? stamp(page.fetched_at) : " "}
                    </span>
                  </li>
                ))}
              </ul>
            </Step>

            <Step n="02" name="Check" label="Checked against Marketing Rule checks">
              <div className="relative h-5 max-w-[22rem] overflow-hidden rounded-[4px]" aria-hidden="true">
                <div
                  data-w2-ticker
                  data-w2-hit={hit}
                  className="w2-ticker"
                  style={{ transform: `translateY(${-hit * TICK}px)` }}
                >
                  {TAXONOMY.map((id) => (
                    <p key={id} className="h-5 truncate px-2 text-[12px] leading-5 text-[color:var(--h-muted)]">
                      {categoryLabel(id)}
                    </p>
                  ))}
                </div>
                <p
                  data-w2-lock
                  data-w2-anim
                  className="absolute left-0 top-0 h-5 max-w-full truncate rounded-[4px] bg-[color:var(--h-quote-bg)] px-2 text-[12px] font-medium leading-5 text-[color:var(--h-quote-fg)]"
                >
                  {ready ? categoryLabel(featured.category) : " "}
                </p>
              </div>
              <p className="sr-only">{ready ? `Matched check: ${categoryLabel(featured.category)}` : ""}</p>
              <div className="relative mt-3 w-fit max-w-full sm:max-w-[30rem]">
                <blockquote
                  data-w2-quote
                  data-w2-anim
                  className="min-h-[52px] rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-2.5 py-1.5 font-mono text-[12px] leading-snug text-[color:var(--h-quote-fg)] sm:min-h-0"
                >
                  {ready ? quoted(featured.span) : " "}
                </blockquote>
                <Brackets />
              </div>
              <p data-w2-source data-w2-anim className="mt-2 truncate font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
                {ready ? `${fileName(featuredPage.url, data.firm.domain)} · potential issue for review` : " "}
              </p>
            </Step>

            <Step n="03" name="Suggest" label="AI suggests a rewrite">
              {rewrite ? (
                <div className="max-w-[34rem] rounded-md bg-[color:var(--h-surface-2)] px-3 py-2">
                  <p className="text-[11px] font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</p>
                  <p className="sr-only">{rewrite.text}</p>
                  <p aria-hidden="true" className="mt-1 text-[13px] leading-relaxed text-[color:var(--h-fg)]">
                    {words.map((w, i) => (
                      <Fragment key={i}>
                        <span data-w2-word data-w2-anim className="inline-block">
                          {w}
                        </span>
                        {i < words.length - 1 ? " " : null}
                      </Fragment>
                    ))}
                  </p>
                </div>
              ) : null}
            </Step>

            <Step n="04" name="Decide" label="A person decides" last>
              <span
                data-w2-decide
                data-w2-anim
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2.5 py-1 text-xs text-[color:var(--h-fg)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" aria-hidden="true" />
                Awaiting your approval
              </span>
              {rewrite ? (
                <p data-w2-decide data-w2-anim className="mt-2 font-mono text-[10px] leading-4 text-[color:var(--h-muted)]">
                  Generated by Vigil on {stamp(rewrite.generatedAt)}
                </p>
              ) : null}
            </Step>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Viewfinder corners (the logo's brackets) around the flagged quote.
function Brackets() {
  return (
    <svg
      data-w2-bracket
      data-w2-anim
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
.w2-body { transform-origin: top left; }
.w2-pulse { opacity: 0; will-change: transform, opacity; }
.w2-ticker { will-change: transform; }
.w2-btn { transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease; }
.w2-btn:hover { background-color: var(--h-surface-2); }
.w2-btn:active { transform: scale(0.97); }
.w2-btn:focus-visible { outline: 2px solid var(--h-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .w2-pulse { display: none; }
  .w2-btn { transition: none; }
}
`;
