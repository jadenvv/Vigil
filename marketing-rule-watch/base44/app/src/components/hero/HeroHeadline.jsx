// Hero variant "Scanned headline" (?hero=headline). Type is the whole show: an amber scan line passes down
// through the headline, the glyphs under it flicker into Geist Mono, and the line settles as the top edge of
// the evidence strip (one real flagged quote and Vigil's real rewrite) above the scan form.
//
// The final frame is the base markup. The sequence is Web Animations on transform and opacity only, started
// after mount, so if it never runs (reduced motion, failed load, no fonts) the still final frame is what shows.
// loop: hold on the evidence, fade the line out, re-scan from the top (the strip stays put). Paused by the
// `paused` prop, by the hero being under ~10% visible, or by a hidden tab; it resumes where it stopped.
// Colours come only from the scheme tokens in schemes.css (set by the page's .hero-scope wrapper).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./schemes.css";
import { SeverityBadge } from "@/components/Badges";
import { loadFlag } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { useAsync } from "@/lib/useAsync";

const HEADLINE = "Vigil finds what slipped past review.";
const SUBHEAD =
  "Vigil scans what your firm has published online and flags anything that may conflict with your compliance policy, with the exact quote, for a human to review.";

// One timeline, ms. The line crosses the headline, then decelerates into the strip's top edge.
const START = 180;
const TRAVEL = 2280;
const HEAD_SHARE = 0.54; // fraction of TRAVEL spent crossing the headline
const EASE_CROSS = "cubic-bezier(0.45, 0, 0.7, 0.6)"; // gentle start, leaves the headline still moving
const EASE_SETTLE = "cubic-bezier(0.3, 0.6, 0.3, 1)"; // picks up that speed, then a long deceleration
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const STRIP_DELAY = START + TRAVEL - 620;
const STRIP_DURATION = 600; // ends at 2460 ms
const BAND = 0.42; // mono band height as a share of the headline line height
const HOLD = 2500; // loop: rest on the final evidence frame
const RESET = 400; // loop: the line fades out before the next pass
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";
const GLOW = 0.22; // peak glow opacity; the glow itself is pure --h-accent

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function fileName(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const last = pathname.split("/").filter(Boolean).pop();
    return last || hostname;
  } catch {
    return url;
  }
}

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

// Word boxes of the real headline, so the mono copy lands glyph-for-glyph on top of it.
function measureWords(h1, overlay) {
  const node = h1.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const style = getComputedStyle(h1);
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || fontSize;
  const h1Box = h1.getBoundingClientRect();
  const box = overlay.getBoundingClientRect();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = `500 ${fontSize}px "Geist Mono", ui-monospace, monospace`;
  const text = node.textContent;
  const words = [];
  const range = document.createRange();
  const re = /\S+/g;
  let match;
  while ((match = re.exec(text))) {
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    const rect = range.getBoundingClientRect();
    const line = Math.max(0, Math.floor((rect.top + rect.height / 2 - h1Box.top) / lineHeight));
    const mono = ctx.measureText(match[0]).width || rect.width;
    words.push({
      text: match[0],
      left: rect.left - box.left,
      top: h1Box.top - box.top + line * lineHeight,
      width: rect.width,
      scale: rect.width / mono,
    });
  }
  range.detach?.();
  return { words, fontSize, lineHeight };
}

