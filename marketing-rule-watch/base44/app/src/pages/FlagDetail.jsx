import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { ChannelChip, Confidence, SeverityBadge } from "@/components/Badges";
import { ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { base44 } from "@/api/base44Client";
import RewriteDrawer from "@/components/RewriteDrawer";
import { COPY, SHOW_PAGE_VIEW, SHOW_RECHECK, SHOW_REWRITE, SHOW_RULE_REFS } from "@/lib/copy";
import { loadFlag, loadSessionDecisions } from "@/lib/data";
import { quoted, splitOnSpan } from "@/lib/highlight";
import { HIT_ID, prepareCapture } from "@/lib/capturedPage";
import { parseMarkdown } from "@/lib/markdown";
import { categoryLabel } from "@/lib/severity";
import { pageTitle, useAsync } from "@/lib/useAsync";

export default function FlagDetail() {
  const { id } = useParams();
  const { status, data, reload } = useAsync(() => loadFlag(id), [id]);
  return (
    <Shell demo={data?.firm?.is_demo}>
      {status === "loading" && <LoadingBlock rows={3} />}
      {status === "error" && <ErrorBlock message={COPY.notFound} onRetry={reload} />}
      {status === "ready" && <FlagDetailBody {...data} />}
    </Shell>
  );
}

function FlagDetailBody({ flag, page, firm }) {
  const inboxPath = firm.is_demo ? "/demo" : `/firm/${firm.id}`;
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    if (!SHOW_REWRITE) return;
    loadSessionDecisions()
      .then((latestByFlag) => setDecision(latestByFlag[flag.id] ?? null))
      // A missing badge is harmless; the drawer still works without past decisions.
      .catch((error) => console.warn("Session decisions unavailable:", error?.message ?? error));
  }, [flag.id]);
  return (
    <>
      <Link to={inboxPath} className="text-sm text-night-600 hover:text-night-950">
        ← {COPY.backToInbox}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SeverityBadge category={flag.category} />
        <h1 className="text-xl font-semibold tracking-tight">{categoryLabel(flag.category)}</h1>
        <span className="text-sm text-night-600">· {COPY.issueCount(1)}</span>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PageText page={page} span={flag.span} />
          {SHOW_REWRITE && (
            <div className="mt-6">
              <RewriteDrawer flag={flag} decision={decision} onDecided={setDecision} />
            </div>
          )}
        </div>
        <aside className="space-y-4 lg:col-span-2">
          <EvidencePanel flag={flag} page={page} />
          <Screenshot page={page} />
        </aside>
      </div>
    </>
  );
}

