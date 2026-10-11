import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ErrorBlock, Shell } from "@/components/Chrome";
import { appParams } from "@/lib/app-params";
import { CHANNEL_LABELS } from "@/lib/copy";
import { Link } from "@/lib/router";
import { CATEGORY_SEVERITY, SEVERITY_LABELS, categoryLabel, severityOf } from "@/lib/severity";
import { latestPerUrl } from "@/lib/snapshots";
import { useAsync } from "@/lib/useAsync";

// Strings live here (not copy.ts) to avoid merge conflicts with other sessions.
const T = {
  title: "Dashboard",
  subtitle: "Every firm and page Vigil has checked.",
  adminNote: "Admin view: includes non-demo firms",
  loadError: "We couldn't load the dashboard. Check your connection and try again.",
  empty: "No firms checked yet.",
  allFirms: "All firms",
  firmLabel: "Firm",
  filteredBy: "Filtered by:",
  clearFilter: "Clear filter",
  kpiFirms: "Firms",
  kpiPages: "Pages captured",
  kpiOpen: "Potential issues open",
  kpiShare: "Pages with a potential issue",
  kpiLast: "Last capture",
  tableTitle: "Firms",
  byCategory: "Potential issues by category",
  bySeverity: "Potential issues by severity, per firm",
  byChannel: "Pages by channel",
  byStatus: "Review status",
  noData: "Nothing to show for this filter.",
};

const SEVERITIES = ["high", "medium", "low"];
// Same hues as SeverityBadge in Badges.jsx (ember / lamp / dusk).
const SEVERITY_FILL = { high: "fill-ember-600", medium: "fill-lamp-500", low: "fill-dusk-500" };
const SEVERITY_DOT = { high: "bg-ember-600", medium: "bg-lamp-500", low: "bg-dusk-500" };
const CHANNELS = ["website", "blog", "linkedin", "review_site", "press", "other"];
const STATUSES = [
  { key: "open", label: "Open" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Dismissed" },
];

const MOTION_CSS = `
.vg-grow-x { transform-box: fill-box; transform-origin: left center; animation: vg-grow-x 500ms ease-out both; }
@keyframes vg-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .vg-grow-x { animation: none; } }
`;

async function loadDashboard() {
  const [firms, pages, flags] = await Promise.all([
    base44.entities.Firm.list("-created_date", 200),
    base44.entities.Page.list("-fetched_at", 1000),
    base44.entities.Flag.list("-created_date", 1000),
  ]);
  return { firms, pages, flags };
}

// Mirrors FlagDetail.jsx: no token means nobody is signed in, so skip the lookup (and the 401).
function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!appParams.token) return;
    base44.auth
      .me()
      .then((user) => setIsAdmin(user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);
  return isAdmin;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 600);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function captureTime(page) {
  const t = Date.parse(page.fetched_at ?? page.created_date ?? "");
  return Number.isNaN(t) ? 0 : t;
}

function formatTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function siteOf(firm) {
  return firm.domain || "—";
}

export default function Dashboard() {
  const { status, data, reload } = useAsync(loadDashboard, []);
  const isAdmin = useIsAdmin();
  return (
    <Shell>
      <style>{MOTION_CSS}</style>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{T.title}</h1>
        <p className="mt-1 text-night-600">{T.subtitle}</p>
      </div>
      {status === "loading" && <DashboardSkeleton />}
      {status === "error" && <ErrorBlock message={T.loadError} onRetry={reload} />}
      {status === "ready" && <DashboardBody data={data} isAdmin={isAdmin} />}
    </Shell>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-paper-200" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-paper-200" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg bg-paper-200" />
        ))}
      </div>
    </div>
  );
}

