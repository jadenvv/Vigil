// Check 1, Tester A (A4): examiners use what a firm publishes to ask for more. This is a printable list
// of every open flag with its exact quote and where and when it was captured. No new data.
import { SeverityBadge } from "@/components/Badges";
import { EmptyBlock, ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { loadInbox } from "@/lib/data";
import { quoted } from "@/lib/highlight";
import { Link, useParams } from "@/lib/router";
import { categoryLabel } from "@/lib/severity";
import { pageTitle, useAsync } from "@/lib/useAsync";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Exam() {
  const { id } = useParams();
  const { status, data, reload } = useAsync(() => loadInbox(id), [id]);
  return (
    <Shell demo={data?.firm?.is_demo}>
      {status === "loading" && <LoadingBlock rows={4} />}
      {status === "error" && <ErrorBlock onRetry={reload} />}
      {status === "ready" && <ExamBody {...data} />}
    </Shell>
  );
}

function ExamBody({ firm, groups, pagesScanned }) {
  const rows = groups.flatMap(({ page, flags }) =>
    flags.filter((flag) => (flag.status ?? "open") === "open").map((flag) => ({ flag, page })),
  );
  const inboxPath = firm.is_demo ? "/demo" : `/firm/${firm.id}`;
  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link to={inboxPath} className="text-sm text-slate-600 hover:text-slate-900">
          ← {COPY.backToInbox}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          {COPY.examPrint}
        </button>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {COPY.examTitle}: {firm.name}
        </h1>
        <p className="mt-1 text-slate-600" data-testid="exam-count">
          {COPY.issueCountAcross(rows.length, groups.length, pagesScanned)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {COPY.examPrepared} {formatDate(new Date().toISOString())}. {COPY.scopeNote}
        </p>
      </header>
      {rows.length === 0 ? (
        <EmptyBlock title={COPY.emptyInbox} detail={COPY.emptyInboxDetail} />
      ) : (
        <ol className="space-y-4">
          {rows.map(({ flag, page }, i) => (
            <li
              key={flag.id}
              data-testid="exam-item"
              className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4 print:border-slate-400"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{i + 1}.</span>
                <SeverityBadge category={flag.category} />
                <span className="font-medium">{categoryLabel(flag.category)}</span>
              </div>
              <blockquote className="mt-2 border-l-2 border-amber-400 pl-3">{quoted(flag.span)}</blockquote>
              {flag.why && <p className="mt-2 text-sm text-slate-700">{flag.why}</p>}
              <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
                <dt>{COPY.examPage}</dt>
                <dd>{pageTitle(page)}</dd>
                <dt>{COPY.sourceLabel}</dt>
                <dd className="break-all">{page.url}</dd>
                {page.fetched_at && (
                  <>
                    <dt>{COPY.fetchedLabel}</dt>
                    <dd>{formatDate(page.fetched_at)}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
