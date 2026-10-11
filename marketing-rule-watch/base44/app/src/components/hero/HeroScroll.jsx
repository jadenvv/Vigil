// Hero variant "Scroll" (?a=scroll in the hero lab). The headline and ScanForm sit above the fold; below them a
// tall stage with a sticky frame plays the contact-sheet story, scrubbed by scroll position:
//   (a) a scan line crosses the 10 captured pages, (b) brackets lock on to the pages with findings,
//   (c) the about.html frame opens into the flagged quote, (d) Vigil's rewrite appears, awaiting approval.
// One number drives everything: --hs-p (0..1) on the stage. Where CSS scroll-driven animations exist, a
// view() timeline animates --hs-p itself; elsewhere one passive scroll listener writes it per frame.
// Each element maps --hs-p to its own local progress and only ever changes transform and opacity.
// --hs-p defaults to 1, so the default render (and reduced motion) is the final frame at normal height.
import { useEffect, useMemo, useRef, useState } from "react";
import "./schemes.css";
import { base44 } from "@/api/base44Client";
import { SeverityBadge } from "@/components/Badges";
import { findDemoFirm } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { latestPerUrl } from "@/lib/snapshots";

const COLS = 5;
// Scroll ranges, as fractions of the stage's sticky travel. [start, length].
const R = {
  scan: [0.04, 0.34], // (a) scan line crosses the sheet: 0.04 to 0.38
  tally: [0.37, 0.05], // pages-with-findings tally under the sheet
  dimRest: [0.42, 0.12], // the other frames step back
  open: [0.44, 0.2], // (c) about.html frame grows into the evidence card: 0.44 to 0.64
  ghost: [0.52, 0.1], // captured page inside the card gives way
  quote: [0.56, 0.08], // flagged quote and header settle in
  rewrite: [0.68, 0.1], // (d) Vigil's rewrite rises in: 0.68 to 0.78
  approval: [0.76, 0.06], // "Awaiting your approval" + caption; hold from 0.82 to 1
};
const BRACKET_LEN = 0.05;

function range([a, b]) {
  return { "--a": a, "--b": b };
}

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