function PageText({ page, span }) {
  const [tab, setTab] = useState("text");
  const [note, setNote] = useState(null);

  useEffect(() => {
    setTab("text");
    setNote(null);
  }, [page.id]);

  const fallBackToText = (message) => {
    setTab("text");
    setNote(message);
  };

  return (
    <section aria-label={COPY.pageTextLabel} className="rounded-lg border border-paper-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-200 px-4 py-2 text-sm">
        <span className="font-medium">{pageTitle(page)}</span>
        <ChannelChip channel={page.channel} />
        {SHOW_PAGE_VIEW && (
          <div role="tablist" aria-label={COPY.pageTextLabel} className="ml-auto flex gap-1">
            {[
              ["text", COPY.tabText],
              ["captured", COPY.tabCaptured],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setNote(null);
                  setTab(key);
                }}
                className={`rounded px-2 py-1 text-xs ${tab === key ? "bg-night-950 text-paper-50" : "text-night-600 hover:bg-paper-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {note && (
        <p role="status" data-testid="capture-note" className="border-b border-paper-200 bg-paper-50 px-4 py-2 text-xs text-night-600">
          {note}
        </p>
      )}
      {tab === "captured" ? (
        <CapturedView page={page} span={span} onUnavailable={fallBackToText} />
      ) : (
        <TextView page={page} span={span} />
      )}
    </section>
  );
}

// Per page id for this page session, so switching tabs never refetches.
const captureCache = new Map();

async function fetchCapture(pageId) {
  if (captureCache.has(pageId)) return captureCache.get(pageId);
  let result;
  try {
    const res = await base44.functions.invoke("page-html", { page_id: pageId });
    result = res.data?.html ? { status: "ready", ...res.data } : { status: "unavailable", message: COPY.captureMissing };
  } catch (error) {
    const httpStatus = error?.response?.status;
    console.warn("Captured page unavailable:", httpStatus, error?.response?.data?.error ?? error?.message);
    const message =
      httpStatus === 404 ? COPY.captureMissing : httpStatus === 413 ? COPY.captureTooLarge : COPY.captureFailed;
    result = { status: "unavailable", message };
  }
  captureCache.set(pageId, result);
  return result;
}

function CapturedView({ page, span, onUnavailable }) {
  const [capture, setCapture] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCapture(page.id).then((result) => {
      if (cancelled) return;
      if (result.status !== "ready") onUnavailable(result.message);
      else setCapture(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // The span is marked before the page is shown: the sandboxed frame is opaque to us, so it is opened
  // at "#mrw-hit" and the browser scrolls to the mark itself. A blob URL (unlike srcdoc) can carry that fragment.
  const prepared = useMemo(
    () => (capture.status === "ready" ? prepareCapture(capture.html, capture.url || page.url, span) : null),
    [capture, page.url, span],
  );
  const frameUrl = useMemo(
    () => (prepared?.found ? URL.createObjectURL(new Blob([prepared.html], { type: "text/html" })) : null),
    [prepared],
  );

  useEffect(() => {
    if (prepared && !prepared.found) onUnavailable(COPY.captureSpanMissing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  useEffect(() => () => frameUrl && URL.revokeObjectURL(frameUrl), [frameUrl]);

  if (!frameUrl) return <div aria-busy="true" className="m-4 h-64 animate-pulse rounded bg-paper-200" />;
  return (
    <div>
      <iframe
        title={COPY.tabCaptured}
        data-testid="capture-frame"
        sandbox=""
        referrerPolicy="no-referrer"
        src={`${frameUrl}#${HIT_ID}`}
        className="block h-[60vh] w-full bg-white"
      />
      <p className="border-t border-paper-200 px-4 py-2 text-xs text-night-600">
        {COPY.capturedCaption(formatDate(capture.fetched_at ?? page.fetched_at))}
      </p>
    </div>
  );
}

function TextView({ page, span }) {
  const markRef = useRef(null);
  const boxRef = useRef(null);
  const markdown = page.markdown ?? "";
  const model = useMemo(() => parseMarkdown(markdown, span), [markdown, span]);
  // The formatted view is used only when it actually shows the highlighted words; otherwise raw text.
  const formatted = model.found && model.highlighted > 0;
  const parts = formatted ? null : splitOnSpan(markdown, span);

  useEffect(() => {
    // Scroll only the text box, never the window: scrollIntoView also moved the page, which hid the
    // title and parked the drawer buttons under Base44's fixed badge on phones.
    const mark = markRef.current;
    const box = boxRef.current;
    if (!mark || !box) return;
    const offset = mark.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTop += offset - (box.clientHeight - mark.offsetHeight) / 2;
  }, [page.id, span]);

  // PageText draws the card and the title bar; this is only the body.
  return (
    <>
      {!formatted && !parts.found && (
        <div className="border-b border-paper-200 p-4">
          <blockquote className="rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono text-sm">{quoted(span)}</blockquote>
          <p className="mt-2 text-xs text-night-600">{COPY.quoteNotLocated}</p>
        </div>
      )}
      {formatted ? (
        <div ref={boxRef} data-testid="page-formatted" className="max-h-[60vh] overflow-y-auto break-words p-4 font-serif text-[15px] leading-relaxed text-night-800">
          <MarkdownBlocks blocks={model.blocks} markRef={markRef} />
        </div>
      ) : (
        <div ref={boxRef} className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words p-4 font-serif text-[15px] leading-relaxed text-night-800">
          {parts.found ? (
            <>
              {parts.before}
              <mark ref={markRef} data-testid="span-highlight" className="rounded bg-lamp-100 shadow-[inset_0_-2px_0_#F5A524] px-0.5 text-night-950">
                {parts.match}
              </mark>
              {parts.after}
            </>
          ) : (
            parts.text
          )}
        </div>
      )}
    </>
  );
}

const HEADING_CLASSES = {
  1: "text-xl font-semibold",
  2: "text-lg font-semibold",
  3: "text-base font-semibold",
};

// Renders the parsed page. The first highlighted run gets the ref (for scrolling) and the test id;
// a span crossing formatting is split into several <mark>s that read as one highlight.
function MarkdownBlocks({ blocks, markRef }) {
  let firstMark = true;
  const renderRuns = (runs) =>
    runs.map((run, i) => {
      let node = run.text;
      if (run.code) node = <code className="rounded bg-paper-100 px-1 font-mono text-[13px]">{node}</code>;
      if (run.link) node = <span className="underline decoration-night-300">{node}</span>;
      if (run.italic) node = <em>{node}</em>;
      if (run.bold) node = <strong>{node}</strong>;
      if (run.mark) {
        const isFirst = firstMark;
        firstMark = false;
        node = (
          <mark
            ref={isFirst ? markRef : undefined}
            data-testid={isFirst ? "span-highlight" : "span-highlight-part"}
            className="bg-lamp-100 shadow-[inset_0_-2px_0_#F5A524] text-night-950"
          >
            {node}
          </mark>
        );
      }
      return <Fragment key={i}>{node}</Fragment>;
    });

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h":
            return (
              <p key={i} role="heading" aria-level={block.level} className={`font-sans ${HEADING_CLASSES[block.level] ?? "text-sm font-semibold"}`}>
                {renderRuns(block.runs)}
              </p>
            );
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={i} className={`space-y-1 pl-6 ${block.type === "ul" ? "list-disc" : "list-decimal"}`}>
                {block.items.map((item, k) => (
                  <li key={k}>{renderRuns(item)}</li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-night-200 pl-3 text-night-700">
                {renderRuns(block.runs)}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-paper-200" />;
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse font-sans text-sm">
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-paper-200">
                        {row.map((cell, c) => {
                          const Cell = block.header && r === 0 ? "th" : "td";
                          return (
                            <Cell key={c} className={`px-2 py-1 text-left align-top ${Cell === "th" ? "font-semibold" : ""}`}>
                              {renderRuns(cell)}
                            </Cell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={i}>{renderRuns(block.runs)}</p>;
        }
      })}
    </div>
  );
}

function EvidencePanel({ flag, page }) {
  return (
    <section className="space-y-3 rounded-lg border border-paper-200 bg-white p-4 text-sm">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.quoteLabel}</h2>
        <blockquote className="mt-1 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono">{quoted(flag.span)}</blockquote>
      </div>
      {flag.why && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.whyLabel}</h2>
          <p className="mt-1">{flag.why}</p>
        </div>
      )}
      <Confidence value={flag.confidence} />
      {SHOW_RULE_REFS && flag.rule && (
        <p>
          <span className="text-night-600">{COPY.ruleLabel}: </span>Rule {flag.rule}
        </p>
      )}
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-night-600">
        <dt>{COPY.sourceLabel}</dt>
        <dd className="break-all">
          <a href={page.url} target="_blank" rel="noreferrer noopener" className="underline">
            {page.url}
          </a>
        </dd>
        {page.fetched_at && (
          <>
            <dt>{COPY.fetchedLabel}</dt>
            <dd>{formatDate(page.fetched_at)}</dd>
          </>
        )}
        {page.sha256 && (
          <>
            <dt title={COPY.hashHelp}>{COPY.hashLabel}</dt>
            <dd className="font-mono" title={`${page.sha256}\n${COPY.hashHelp}`} data-testid="page-hash">
              {page.sha256.slice(0, 16)}…
            </dd>
          </>
        )}
      </dl>
      {SHOW_RECHECK && <Recheck flagId={flag.id} />}
    </section>
  );
}

// One live fetch per click (backend: functions/recheck, admin only, no retry). Nothing is stored.
function Recheck({ flagId }) {
  const [state, setState] = useState({ status: "idle" });
  const run = async () => {
    setState({ status: "loading" });
    try {
      const res = await base44.functions.invoke("recheck", { flag_id: flagId });
      setState({ status: "done", result: res.data });
    } catch (e) {
      setState({ status: e?.response?.status === 401 ? "admin" : "error" });
    }
  };
  const r = state.result;
  return (
    <div className="space-y-1 text-xs" data-testid="recheck">
      <button
        type="button"
        onClick={run}
        disabled={state.status === "loading"}
        className="rounded-md border border-night-200 px-2 py-1 text-night-700 hover:bg-paper-100 disabled:opacity-60"
      >
        {state.status === "loading" ? COPY.rechecking : COPY.recheck}
      </button>
      {state.status === "done" && r && !r.error && (
        <p role="status" className="text-night-700">
          {COPY.recheckQuote(r.quote_present)} {COPY.recheckText(r.unchanged)} ({formatDate(r.checked_at)})
        </p>
      )}
      {state.status === "admin" && <p role="status" className="text-night-600">{COPY.recheckAdminOnly}</p>}
      {(state.status === "error" || (state.status === "done" && (!r || r.error))) && (
        <p role="status" className="text-night-600">{COPY.recheckFailed}</p>
      )}
    </div>
  );
}

// Never render a broken image: no ref, or a ref that fails to load, shows the placeholder.
function Screenshot({ page }) {
  const [failed, setFailed] = useState(false);
  const src = page.screenshot_ref;
  if (!src || failed) {
    return (
      <div
        data-testid="screenshot-placeholder"
        className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-night-200 bg-paper-100 text-sm text-night-600"
      >
        {COPY.screenshotUnavailable}
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer noopener" title={COPY.openScreenshot} className="block">
      {/* Full-page captures can be thousands of pixels tall; scroll inside the panel instead of stretching the page. */}
      <div
        data-testid="screenshot-frame"
        className="max-h-[60vh] min-h-[120px] overflow-y-auto rounded-lg border border-paper-200 bg-paper-100 hover:border-night-300"
      >
        <img
          src={src}
          alt={`Screenshot of ${page.url}`}
          data-testid="screenshot"
          onError={() => setFailed(true)}
          className="block w-full"
        />
      </div>
      <span className="mt-1 block text-xs text-night-600">{COPY.openScreenshot}</span>
    </a>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
