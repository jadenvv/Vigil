// Hypothesis 2 (firms can't prove what a page said on a past date): every stored capture of one URL,
// a diff against the capture before it, and an as-of date picker. Reads stored Page rows only.
import { useMemo, useState } from "react";
import { ChannelChip } from "@/components/Badges";
import { ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { loadPageHistory } from "@/lib/data";
import { Link, useParams } from "@/lib/router";
import { asOf, lineDiff, versions } from "@/lib/snapshots";
import { pageTitle, useAsync } from "@/lib/useAsync";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// A date input gives a local calendar day; the capture live then is the latest one by the end of that day.
function asOfDay(captures, value) {
  const [y, m, d] = value.split("-").map(Number);
  return asOf(captures, new Date(y, m - 1, d, 23, 59, 59, 999));
}

export default function History() {
  const { id } = useParams();
  const { status, data, reload } = useAsync(() => loadPageHistory(id), [id]);
  return (
    <Shell demo={data?.firm?.is_demo}>
      {status === "loading" && <LoadingBlock rows={3} />}
      {status === "error" && <ErrorBlock message={COPY.notFound} onRetry={reload} />}
      {status === "ready" && <HistoryBody {...data} />}
    </Shell>
  );
}

function HistoryBody({ page, firm, captures }) {
  const list = useMemo(() => versions(captures), [captures]);
  const [selectedId, setSelectedId] = useState(page.id);
  const [day, setDay] = useState("");
  const backPath = new URLSearchParams(window.location.search).get("from");
  const inboxPath = firm.is_demo ? "/demo" : `/firm/${firm.id}`;

  // undefined: no date picked; null: nothing captured by then.
  const dayMatch = day ? asOfDay(captures, day) : undefined;

  const pick = (value) => {
    setDay(value);
    if (value) setSelectedId((asOfDay(captures, value) ?? list[0].page).id);
  };

  const index = Math.max(0, list.findIndex((v) => v.page.id === selectedId));
  const selected = list[index];
  const previous = index > 0 ? list[index - 1] : null;

  return (
    <>
      <Link to={backPath?.startsWith("/flag/") ? backPath : inboxPath} className="text-sm text-night-600 hover:text-night-950">
        ← {backPath?.startsWith("/flag/") ? COPY.historyBack : COPY.backToInbox}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {COPY.historyTitle}: {pageTitle(page)}
        </h1>
        <ChannelChip channel={page.channel} />
      </div>
      <p className="mt-1 break-all text-xs text-night-600">{page.url}</p>
      <p className="mt-2 text-sm text-night-600">
        {COPY.historyIntro} {COPY.historyCount(list.length)}.
      </p>

      <div className="mt-4 rounded-lg border border-paper-200 bg-white p-4 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{COPY.historyAsOfLabel}</span>
          <input
            type="date"
            value={day}
            onChange={(e) => pick(e.target.value)}
            data-testid="history-asof"
            className="rounded-md border border-night-200 px-2 py-1 font-mono text-sm"
          />
        </label>
        <p className="mt-1 text-xs text-night-600">{COPY.historyAsOfHelp}</p>
        {dayMatch !== undefined && (
          <p role="status" data-testid="history-asof-result" className="mt-2 text-night-800">
            {dayMatch ? COPY.historyAsOfFound(formatDate(dayMatch.fetched_at)) : COPY.historyAsOfNone}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <ol className="space-y-2 lg:col-span-2" aria-label={COPY.historyTitle}>
          {[...list].reverse().map((v) => {
            const active = v.page.id === selected.page.id;
            return (
              <li key={v.page.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(v.page.id)}
                  aria-current={active ? "true" : undefined}
                  data-testid="history-item"
                  className={`block w-full rounded-lg border p-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500 ${
                    active ? "border-night-950 bg-white" : "border-paper-200 bg-white hover:border-night-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatDate(v.page.fetched_at)}</span>
                    {v === list[list.length - 1] && (
                      <span className="rounded-full bg-night-950 px-2 py-0.5 text-xs text-paper-50">{COPY.historyLatest}</span>
                    )}
                    <ChangeBadge version={v} />
                  </div>
                  <span className="mt-1 block font-mono text-xs text-night-600" title={v.page.sha256}>
                    {COPY.hashLabel} {(v.page.sha256 || "").slice(0, 12) || "–"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-lg border border-paper-200 bg-white" data-testid="history-diff">
            <h2 className="border-b border-paper-200 px-4 py-2 text-sm font-medium">{COPY.historyDiffTitle}</h2>
            <Diff previous={previous} current={selected} />
          </section>
          <section className="rounded-lg border border-paper-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-paper-200 px-4 py-2 text-sm">
              <h2 className="font-medium">{COPY.historyTextTitle}</h2>
              <span className="text-xs text-night-600">{formatDate(selected.page.fetched_at)}</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words p-4 font-serif text-[15px] leading-relaxed text-night-800">
              {selected.page.markdown}
            </div>
          </section>
          <CaptureScreenshot page={selected.page} />
        </div>
      </div>
    </>
  );
}

function ChangeBadge({ version }) {
  if (version.isFirst) return <span className="rounded-full bg-dusk-100 px-2 py-0.5 text-xs text-dusk-700">{COPY.historyFirst}</span>;
  if (version.changed) return <span className="rounded-full bg-lamp-100 px-2 py-0.5 text-xs text-lamp-700">{COPY.historyChanged}</span>;
  return <span className="rounded-full border border-night-200 px-2 py-0.5 text-xs text-night-600">{COPY.historyUnchanged}</span>;
}

function Diff({ previous, current }) {
  const hunks = useMemo(
    () => (previous && current.changed ? lineDiff(previous.page.markdown, current.page.markdown) : []),
    [previous, current],
  );
  if (!previous) return <p className="px-4 py-3 text-sm text-night-600">{COPY.historyDiffFirst}</p>;
  if (!hunks.length) return <p className="px-4 py-3 text-sm text-night-600">{COPY.historyDiffNone}</p>;
  const style = { add: "bg-sage-100 text-sage-700", del: "bg-ember-100 text-ember-700 line-through decoration-ember-600/40", same: "text-night-600" };
  const sign = { add: "+", del: "−", same: " " };
  return (
    <div className="max-h-[50vh] overflow-y-auto p-2 font-mono text-xs">
      {hunks.map((hunk, h) => (
        <div key={h} className={h > 0 ? "mt-2 border-t border-dashed border-paper-200 pt-2" : ""}>
          {hunk.map((line, k) => (
            <div key={k} data-diff={line.type} className={`whitespace-pre-wrap break-words px-2 py-0.5 ${style[line.type]}`}>
              <span aria-hidden="true" className="mr-2 select-none">{sign[line.type]}</span>
              {line.text || " "}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CaptureScreenshot({ page }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = page.screenshot_ref;
  if (!src || failedSrc === src) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-night-200 bg-paper-100 text-sm text-night-600">
        {COPY.screenshotUnavailable}
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer noopener" title={COPY.openScreenshot} className="block">
      <div className="max-h-[60vh] min-h-[120px] overflow-y-auto rounded-lg border border-paper-200 bg-paper-100 hover:border-night-300">
        <img src={src} alt={`Screenshot of ${page.url}`} onError={() => setFailedSrc(src)} className="block w-full" />
      </div>
      <span className="mt-1 block text-xs text-night-600">{COPY.openScreenshot}</span>
    </a>
  );
}
