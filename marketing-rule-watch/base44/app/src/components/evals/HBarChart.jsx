// Hand-written horizontal bar chart for the eval page. No chart library.
// Each bar carries a direct value label; colour is never the only encoding (the series name sits
// beside every bar). Bars grow in once when scrolled into view; reduced motion shows them at rest.
import { useEffect, useId, useRef, useState } from "react";

// Brand tokens (tailwind.config.js `colors`): keyword baseline in a muted Night, Vigil in Dusk.
export const SERIES_FILL = {
  baseline: "#8B95AE", // night-300
  vigil: "#34558A", // dusk-700
};
const LAMP_500 = "#F5A524";
const LAMP_700 = "#9A5B00";
const NIGHT_950 = "#0B1120";
const NIGHT_600 = "#4A5570";
const PAPER_200 = "#E6E0D4";

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Measures the rendered width so the SVG is drawn at true pixel size (text never shrinks at 390 px).
function useWidth(fallback = 560) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width];
}

// True once the element has entered the viewport (or immediately when motion is reduced).
function useSeenOnce(ref) {
  const [seen, setSeen] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, reduced]);
  return [seen, reduced];
}

/**
 * groups: [{ label, bars: [{ series: "baseline"|"vigil", name, value (0..1), text, highlight? }] }]
 * `text` is the direct label (e.g. "5 of 18 · 28%"). `highlight` marks the one number to look at.
 * `fill` overrides the series colour (brand token hex only).
 */
export function HBarChart({ title, desc, groups, valueHeader = "Value", compact = false, nameWidth }) {
  const titleId = useId();
  const descId = useId();
  const [ref, width] = useWidth();
  const [seen, reduced] = useSeenOnce(ref);

  const nameW = nameWidth || (compact ? 64 : 76);
  const valueW = compact ? 92 : 112;
  const barH = compact ? 16 : 20;
  const barGap = 6;
  const groupLabelH = 22;
  const groupGap = compact ? 12 : 18;
  const barArea = Math.max(60, width - nameW - valueW);

  let y = 0;
  const layout = groups.map((group) => {
    const top = y;
    const labelY = top + 14;
    const barsTop = top + (group.label ? groupLabelH : 0);
    const bars = group.bars.map((bar, i) => ({ ...bar, y: barsTop + i * (barH + barGap) }));
    y = barsTop + group.bars.length * (barH + barGap) - barGap + groupGap;
    return { ...group, labelY, bars };
  });
  const height = Math.max(0, y - groupGap) + 2;

  return (
    <figure ref={ref} className="w-full">
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full overflow-visible font-sans"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>
          {desc}{" "}
          {groups
            .map((g) => `${g.label ? `${g.label}: ` : ""}${g.bars.map((b) => `${b.name} ${b.text}`).join(", ")}`)
            .join(". ")}
        </desc>
        {/* zero line */}
        <line x1={nameW} x2={nameW} y1={0} y2={height} stroke={PAPER_200} strokeWidth="1" />
        {layout.map((group) => (
          <g key={group.label || group.bars[0]?.name}>
            {group.label && (
              <text x={0} y={group.labelY} fontSize="13" fontWeight="500" fill={NIGHT_950}>
                {group.label}
              </text>
            )}
            {group.bars.map((bar, i) => {
              const w = Math.max(0, Math.min(1, bar.value)) * barArea;
              const cy = bar.y + barH / 2;
              return (
                <g key={`${bar.name}-${i}`}>
                  <text x={0} y={cy} dominantBaseline="central" fontSize="12" fill={NIGHT_600}>
                    {bar.name}
                  </text>
                  {/* track */}
                  <rect x={nameW} y={bar.y} width={barArea} height={barH} rx="3" fill={PAPER_200} opacity="0.45" />
                  <rect
                    x={nameW}
                    y={bar.y}
                    width={w}
                    height={barH}
                    rx="3"
                    fill={bar.fill || SERIES_FILL[bar.series] || SERIES_FILL.vigil}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "left center",
                      transform: seen ? "scaleX(1)" : "scaleX(0)",
                      transition: reduced ? "none" : "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                  {bar.highlight && (
                    <rect x={nameW - 1} y={bar.y - 2} width={3} height={barH + 4} rx="1" fill={LAMP_500} />
                  )}
                  <text
                    x={nameW + barArea + 8}
                    y={cy}
                    dominantBaseline="central"
                    fontSize={compact ? "12" : "13"}
                    fontWeight={bar.highlight ? "600" : "400"}
                    fill={bar.highlight ? LAMP_700 : NIGHT_950}
                    className="font-mono"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {bar.text}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {/* The same numbers as a table, for screen readers. The wrapper is sr-only: a table ignores width: 1px. */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Detector</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) =>
            g.bars.map((b, i) => (
              <tr key={`${g.label}-${b.name}-${i}`}>
                <td>{g.label || title}</td>
                <td>{b.name}</td>
                <td>{b.text}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

export function SeriesKey() {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-night-600">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-night-300" />
        Keyword baseline (comparison only, not in the app)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-dusk-700" />
        Vigil: live LLM detector (v3)
      </span>
    </p>
  );
}
