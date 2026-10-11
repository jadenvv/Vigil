// Hero variant "Contact sheet" (?hero=contact). Every page Vigil read for the demo firm, laid out as a
// photographer's contact sheet: a scan line sweeps the sheet, viewfinder brackets lock on to the pages
// with potential issues, then the about.html frame is pulled and enlarged into the evidence card.
// The final frame is the default render; the sequence is layered on with WAAPI after mount, once, or with
// `loop` it holds on the evidence, fades back to the start state and repeats (paused by `paused`, off-screen
// or a hidden tab).
import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SeverityBadge } from "@/components/Badges";
import { findDemoFirm } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { latestPerUrl } from "@/lib/snapshots";
import "./schemes.css";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const SWEEP_EASE = [0.45, 0, 0.2, 1]; // eased in and out, so the line accelerates off the edge and settles
const SWEEP_START = 150;
const SWEEP_MS = 1050;
const PULL_AT = 1450; // the about.html frame starts to grow into the card
const PULL_MS = 700;
const CONTENT_FADE_AT = PULL_AT + PULL_MS * 0.55;
const CONTENT_FADE_MS = 420;
const SEQUENCE_END = CONTENT_FADE_AT + CONTENT_FADE_MS; // ≈2255 ms, the last beat settles
const HOLD_MS = 2500; // loop only: rest on the evidence frame
const RESET_MS = 400; // loop only: the soft fade back to the start state

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// Path below the firm's site root ("about.html", "blog/index.html"); the last segment if the root is unknown.
function fileName(url, domain = "") {
  const bare = String(url).replace(/^https?:\/\//, "");
  const root = String(domain).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (root && bare.startsWith(`${root}/`)) return bare.slice(root.length + 1) || "index.html";
  return bare.split("/").filter(Boolean).pop() || "index.html";
}

// Order the sheet: home page first, then the featured page, then the rest by file name.
// The phone shows only the first four, so the featured frame is always among them.
function orderPages(pages, featuredUrl) {
  const rank = (page) => (page.label === "index.html" ? 0 : page.url === featuredUrl ? 1 : 2);
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

// Time (0..1) at which a cubic-bezier easing reaches `progress`, so each bracket locks
// exactly as the eased scan line crosses its frame.
function timeAtProgress([x1, y1, x2, y2], progress) {
  const bez = (s, a, b) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  for (let s = 0; s <= 1; s += 0.002) if (bez(s, y1, y2) >= progress) return bez(s, x1, x2);
  return 1;
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
      if (!featured || !featuredPage) throw new Error("Featured flag not found");
      const latest = latestPerUrl(allPages);
      const countByUrl = {};
      const pageUrl = Object.fromEntries(allPages.map((page) => [page.id, page.url]));
      const latestIds = new Set(latest.map((page) => page.id));
      for (const flag of flags) if (latestIds.has(flag.page_id)) countByUrl[pageUrl[flag.page_id]] = (countByUrl[pageUrl[flag.page_id]] ?? 0) + 1;
      const labelled = latest.map((page) => ({ ...page, label: fileName(page.url, firm.domain) }));
      const pages = orderPages(labelled, featuredPage.url).slice(0, 10);
      const total = Object.values(countByUrl).reduce((n, c) => n + c, 0);
      if (alive) setState({ status: "ready", firm, pages, countByUrl, total, featured, featuredPage });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [featuredFlagId]);
  return state;
}

export default function HeroContact({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  const sheet = useContactSheet(featuredFlagId);
  return (
    <section
      aria-labelledby="home-title"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
    >
      <style>{CSS}</style>
      <div className="space-y-5 sm:space-y-7 lg:pt-4">
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
      {sheet.status === "error" ? null : (
        <ContactSheet sheet={sheet} rewrite={featuredRewrite} loop={loop} paused={paused} />
      )}
    </section>
  );
}

function ContactSheet({ sheet, rewrite, loop, paused }) {
  const ready = sheet.status === "ready";
  const gridRef = useRef(null);
  const lineRef = useRef(null);
  const cardRef = useRef(null);
  const ghostRef = useRef(null);
  const stageRef = useRef(null);
  const controlRef = useRef(null); // { setRunning(bool) } for the live sequence
  const blockers = useRef({ paused: false, offscreen: false, hidden: false });

  // Loop only: run while nothing blocks it (Pause button, under ~10% visible, hidden tab). Play-once ignores these.
  const applyRunning = () => {
    const b = blockers.current;
    controlRef.current?.setRunning(!loop || !(b.paused || b.offscreen || b.hidden));
  };

  const slots = useMemo(() => (ready ? sheet.pages : Array.from({ length: 10 }, () => null)), [ready, sheet.pages]);

  useEffect(() => {
    blockers.current.paused = paused;
    applyRunning();
  });

  useEffect(() => {
    if (!loop) return undefined;
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
      blockers.current.offscreen = false;
      blockers.current.hidden = false;
    };
  }, [loop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return undefined;
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const grid = gridRef.current;
    const line = lineRef.current;
    const card = cardRef.current;
    if (!grid || !line || !card || !grid.animate) return undefined;

    const dim = parseFloat(getComputedStyle(grid).getPropertyValue("--h-thumb-dim")) || 0.55;
    let animations = [];
    let running = true;
    // Pause only what is running and resume only what we paused: play() on a finished animation would replay it.
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

    const playCycle = () => {
      const previous = animations;
      animations = [];
      layCycle();
      // Cancel last cycle's held reset only now, in the same task, so no frame shows the final state in between.
      previous.forEach((a) => a.cancel());
      sync();
    };

    const layCycle = () => {
      const run = (el, frames, options) => {
        if (!el) return null;
        const anim = el.animate(frames, { fill: "backwards", ...options });
        animations.push(anim);
        return anim;
      };
      const gridBox = grid.getBoundingClientRect();
      const sweepEase = `cubic-bezier(${SWEEP_EASE.join(",")})`;

      // Beat 1: the scan line sweeps left to right across the sheet.
      run(
        line,
        [
          { transform: "translateX(-24px)", opacity: 0 },
          { opacity: 1, offset: 0.08 },
          { opacity: 1, offset: 0.9 },
          { transform: `translateX(${gridBox.width}px)`, opacity: 0 },
        ],
        // "backwards", not "both": once the sweep ends the line drops back to its hidden base style instead of
        // resting a grid-width to the right, where it widened the page on phones.
        { duration: SWEEP_MS, delay: SWEEP_START, easing: sweepEase, fill: "backwards" },
      );

      // Beat 2: as the line crosses each frame with findings, its brackets lock on.
      grid.querySelectorAll("[data-hc-tile]").forEach((tile) => {
        const box = tile.getBoundingClientRect();
        if (!box.width) return; // hidden on this breakpoint
        const center = (box.left + box.width / 2 - gridBox.left + 24) / (gridBox.width + 24);
        const at = SWEEP_START + timeAtProgress(SWEEP_EASE, Math.min(1, Math.max(0, center))) * SWEEP_MS;
        run(
          tile.querySelector("[data-hc-bracket]"),
          [
            { transform: "scale(1.18)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: 320, delay: at, easing: EASE_OUT },
        );
        run(
          tile.querySelector("[data-hc-count]"),
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 240, delay: at + 60, easing: EASE_OUT },
        );
      });

      // Beat 3a: the whole sheet steps back while one frame is pulled.
      grid.querySelectorAll("img").forEach((img) =>
        run(img, [{ opacity: 1 }, { opacity: dim }], { duration: 450, delay: PULL_AT - 50, easing: EASE_OUT }),
      );

      // Beat 3b: the about.html frame grows into the evidence card (FLIP: start at the frame's box).
      const source = grid.querySelector("[data-hc-featured] [data-hc-frame]");
      const from = source?.getBoundingClientRect();
      const to = card.getBoundingClientRect();
      if (from && from.width && to.width) {
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const sx = from.width / to.width;
        const sy = from.height / to.height;
        run(
          card,
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 },
            { opacity: 1, offset: 0.12 },
            { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
          ],
          { duration: PULL_MS, delay: PULL_AT, easing: EASE_OUT },
        );
        // The captured page rides along inside the growing card, then gives way to the evidence.
        run(
          ghostRef.current,
          [
            { opacity: 1, offset: 0 },
            { opacity: 1, offset: 0.45 },
            { opacity: 0, offset: 1 },
          ],
          { duration: PULL_MS, delay: PULL_AT, easing: EASE_OUT },
        );
        run(
          card.querySelector("[data-hc-content]"),
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: CONTENT_FADE_MS, delay: CONTENT_FADE_AT, easing: EASE_OUT },
        );
      }

      if (!loop) return;
      // Loop: hold on the evidence, then a soft reset. Everything the sequence revealed fades back to its start
      // state (brackets and counts out, thumbnails up, the card out) and is held there ("forwards") until the
      // next cycle's backwards fill takes over. Opacity only, so nothing moves and the layout never changes.
      const reset = { duration: RESET_MS, delay: SEQUENCE_END + HOLD_MS, easing: EASE_OUT, fill: "forwards" };
      const out = [{ opacity: 1 }, { opacity: 0 }];
      grid.querySelectorAll("[data-hc-bracket], [data-hc-count]").forEach((el) => run(el, out, reset));
      grid.querySelectorAll("img").forEach((img) => run(img, [{ opacity: dim }, { opacity: 1 }], reset));
      const tail = run(card, out, reset);
      tail.onfinish = playCycle;
    };

    playCycle();
    applyRunning();
    return () => {
      controlRef.current = null;
      animations.forEach((a) => a.cancel());
    };
  }, [ready, loop]); // eslint-disable-line react-hooks/exhaustive-deps

  const { featured, featuredPage, countByUrl = {}, pages = [], total = 0 } = ready ? sheet : {};
  const withFindings = pages.filter((page) => countByUrl[page.url]).length;

  return (
    <div ref={stageRef} className="hc-stage relative" aria-busy={!ready}>
      {ready ? (
        <p className="sr-only">
          Vigil read {pages.length} pages published by {sheet.firm.name}, a fictional firm we built for this demo, and
          found {total} potential issues for review on {withFindings} of them.
        </p>
      ) : null}

      <div ref={gridRef} className="relative" aria-hidden="true">
        <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {slots.map((page, i) => {
            const count = page ? countByUrl[page.url] ?? 0 : 0;
            const isFeatured = page && featuredPage && page.url === featuredPage.url;
            return (
              <li
                key={page?.id ?? i}
                className={i >= 4 ? "hidden sm:block" : undefined}
                data-hc-tile={count ? "" : undefined}
                data-hc-featured={isFeatured ? "" : undefined}
              >
                <div data-hc-frame className="relative aspect-[4/5]">
                  <div className="absolute inset-0 overflow-hidden rounded-[6px] border border-[color:var(--h-border)] bg-[color:var(--h-surface-2)]">
                    {page?.screenshot_ref ? (
                      <img
                        src={page.screenshot_ref}
                        alt=""
                        loading="eager"
                        decoding="async"
                        className="hc-shot h-full w-full object-cover object-top"
                      />
                    ) : null}
                  </div>
                  {count ? <Brackets count={count} /> : null}
                </div>
                <p className="mt-1.5 truncate font-mono text-[10px] leading-none text-[color:var(--h-muted)] sm:text-[11px]">
                  {page ? page.label : " "}
                </p>
              </li>
            );
          })}
        </ul>
        <span ref={lineRef} className="hc-line pointer-events-none absolute -top-1 bottom-4 left-0 w-6">
          <span className="absolute inset-y-0 right-0 w-[2px] rounded-full bg-[color:var(--h-accent)]" />
        </span>
      </div>

      <figure
        ref={cardRef}
        className="relative mt-4 origin-top-left overflow-hidden rounded-[10px] border border-[color:var(--h-border)] bg-[color:var(--h-surface)] sm:mt-5"
        style={{ boxShadow: "var(--h-shadow)" }}
        data-testid="home-pair"
      >
        {ready && featuredPage?.screenshot_ref ? (
          <img
            ref={ghostRef}
            src={featuredPage.screenshot_ref}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover object-top opacity-0"
          />
        ) : null}
        <div data-hc-content className="p-4 sm:p-5">
          {/* Fixed two-line header so the loading placeholder and the loaded card are the same height. */}
          <div className="flex h-6 items-center gap-3 text-sm">
            {ready ? (
              <>
                <SeverityBadge category={featured.category} />
                <span className="truncate font-medium text-[color:var(--h-fg)]">{categoryLabel(featured.category)}</span>
              </>
            ) : (
              <span className="h-5 w-48 rounded-full bg-[color:var(--h-surface-2)]" />
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs leading-5 text-[color:var(--h-muted)]">
            {ready ? `${fileName(featuredPage.url, sheet.firm.domain)} · captured ${stamp(featuredPage.fetched_at)}` : "\u00a0"}
          </p>
          <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
            <blockquote
              data-testid="home-quote"
              className="min-h-[3.75rem] rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-3 py-2 font-mono text-[13px] leading-relaxed text-[color:var(--h-quote-fg)]"
            >
              {ready ? quoted(featured.span) : " "}
            </blockquote>
            {rewrite ? (
              <div data-testid="home-rewrite">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] px-2 py-0.5 text-[color:var(--h-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" />
                    Awaiting your approval
                  </span>
                </div>
                <p className="mt-2 rounded-md bg-[color:var(--h-surface-2)] px-3 py-2 text-[13px] leading-relaxed text-[color:var(--h-fg)]">
                  {rewrite.text}
                </p>
              </div>
            ) : null}
          </div>
          {rewrite ? (
            <figcaption className="mt-3 text-xs text-[color:var(--h-muted)]">
              Generated by Vigil on <span className="font-mono">{stamp(rewrite.generatedAt)}</span>. A person approves,
              edits or dismisses it.
            </figcaption>
          ) : null}
        </div>
      </figure>
    </div>
  );
}

// Viewfinder corners (the logo's brackets) around a frame, with the count of potential issues.
function Brackets({ count }) {
  return (
    <>
      <svg
        data-hc-bracket
        viewBox="0 0 100 125"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-[3px] h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible"
      >
        <g fill="none" style={{ stroke: "var(--h-accent)" }} strokeWidth="2.5" strokeLinecap="square" vectorEffect="non-scaling-stroke">
          <path d="M0 16V0h13" vectorEffect="non-scaling-stroke" />
          <path d="M87 0h13v16" vectorEffect="non-scaling-stroke" />
          <path d="M100 109v16H87" vectorEffect="non-scaling-stroke" />
          <path d="M13 125H0v-16" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <span
        data-hc-count
        className="absolute bottom-1.5 right-1.5 rounded-[4px] bg-[color:var(--h-fg)] px-1 font-mono text-[10px] leading-[16px] tabular-nums text-[color:var(--h-bg)]"
      >
        {count}
      </span>
    </>
  );
}

const CSS = `
.hc-line { opacity: 0; will-change: transform, opacity; }
.hc-shot { opacity: var(--h-thumb-dim); }
@media (prefers-reduced-motion: reduce) {
  .hc-line { display: none; }
}
`;
