import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { ChannelChip, Confidence, SeverityBadge } from "@/components/Badges";
import { ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import RewriteDrawer from "@/components/RewriteDrawer";
import { COPY, SHOW_REWRITE, SHOW_RULE_REFS } from "@/lib/copy";
import { loadFlag, loadSessionDecisions } from "@/lib/data";
import { quoted, splitOnSpan } from "@/lib/highlight";
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
      <Link to={inboxPath} className="text-sm text-slate-600 hover:text-slate-900">
        ← {COPY.backToInbox}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SeverityBadge category={flag.category} />
        <h1 className="text-xl font-semibold tracking-tight">{categoryLabel(flag.category)}</h1>
        <span className="text-sm text-slate-500">· {COPY.issueCount(1)}</span>
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
  const markRef = useRef(null);
  const parts = splitOnSpan(page.markdown ?? "", span);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [page.id, span]);

  return (
    <section aria-label={COPY.pageTextLabel} className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm">
        <span className="font-medium">{pageTitle(page)}</span>
        <ChannelChip channel={page.channel} />
      </div>
      {!parts.found && (
        <div className="border-b border-slate-200 p-4">
          <blockquote className="border-l-2 border-amber-400 pl-3 text-sm">{quoted(span)}</blockquote>
          <p className="mt-2 text-xs text-slate-500">{COPY.quoteNotLocated}</p>
        </div>
      )}
      <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words p-4 font-serif text-[15px] leading-relaxed text-slate-800">
        {parts.found ? (
          <>
            {parts.before}
            <mark ref={markRef} data-testid="span-highlight" className="rounded bg-amber-200 px-0.5 text-slate-900">
              {parts.match}
            </mark>
            {parts.after}
          </>
        ) : (
          parts.text
        )}
      </div>
    </section>
  );
}

function EvidencePanel({ flag, page }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COPY.quoteLabel}</h2>
        <blockquote className="mt-1 border-l-2 border-amber-400 pl-3">{quoted(flag.span)}</blockquote>
      </div>
      {flag.why && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COPY.whyLabel}</h2>
          <p className="mt-1">{flag.why}</p>
        </div>
      )}
      <Confidence value={flag.confidence} />
      {SHOW_RULE_REFS && flag.rule && (
        <p>
          <span className="text-slate-500">{COPY.ruleLabel}: </span>Rule {flag.rule}
        </p>
      )}
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
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
      </dl>
    </section>
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
        className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500"
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
        className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 hover:border-slate-400"
      >
        <img
          src={src}
          alt={`Screenshot of ${page.url}`}
          data-testid="screenshot"
          onError={() => setFailed(true)}
          className="block w-full"
        />
      </div>
      <span className="mt-1 block text-xs text-slate-500">{COPY.openScreenshot}</span>
    </a>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