export default function HeroHeadline({ ScanForm, featuredFlagId, featuredRewrite, loop = false, paused = false }) {
  const { status, data } = useAsync(() => loadFlag(featuredFlagId), [featuredFlagId]);
  const ready = status === "ready";

  const sectionRef = useRef(null);
  const h1Ref = useRef(null);
  const overlayRef = useRef(null);
  const bandRef = useRef(null);
  const bandInnerRef = useRef(null);
  const lineRef = useRef(null);
  const glowRef = useRef(null);
  const bodyRef = useRef(null);
  const [scan, setScan] = useState(null); // measured mono overlay, only while the sequence runs
  // Played once per mount (the page replays by remounting). Reset if a cleanup interrupts it (StrictMode).
  const playedRef = useRef(false);
  const cycleRef = useRef(0); // loop passes completed; the strip only enters on the first
  const liveRef = useRef(new Set()); // every animation that is part of the running sequence
  const runningRef = useRef(true); // false while paused, off-screen or in a hidden tab

  const syncPlayState = useCallback(() => {
    liveRef.current.forEach((anim) => {
      if (runningRef.current && anim.playState === "paused") anim.play();
      else if (!runningRef.current && anim.playState === "running") anim.pause();
    });
  }, []);

  // Pause rules (loop only): the Pause button, under ~10% visible, or a hidden tab.
  useEffect(() => {
    if (!loop) {
      runningRef.current = true;
      syncPlayState();
      return undefined;
    }
    let visible = true;
    const update = () => {
      runningRef.current = !paused && visible && !document.hidden;
      syncPlayState();
    };
    update();
    let observer = null;
    if (sectionRef.current && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.intersectionRatio >= 0.1;
          update();
        },
        { threshold: [0, 0.1] },
      );
      observer.observe(sectionRef.current);
    }
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [loop, paused, syncPlayState]);

  // Step 1: once the evidence is in and fonts are settled, measure the headline and mount the mono copy.
  useLayoutEffect(() => {
    if (!ready || playedRef.current || reducedMotion()) return undefined;
    let cancelled = false;
    let hold = null;
    const begin = () => {
      if (cancelled || !h1Ref.current || !overlayRef.current) return;
      hold?.cancel();
      const measured = measureWords(h1Ref.current, overlayRef.current);
      if (measured) setScan(measured);
    };
    if (document.fonts?.status === "loaded") {
      begin();
    } else {
      // Keep the strip body at its pre-arrival state for the short wait; give up after 1.2 s and show the final frame.
      hold = bodyRef.current?.animate([{ opacity: 0 }], { duration: 1200, fill: "forwards" }) ?? null;
      Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(() => {
        if (document.fonts?.status === "loaded") begin();
        else hold?.cancel();
      });
    }
    return () => {
      cancelled = true;
      hold?.cancel();
    };
  }, [ready]);

  // Step 2: with the mono copy in the DOM (still before paint), run the one orchestrated sequence.
  useLayoutEffect(() => {
    if (!scan || (!loop && playedRef.current)) return undefined;
    const section = sectionRef.current;
    const h1 = h1Ref.current;
    const overlay = overlayRef.current;
    const line = lineRef.current;
    if (!section || !h1 || !overlay || !line || !bandRef.current || !bandInnerRef.current) return undefined;

    const lineTop = line.getBoundingClientRect().top; // the line's resting place: the strip's top edge
    const h1Box = h1.getBoundingClientRect();
    const overlayTop = overlay.getBoundingClientRect().top;
    const bandHeight = Math.round(scan.lineHeight * BAND);

    // Line path in its own coordinates (0 = resting on the strip).
    const from = h1Box.top - lineTop + scan.lineHeight * 0.08;
    const cross = h1Box.bottom - lineTop + bandHeight / 2;
    const path = [
      { offset: 0, y: from, easing: EASE_CROSS },
      { offset: HEAD_SHARE, y: cross, easing: EASE_SETTLE },
      { offset: 1, y: 0 },
    ];
    // The band is centred on the line, in the overlay's coordinates. Same offsets and easings keep it locked to the line.
    const toBand = (y) => y + lineTop - overlayTop - bandHeight / 2;
    const timing = { duration: TRAVEL, delay: START, fill: "backwards" };
    const fadeIn = [
      { offset: 0, opacity: 0, easing: EASE_OUT },
      { offset: 0.08, opacity: 1 },
      { offset: 1, opacity: 1 },
    ];
    const repeat = cycleRef.current > 0;

    const own = [];
    const track = (anims) => {
      anims.filter(Boolean).forEach((anim) => {
        own.push(anim);
        liveRef.current.add(anim);
        const drop = () => liveRef.current.delete(anim);
        anim.addEventListener("finish", drop);
        anim.addEventListener("cancel", drop);
        if (!runningRef.current) anim.pause();
      });
      return anims.filter(Boolean);
    };

    const animations = track([
      line.animate(
        path.map(({ offset, y, easing }) => ({ offset, transform: `translateY(${y}px)`, ...(easing && { easing }) })),
        timing,
      ),
      line.animate(fadeIn, timing),
      bandRef.current.animate(
        path.map(({ offset, y, easing }) => ({ offset, transform: `translateY(${toBand(y)}px)`, ...(easing && { easing }) })),
        timing,
      ),
      // The band arrives with the line, so a repeat pass never snaps the top slice into mono.
      bandRef.current.animate(fadeIn, timing),
      bandInnerRef.current.animate(
        path.map(({ offset, y, easing }) => ({ offset, transform: `translateY(${-toBand(y)}px)`, ...(easing && { easing }) })),
        timing,
      ),
      glowRef.current?.animate(
        [
          { offset: 0, opacity: 0 },
          { offset: 0.08, opacity: GLOW },
          { offset: 0.8, opacity: GLOW * 0.85, easing: EASE_OUT },
          { offset: 1, opacity: 0 },
        ],
        timing,
      ),
      // The strip enters once; on loop passes it stays put and the line settles back onto it.
      !repeat &&
        bodyRef.current?.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: STRIP_DURATION, delay: STRIP_DELAY, easing: EASE_OUT, fill: "backwards" },
        ),
    ]);

    playedRef.current = true;
    let finished = false;
    let cancelled = false;
    const allDone = (anims) => Promise.all(anims.map((a) => a.finished));
    allDone(animations)
      .then(() => {
        if (cancelled) return undefined;
        if (!loop) {
          finished = true;
          setScan(null);
          return undefined;
        }
        // Hold on the evidence. A target-less effect is a timer that pauses and resumes with everything else.
        const hold = new Animation(new KeyframeEffect(null, null, { duration: HOLD }), document.timeline);
        hold.play();
        return allDone(track([hold]))
          .then(() => {
            if (cancelled) return undefined;
            // fill: forwards keeps the line hidden until the next pass's backwards fill takes over in the same commit.
            const fade = line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RESET, easing: EASE_IN, fill: "forwards" });
            return allDone(track([fade]));
          })
          .then(() => {
            if (cancelled) return;
            cycleRef.current += 1;
            // Re-measure each pass so a resize between passes still lines the mono copy up.
            const measured = h1Ref.current && overlayRef.current ? measureWords(h1Ref.current, overlayRef.current) : null;
            setScan(measured ?? { ...scan });
          });
      })
      .catch(() => {}); // a cancelled animation rejects `finished`; the cleanup below owns that case
    return () => {
      cancelled = true;
      if (!finished) {
        own.forEach((a) => a.cancel());
        if (!loop) playedRef.current = false;
      }
    };
  }, [scan, loop]);

  const flag = data?.flag;
  const page = data?.page;

  return (
    <section ref={sectionRef} aria-labelledby="home-title" className="hh-root">
      <style>{`
        .hh-band { transform: translateY(-120%); }
        .hh-word { transform-origin: 0 50%; }
        .hh-glow { background: linear-gradient(to top, var(--h-accent), transparent); opacity: 0; }
      `}</style>

      <div className="relative">
        <h1
          ref={h1Ref}
          id="home-title"
          className="text-balance text-[2.375rem] font-semibold leading-[1.04] tracking-[-0.035em] text-[color:var(--h-fg)] sm:text-[4rem] sm:leading-[1] lg:text-[5.5rem] lg:leading-[0.98]"
        >
          {HEADLINE}
        </h1>
        {/* Decorative: a mono copy of the headline seen only through a thin band that rides the scan line. */}
        <div ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-4 -top-4 select-none overflow-hidden">
          <div
            ref={bandRef}
            className="hh-band absolute inset-x-0 top-0 overflow-hidden bg-[color:var(--h-bg)]"
            style={{ height: scan ? Math.round(scan.lineHeight * BAND) : 0 }}
          >
            <div ref={bandInnerRef} className="hh-band-inner absolute inset-x-0 top-0">
              {scan?.words.map((word, i) => (
                <span
                  key={i}
                  className="hh-word absolute whitespace-pre font-mono font-medium text-[color:var(--h-fg)]"
                  style={{
                    left: word.left,
                    top: word.top,
                    height: scan.lineHeight,
                    fontSize: scan.fontSize,
                    lineHeight: `${scan.lineHeight}px`,
                    transform: `scaleX(${word.scale})`,
                  }}
                >
                  {word.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-[color:var(--h-muted)] sm:mt-6 sm:text-lg">{SUBHEAD}</p>

      {status !== "error" && (
        <div className="relative mt-6 sm:mt-10" aria-busy={ready ? undefined : "true"} data-testid="hh-strip">
          {/* The strip's top edge. While loading it is a quiet hairline; once the evidence is in, it is where the scan line rests. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-[color:var(--h-border)]" />
          {ready && (
            <div ref={lineRef} aria-hidden="true" className="hh-line pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-[color:var(--h-accent)]">
              <div ref={glowRef} className="hh-glow absolute inset-x-0 bottom-full h-7" />
            </div>
          )}

          <div ref={bodyRef} className="hh-body grid gap-4 pt-4 sm:pt-5 md:grid-cols-[minmax(0,5fr)_auto_minmax(0,7fr)] md:gap-6">
            <figure className="min-w-0">
              {ready ? (
                <>
                  <figcaption className="flex flex-wrap items-center gap-2 text-sm">
                    <SeverityBadge category={flag.category} />
                    <span className="font-medium text-[color:var(--h-fg)]">{categoryLabel(flag.category)}</span>
                  </figcaption>
                  <blockquote
                    title={flag.span}
                    data-testid="home-quote"
                    className="mt-2.5 line-clamp-2 min-h-[3.875rem] rounded-r-md border-l-[3px] border-[color:var(--h-accent)] bg-[color:var(--h-quote-bg)] px-3 py-2 font-mono text-[13px] leading-[1.75] text-[color:var(--h-quote-fg)] sm:px-4 sm:text-sm md:line-clamp-none md:min-h-0"
                  >
                    {quoted(flag.span)}
                  </blockquote>
                  <p className="mt-2 hidden font-mono text-xs leading-relaxed text-[color:var(--h-muted)] sm:block">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline decoration-[color:var(--h-border)] underline-offset-2 hover:decoration-[color:var(--h-muted)]"
                    >
                      {fileName(page.url)}
                    </a>{" "}
                    · captured {stamp(page.fetched_at)}
                    <span className="block font-sans">Quarrywick Wealth is a fictional firm we built for this demo.</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="h-5 w-48 rounded-full bg-[color:var(--h-surface-2)]" />
                  <div className="mt-2.5 min-h-[3.875rem] rounded-r-md border-l-[3px] border-[color:var(--h-border)] bg-[color:var(--h-surface-2)] md:min-h-[4.25rem]" />
                </>
              )}
            </figure>

            <div aria-hidden="true" className="hidden items-start justify-center pt-9 text-[color:var(--h-muted)] md:flex">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>

            {/* Rendered (invisible) while loading so it reserves the strip's real height from first paint. */}
            <figure className={`min-w-0 ${ready ? "" : "invisible"}`} data-testid="home-rewrite">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[color:var(--h-fg)]">Vigil's suggested rewrite</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--h-border)] bg-[color:var(--h-surface)] px-2.5 py-0.5 text-xs text-[color:var(--h-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--h-accent)]" />
                  Awaiting your approval
                </span>
              </figcaption>
              <p title={featuredRewrite.text} className="mt-2.5 line-clamp-2 text-[15px] leading-relaxed text-[color:var(--h-fg)] md:line-clamp-none">
                {featuredRewrite.text}
              </p>
              <p className="mt-1.5 text-xs text-[color:var(--h-muted)]">
                Generated by Vigil on <span className="font-mono">{stamp(featuredRewrite.generatedAt)}</span>
                <span className="hidden sm:inline">. A person approves, edits or dismisses it.</span>
              </p>
            </figure>
          </div>
        </div>
      )}

      <div className="mt-6 sm:mt-8">
        <ScanForm />
      </div>
    </section>
  );
}