function orderPages(pages, featuredUrl) {
  const rank = (page) => (page.label === "index.html" ? 0 : page.url === featuredUrl ? 1 : 2);
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

// Decided once, before first paint, so the stage's height never changes after mount.
function scrollMode() {
  if (typeof window === "undefined") return "static";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "static";
  if (window.CSS?.supports?.("animation-timeline: view()")) return "css";
  return "js";
}

// Three reads: the demo firm, then its pages and all flags together.
function useContactSheet(featuredFlagId) {
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
      const pageIds = new Set(allPages.map((page) => page.id));
      const flags = allFlags.filter((flag) => pageIds.has(flag.page_id));
      const featured = flags.find((flag) => flag.id === featuredFlagId);
      const featuredPage = featured && allPages.find((page) => page.id === featured.page_id);
      if (!featured || !featuredPage) throw new Error(`Featured flag ${featuredFlagId} not found`);
      const latest = latestPerUrl(allPages);
      const latestIds = new Set(latest.map((page) => page.id));
      const pageUrl = Object.fromEntries(allPages.map((page) => [page.id, page.url]));
      const countByUrl = {};
      for (const flag of flags) {
        if (latestIds.has(flag.page_id)) countByUrl[pageUrl[flag.page_id]] = (countByUrl[pageUrl[flag.page_id]] ?? 0) + 1;
      }
      const labelled = latest.map((page) => ({ ...page, label: fileName(page.url, firm.domain) }));
      const pages = orderPages(labelled, featuredPage.url).slice(0, 10);
      const total = pages.reduce((n, page) => n + (countByUrl[page.url] ?? 0), 0);
      if (alive) setState({ status: "ready", firm, pages, countByUrl, total, featured, featuredPage });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroScroll({ ScanForm, featuredFlagId, featuredRewrite }) {
  const sheet = useContactSheet(featuredFlagId);
  return (
    <section aria-labelledby="home-title" className="hs-root">
      <style>{CSS}</style>
      <div className="max-w-3xl space-y-5 sm:space-y-7">
        <div className="space-y-3 sm:space-y-4">
          <h1
            id="home-title"
            className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-[color:var(--h-fg)] sm:text-5xl lg:text-[3rem] lg:leading-[1.08]"
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
      {sheet.status === "error" ? null : <ScrollStage sheet={sheet} rewrite={featuredRewrite} />}
    </section>
  );
}

function ScrollStage({ sheet, rewrite }) {
  const [mode] = useState(scrollMode);
  const ready = sheet.status === "ready";
  const stageRef = useRef(null);
  const slotRef = useRef(null);
  const cardRef = useRef(null);
  const gridRef = useRef(null);

  // Fallback: no CSS scroll timeline, so write --hs-p from one passive scroll listener, once per frame.
  useEffect(() => {
    if (mode !== "js") return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = stage.getBoundingClientRect();
      const travel = box.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -box.top / travel)) : 1;
      stage.style.setProperty("--hs-p", p.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mode]);

  // FLIP source for the card: the about.html frame's box relative to the card's (untransformed) slot.
  useEffect(() => {
    if (mode === "static" || !ready) return undefined;
    const measure = () => {
      const slot = slotRef.current;
      const card = cardRef.current;
      const source = gridRef.current?.querySelector("[data-hs-featured] [data-hs-frame]");
      if (!slot || !card || !source) return;
      const to = slot.getBoundingClientRect();
      const from = source.getBoundingClientRect();
      if (!to.width || !to.height || !from.width) return;
      card.style.setProperty("--dx", (from.left - to.left).toFixed(1));
      card.style.setProperty("--dy", (from.top - to.top).toFixed(1));
      card.style.setProperty("--sx", (from.width / to.width).toFixed(4));
      card.style.setProperty("--sy", (from.height / to.height).toFixed(4));
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer) {
      observer.observe(slotRef.current);
      observer.observe(gridRef.current);
    } else {
      window.addEventListener("resize", measure);
    }
    return () => (observer ? observer.disconnect() : window.removeEventListener("resize", measure));
  }, [mode, ready]);

  const slots = useMemo(() => (ready ? sheet.pages : Array.from({ length: 10 }, () => null)), [ready, sheet.pages]);
  const { featured, featuredPage, countByUrl = {}, pages = [], total = 0, firm } = ready ? sheet : {};
  const withFindings = pages.filter((page) => countByUrl[page.url]).length;

  return (
    <div
      ref={stageRef}
      className="hs-stage relative mt-10 sm:mt-14"
      data-mode={mode === "static" ? undefined : mode}
      aria-busy={!ready}
    >
      <div className="hs-frame flex flex-col justify-end pb-6 sm:justify-center sm:pb-0">
        {ready ? (
          <p className="sr-only">
            Vigil read {pages.length} pages published by {firm.name}, a fictional firm we built for this demo, and found{" "}
            {total} potential issues for review on {withFindings} of them.
          </p>
        ) : null}

        <div className="grid items-center gap-5 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
          <div>
            <div ref={gridRef} className="relative" aria-hidden="true">
              <ul className="grid grid-cols-5 gap-1.5 sm:gap-3">
                {slots.map((page, i) => {
                  const count = page ? countByUrl[page.url] ?? 0 : 0;
                  const isFeatured = Boolean(page && featuredPage && page.url === featuredPage.url);
                  // The bracket locks as the scan line crosses this column.
                  const center = ((i % COLS) + 0.5) / COLS;
                  const lockAt = R.scan[0] + R.scan[1] * center - BRACKET_LEN * 0.4;
                  return (
                    <li
                      key={page?.id ?? i}
                      className={isFeatured ? undefined : "hs-k hs-rest"}
                      style={isFeatured ? undefined : range(R.dimRest)}
                      data-hs-featured={isFeatured ? "" : undefined}
                    >
                      <div data-hs-frame className="relative aspect-[4/5]">
                        <div className="absolute inset-0 overflow-hidden rounded-[6px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]">
                          {page?.screenshot_ref ? (
                            <img
                              src={page.screenshot_ref}
                              alt=""
                              loading="eager"
                              decoding="async"
                              className="hs-shot h-full w-full object-cover object-top"
                            />
                          ) : null}
                        </div>
                        {count ? <Brackets count={count} at={lockAt} /> : null}
                      </div>
                      <p className="mt-1 truncate font-mono text-[9px] leading-none text-[color:var(--h-muted)] sm:mt-1.5 sm:text-[11px]">
                        {page ? page.label : " "}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {/* The line travels inside its own clipped layer so it never widens the page. */}
              <div className="pointer-events-none absolute inset-x-0 -top-1 bottom-3 overflow-hidden">
                <div className="hs-k hs-line absolute inset-0" style={range(R.scan)}>
                  <span className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-[color:var(--h-accent)]" />
                </div>
              </div>
            </div>
            <p
              className="hs-k hs-fade mt-3 font-mono text-[11px] leading-5 text-[color:var(--h-muted)] sm:text-xs"
              style={range(R.tally)}
              aria-hidden="true"
            >
              {ready ? `${withFindings} of ${pages.length} pages · ${total} potential issues for review` : " "}
            </p>
          </div>

          <div ref={slotRef} className="relative">
            <figure
              ref={cardRef}
              className="hs-k hs-card relative overflow-hidden rounded-[10px] border border-[color:var(--h-border)] bg-[color:var(--h-surface)]"
              style={{ ...range(R.open), boxShadow: "var(--h-shadow)" }}
              data-testid="home-pair"
            >
              {ready && featuredPage?.screenshot_ref ? (
                <img
                  src={featuredPage.screenshot_ref}
                  alt=""
                  aria-hidden="true"
                  className="hs-k hs-ghost pointer-events-none absolute inset-0 z-10 h-full w-full object-cover object-top"
                  style={range(R.ghost)}
                />
              ) : null}
              <div className="p-4 sm:p-5">
                <div className="hs-k hs-fade" style={range(R.quote)}>
                  <div className="flex h-6 items-center gap-3 text-sm">
                    {ready ? (
                      <>
                        <SeverityBadge category={featured.category} />
                        <span className="truncate font-medium text-[color:var(--h-fg)]">
                          {categoryLabel(featured.category)}
                        </span>
                      </>
                    ) : (
                      <span className="h-5 w-48 rounded-full bg-[color:var(--h-surface-2)]" />
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs leading-5 text-[color:var(--h-muted)]">
                    {ready ? `${fileName(featuredPage.url, firm.domain)} · captured ${stamp(featuredPage.fetched_at)}` : " "}
                  </p>
                  <blockquote
                    data-testid="home-quote"
                    className="mt-3 min-h-[3.75rem] rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-3 py-2 font-mono text-[13px] leading-relaxed text-[color:var(--h-quote-fg)] sm:mt-4"
                  >
                    {ready ? quoted(featured.span) : " "}
                  </blockquote>
                </div>
                {rewrite ? (
                  <div data-testid="home-rewrite" className="hs-k hs-rise mt-4" style={range(R.rewrite)}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</span>
                      <span
                        className="hs-k hs-fade inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2 py-0.5 text-[color:var(--h-muted)]"
                        style={range(R.approval)}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" />
                        Awaiting your approval
                      </span>
                    </div>
                    <p className="mt-2 rounded-md bg-[color:var(--h-surface-2)] px-3 py-2 text-[13px] leading-relaxed text-[color:var(--h-fg)]">
                      {rewrite.text}
                    </p>
                    <figcaption
                      className="hs-k hs-fade mt-3 text-xs text-[color:var(--h-muted)]"
                      style={range(R.approval)}
                    >
                      Generated by Vigil on <span className="font-mono">{stamp(rewrite.generatedAt)}</span>. A person
                      approves, edits or dismisses it.
                    </figcaption>
                  </div>
                ) : null}
              </div>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );
}

// Viewfinder corners (the logo's brackets) around a frame, with the count of potential issues.
function Brackets({ count, at }) {
  return (
    <>
      <svg
        viewBox="0 0 100 125"
        preserveAspectRatio="none"
        className="hs-k hs-bracket pointer-events-none absolute -inset-[3px] h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible"
        style={range([at, BRACKET_LEN])}
      >
        <g fill="none" style={{ stroke: "var(--h-accent)" }} strokeWidth="2.5" strokeLinecap="square">
          <path d="M0 16V0h13" vectorEffect="non-scaling-stroke" />
          <path d="M87 0h13v16" vectorEffect="non-scaling-stroke" />
          <path d="M100 109v16H87" vectorEffect="non-scaling-stroke" />
          <path d="M13 125H0v-16" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <span
        className="hs-k hs-fade absolute bottom-1 right-1 rounded-[4px] bg-[color:var(--h-fg)] px-1 font-mono text-[9px] leading-[14px] tabular-nums text-[color:var(--h-bg)] sm:bottom-1.5 sm:right-1.5 sm:text-[10px] sm:leading-[16px]"
        style={range([at + 0.015, BRACKET_LEN])}
      >
        {count}
      </span>
    </>
  );
}

// --t: this element's progress through its own [--a, --a + --b] slice of --hs-p.
// --e: smoothstep of --t (eased in and out); --o: cubic ease-out of --t (fast start, soft landing).
const CSS = `
@property --hs-p { syntax: "<number>"; inherits: true; initial-value: 1; }
.hs-k {
  --t: clamp(0, (var(--hs-p, 1) - var(--a)) / var(--b), 1);
  --e: calc(var(--t) * var(--t) * (3 - 2 * var(--t)));
  --o: calc(1 - (1 - var(--t)) * (1 - var(--t)) * (1 - var(--t)));
}
.hs-shot { opacity: var(--h-thumb-dim, 0.55); }
.hs-line { transform: translateX(calc(var(--t) * 100%)); opacity: clamp(0, min(var(--t), 1 - var(--t)) * 14, 1); }
.hs-bracket { transform: scale(calc(1.18 - 0.18 * var(--o))); opacity: var(--o); }
.hs-fade { opacity: var(--e); }
.hs-rest { opacity: calc(1 - 0.45 * var(--e)); }
.hs-rise { transform: translateY(calc((1 - var(--e)) * 14px)); opacity: var(--e); }
.hs-ghost { opacity: calc(1 - var(--e)); }
.hs-card {
  transform-origin: 0 0;
  transform:
    translate(calc(var(--dx, 0) * (1 - var(--o)) * 1px), calc(var(--dy, 0) * (1 - var(--o)) * 1px))
    scale(calc(var(--sx, 1) + (1 - var(--sx, 1)) * var(--o)), calc(var(--sy, 1) + (1 - var(--sy, 1)) * var(--o)));
  opacity: clamp(0, var(--t) * 6, 1);
}
.hs-stage[data-mode] { height: 180vh; }
@media (min-width: 640px) { .hs-stage[data-mode] { height: 220vh; } }
.hs-stage[data-mode] .hs-frame { position: sticky; top: 0; height: 100vh; height: 100svh; }
.hs-stage[data-mode] .hs-line,
.hs-stage[data-mode] .hs-card { will-change: transform, opacity; }
.hs-stage[data-mode="css"] {
  animation: hs-progress linear both;
  animation-timeline: view();
  animation-range: contain 0% contain 100%;
}
@keyframes hs-progress { from { --hs-p: 0; } to { --hs-p: 1; } }
@media (prefers-reduced-motion: reduce) {
  .hs-line { display: none; }
}
`;