function DashboardBody({ data, isAdmin }) {
  const [firmId, setFirmId] = useState("all");
  const [filter, setFilter] = useState(null); // {type: "category"|"channel", key}

  // Privacy gate: the public sees only the fictional demo firm(s). Only an admin sees real test-scanned firms.
  const visibleFirms = useMemo(
    () => data.firms.filter((f) => isAdmin || f.is_demo === true).sort((a, b) => a.name.localeCompare(b.name)),
    [data.firms, isAdmin],
  );
  const firmById = useMemo(() => new Map(visibleFirms.map((f) => [f.id, f])), [visibleFirms]);

  // Latest capture per URL per firm, for visible firms only. Flags are matched to those pages.
  const base = useMemo(() => {
    const byFirm = new Map();
    for (const page of data.pages) {
      if (!firmById.has(page.firm_id)) continue;
      if (!byFirm.has(page.firm_id)) byFirm.set(page.firm_id, []);
      byFirm.get(page.firm_id).push(page);
    }
    const pages = [...byFirm.values()].flatMap((list) => latestPerUrl(list));
    const pageById = new Map(pages.map((p) => [p.id, p]));
    const flags = data.flags.filter((f) => pageById.has(f.page_id));
    return { pages, pageById, flags };
  }, [data, firmById]);

  const effectiveFirm = firmById.has(firmId) ? firmId : "all";

  // Firm + channel scope the pages; category scopes the flags.
  const scoped = useMemo(() => {
    const pages = base.pages.filter(
      (p) =>
        (effectiveFirm === "all" || p.firm_id === effectiveFirm) &&
        (filter?.type !== "channel" || (p.channel || "other") === filter.key),
    );
    const pageIds = new Set(pages.map((p) => p.id));
    const flags = base.flags.filter(
      (f) => pageIds.has(f.page_id) && (filter?.type !== "category" || f.category === filter.key),
    );
    return { pages, flags };
  }, [base, effectiveFirm, filter]);

  // For the category / channel charts, ignore their own filter so the other bars stay clickable.
  const forCategoryChart = useMemo(() => {
    if (filter?.type !== "category") return scoped.flags;
    const pageIds = new Set(scoped.pages.map((p) => p.id));
    return base.flags.filter((f) => pageIds.has(f.page_id));
  }, [base, scoped, filter]);
  const forChannelChart = useMemo(() => {
    if (filter?.type !== "channel") return scoped.pages;
    return base.pages.filter((p) => effectiveFirm === "all" || p.firm_id === effectiveFirm);
  }, [base, scoped, filter, effectiveFirm]);

  const firmRows = useMemo(() => {
    const rows = [];
    for (const firm of visibleFirms) {
      if (effectiveFirm !== "all" && firm.id !== effectiveFirm) continue;
      const pages = scoped.pages.filter((p) => p.firm_id === firm.id);
      const pageIds = new Set(pages.map((p) => p.id));
      const flags = scoped.flags.filter((f) => pageIds.has(f.page_id));
      const sev = { high: 0, medium: 0, low: 0 };
      for (const f of flags) sev[severityOf(f.category)] += 1;
      const channels = [...new Set(pages.map((p) => p.channel || "other"))];
      const last = pages.reduce((m, p) => Math.max(m, captureTime(p)), 0);
      rows.push({ firm, pages: pages.length, issues: flags.length, sev, channels, last });
    }
    return rows;
  }, [visibleFirms, scoped, effectiveFirm]);

  if (visibleFirms.length === 0) {
    return (
      <div className="rounded-lg border border-paper-200 bg-white p-8 text-center">
        <p className="font-medium">{T.empty}</p>
      </div>
    );
  }

  const openFlags = scoped.flags.filter((f) => (f.status || "open") === "open").length;
  const pagesWithIssue = new Set(scoped.flags.map((f) => f.page_id)).size;
  const share = scoped.pages.length ? Math.round((pagesWithIssue / scoped.pages.length) * 100) : 0;
  const lastCapture = scoped.pages.reduce((m, p) => Math.max(m, captureTime(p)), 0);
  const firmCount = firmRows.filter((r) => !filter || r.pages > 0).length;

  const categoryRows = Object.keys(CATEGORY_SEVERITY)
    .map((key) => ({
      key,
      label: categoryLabel(key),
      value: forCategoryChart.filter((f) => f.category === key).length,
      fill: SEVERITY_FILL[severityOf(key)],
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const channelRows = CHANNELS.map((key) => ({
    key,
    label: CHANNEL_LABELS[key] ?? key,
    value: forChannelChart.filter((p) => (p.channel || "other") === key).length,
    fill: "fill-night-600",
  })).filter((r) => r.value > 0 || r.key !== "linkedin");
  const statusRows = STATUSES.map(({ key, label }) => ({
    key,
    label,
    value: scoped.flags.filter((f) => (f.status || "open") === key).length,
    fill: key === "open" ? "fill-lamp-500" : key === "approved" ? "fill-sage-500" : "fill-night-300",
  }));

  const toggle = (type, key) =>
    setFilter((cur) => (cur && cur.type === type && cur.key === key ? null : { type, key }));
  const filterLabel =
    filter && (filter.type === "category" ? categoryLabel(filter.key) : CHANNEL_LABELS[filter.key] ?? filter.key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-night-600">
          {T.firmLabel}
          <select
            value={effectiveFirm}
            onChange={(e) => setFirmId(e.target.value)}
            className="max-w-[16rem] rounded-md border border-night-200 bg-white px-2 py-1.5 text-sm text-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
          >
            <option value="all">{T.allFirms}</option>
            {visibleFirms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        {filter && (
          <span className="inline-flex items-center gap-1 rounded-full border border-lamp-500 bg-lamp-100 py-0.5 pl-3 pr-1 text-sm text-night-950">
            <span className="text-night-600">{T.filteredBy}</span> {filterLabel}
            <button
              type="button"
              onClick={() => setFilter(null)}
              aria-label={`${T.clearFilter}: ${filterLabel}`}
              className="ml-1 rounded-full px-1.5 leading-5 text-night-600 hover:bg-lamp-300 hover:text-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
            >
              ×
            </button>
          </span>
        )}
        {isAdmin && (
          <span role="note" className="ml-auto rounded-full bg-dusk-100 px-3 py-0.5 text-xs font-medium text-dusk-700">
            {T.adminNote}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={T.kpiFirms} value={firmCount} />
        <Kpi label={T.kpiPages} value={scoped.pages.length} />
        <Kpi label={T.kpiOpen} value={openFlags} accent={openFlags > 0} />
        <Kpi label={T.kpiShare} value={share} suffix="%" />
        <Kpi label={T.kpiLast} text={formatTime(lastCapture)} />
      </dl>

      <FirmsTable rows={firmRows} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={T.byCategory}>
          <BarChart
            id="cat"
            title={T.byCategory}
            unit="potential issue"
            rows={categoryRows}
            activeKey={filter?.type === "category" ? filter.key : null}
            onSelect={(key) => toggle("category", key)}
            legend
          />
        </Card>
        <Card title={T.bySeverity}>
          <StackedChart rows={firmRows} />
        </Card>
        <Card title={T.byChannel}>
          <BarChart
            id="chan"
            title={T.byChannel}
            unit="page"
            rows={channelRows}
            activeKey={filter?.type === "channel" ? filter.key : null}
            onSelect={(key) => toggle("channel", key)}
          />
        </Card>
        <Card title={T.byStatus}>
          <BarChart id="status" title={T.byStatus} unit="potential issue" rows={statusRows} />
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value = 0, suffix = "", text, accent = false }) {
  const shown = useCountUp(text ? 0 : value);
  return (
    <div className={`rounded-lg border bg-white p-3 ${accent ? "border-lamp-500" : "border-paper-200"}`}>
      <dt className="text-xs text-night-600">{label}</dt>
      <dd className={`mt-1 font-mono tabular-nums text-night-950 ${text ? "text-sm leading-7" : "text-2xl"}`}>
        {text ?? `${shown}${suffix}`}
      </dd>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-paper-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-night-950">{title}</h2>
      {children}
    </section>
  );
}

const COLUMNS = [
  { key: "name", label: "Firm", get: (r) => r.firm.name.toLowerCase() },
  { key: "site", label: "Site", get: (r) => siteOf(r.firm).toLowerCase() },
  { key: "pages", label: "Pages", get: (r) => r.pages, num: true },
  { key: "issues", label: "Potential issues", get: (r) => r.sev.high * 1e6 + r.sev.medium * 1e3 + r.sev.low, num: true },
  { key: "channels", label: "Channels", get: (r) => r.channels.length, num: true },
  { key: "last", label: "Last captured", get: (r) => r.last, num: true },
];

function FirmsTable({ rows }) {
  const [sort, setSort] = useState({ key: "issues", dir: "desc" });
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const out = [...rows].sort((a, b) => {
      const x = col.get(a);
      const y = col.get(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return sort.dir === "desc" ? out.reverse() : out;
  }, [rows, sort]);

  const onSort = (key) =>
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: COLUMNS.find((c) => c.key === key).num ? "desc" : "asc" },
    );

  return (
    <section className="rounded-lg border border-paper-200 bg-white">
      <h2 className="px-4 pt-4 text-sm font-semibold text-night-950">{T.tableTitle}</h2>
      {/* relative: keeps the absolutely positioned sr-only labels inside the scroll box, not the page. */}
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-paper-200 text-xs text-night-600">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="whitespace-nowrap px-4 py-2 font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className="inline-flex items-center gap-1 rounded hover:text-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
                    >
                      {c.label}
                      <span aria-hidden="true" className={active ? "text-night-950" : "text-night-200"}>
                        {active && sort.dir === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const to = r.firm.is_demo ? "/demo" : `/firm/${r.firm.id}`;
              return (
                <tr key={r.firm.id} className="border-b border-paper-100 last:border-0 hover:bg-paper-50">
                  <td className="px-4 py-2.5">
                    <Link
                      to={to}
                      className="font-medium text-night-950 underline decoration-night-200 underline-offset-2 hover:decoration-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
                    >
                      {r.firm.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-night-600">{siteOf(r.firm)}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{r.pages}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3 font-mono tabular-nums">
                      {SEVERITIES.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1" title={SEVERITY_LABELS[s]}>
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${SEVERITY_DOT[s]}`} />
                          <span className="sr-only">{SEVERITY_LABELS[s]}:</span>
                          {r.sev[s]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-night-600">
                    {r.channels.length ? r.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs tabular-nums text-night-600">
                    {formatTime(r.last)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

// Shared tooltip for chart bars: shown on hover and keyboard focus, positioned within the card.
function useTooltip() {
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const show = (event, text) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const box = event.currentTarget.getBoundingClientRect();
    if (!wrap) return;
    setTip({ text, x: Math.min(box.right - wrap.left, wrap.width - 8), y: box.top - wrap.top });
  };
  const node = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-night-950 px-2 py-1 font-mono text-xs tabular-nums text-paper-50 shadow"
      style={{ left: Math.max(60, tip.x), top: tip.y - 4 }}
    >
      {tip.text}
    </div>
  );
  return { wrapRef, show, hide: () => setTip(null), node };
}

const W = 400;
const LABEL_W = 0;
const BAR_MAX = 340;

function BarChart({ id, title, unit, rows, activeKey = null, onSelect, legend = false }) {
  const { wrapRef, show, hide, node } = useTooltip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowH = 36;
  const h = Math.max(rowH, rows.length * rowH);
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (rows.length === 0 || total === 0) return <p className="text-sm text-night-600">{T.noData}</p>;
  const desc = rows.map((r) => `${r.label}: ${r.value}`).join("; ");
  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${W} ${h}`} className="block h-auto w-full" role="group" aria-labelledby={`${id}-t ${id}-d`}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {rows.map((r, i) => {
          const y = i * rowH;
          const w = r.value === 0 ? 0 : Math.max(3, (r.value / max) * BAR_MAX);
          const dim = activeKey && activeKey !== r.key;
          const label = `${r.label}: ${plural(r.value, unit)}`;
          const interactive = Boolean(onSelect);
          return (
            <g
              key={r.key}
              tabIndex={0}
              role={interactive ? "button" : "img"}
              aria-label={interactive ? `${label}. ${activeKey === r.key ? "Clear filter" : "Filter by this"}` : label}
              aria-pressed={interactive ? activeKey === r.key : undefined}
              className={`outline-none [&:focus-visible_.vg-hit]:stroke-lamp-500 ${interactive ? "cursor-pointer" : ""}`}
              onMouseEnter={(e) => show(e, label)}
              onMouseLeave={hide}
              onFocus={(e) => show(e, label)}
              onBlur={hide}
              onClick={interactive ? () => onSelect(r.key) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(r.key);
                      }
                    }
                  : undefined
              }
              opacity={dim ? 0.35 : 1}
            >
              <rect className="vg-hit fill-transparent" strokeWidth="2" x={LABEL_W} y={y} width={W} height={rowH - 2} rx="4" />
              <text x={LABEL_W + 2} y={y + 12} className="fill-night-700" fontSize="11">
                {r.label}
              </text>
              <rect className={`vg-grow-x ${r.fill}`} x={LABEL_W + 2} y={y + 17} width={w} height="12" rx="2" />
              <text
                x={LABEL_W + 2 + w + 6}
                y={y + 27}
                className="fill-night-950 font-mono"
                fontSize="11"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {r.value}
              </text>
            </g>
          );
        })}
      </svg>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-night-600" aria-label="Bar colour shows severity">
          {SEVERITIES.map((s) => (
            <li key={s} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${SEVERITY_DOT[s]}`} />
              {SEVERITY_LABELS[s]}
            </li>
          ))}
        </ul>
      )}
      {node}
    </div>
  );
}

function StackedChart({ rows }) {
  const { wrapRef, show, hide, node } = useTooltip();
  const data = rows.filter((r) => r.pages > 0 || r.issues > 0);
  const max = Math.max(1, ...data.map((r) => r.issues));
  const rowH = 36;
  const h = Math.max(rowH, data.length * rowH);
  if (data.length === 0 || data.every((r) => r.issues === 0)) return <p className="text-sm text-night-600">{T.noData}</p>;
  const desc = data
    .map((r) => `${r.firm.name}: ${SEVERITIES.map((s) => `${r.sev[s]} ${SEVERITY_LABELS[s]}`).join(", ")}`)
    .join("; ");
  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${W} ${h}`} className="block h-auto w-full" role="group" aria-labelledby="sev-t sev-d">
        <title id="sev-t">{T.bySeverity}</title>
        <desc id="sev-d">{desc}</desc>
        {data.map((r, i) => {
          const y = i * rowH;
          let x = 2;
          const label = `${r.firm.name}: ${SEVERITIES.map((s) => `${SEVERITY_LABELS[s]} ${r.sev[s]}`).join(", ")}`;
          return (
            <g
              key={r.firm.id}
              tabIndex={0}
              role="img"
              aria-label={label}
              className="outline-none [&:focus-visible_.vg-hit]:stroke-lamp-500"
              onMouseEnter={(e) => show(e, label)}
              onMouseLeave={hide}
              onFocus={(e) => show(e, label)}
              onBlur={hide}
            >
              <rect className="vg-hit fill-transparent" strokeWidth="2" x="0" y={y} width={W} height={rowH - 2} rx="4" />
              <text x="2" y={y + 12} className="fill-night-700" fontSize="11">
                {r.firm.name}
              </text>
              {SEVERITIES.map((s) => {
                const w = (r.sev[s] / max) * BAR_MAX;
                const seg = (
                  <rect key={s} className={`vg-grow-x ${SEVERITY_FILL[s]}`} x={x} y={y + 17} width={w} height="12" />
                );
                x += w;
                return seg;
              })}
              <text x={x + 6} y={y + 27} className="fill-night-950 font-mono" fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
                {r.issues}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-night-600" aria-hidden="true">
        {SEVERITIES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[s]}`} />
            {SEVERITY_LABELS[s]}
          </li>
        ))}
      </ul>
      {node}
    </div>
  );
}
