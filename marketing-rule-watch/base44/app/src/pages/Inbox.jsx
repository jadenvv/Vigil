import { Link, useParams } from "@/lib/router";
import { ChannelChip, Confidence, DecisionBadge, SeverityBadge } from "@/components/Badges";
import { EmptyBlock, ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { findDemoFirm, loadInbox, loadSessionDecisions } from "@/lib/data";
import { quoted, truncate } from "@/lib/highlight";
import { categoryLabel } from "@/lib/severity";
import { pageTitle, useAsync } from "@/lib/useAsync";

// Session decisions are a nicety; if they fail to load, the inbox still renders.
async function loadDecisionsQuietly() {
  try {
    return await loadSessionDecisions();
  } catch (error) {
    console.warn("Session decisions unavailable:", error?.message ?? error);
    return {};
  }
}

export function DemoInbox() {
  const result = useAsync(async () => {
    const firm = await findDemoFirm();
    if (!firm) return { missingDemoFirm: true };
    const [inbox, decisions] = await Promise.all([loadInbox(firm.id, firm), loadDecisionsQuietly()]);
    return { ...inbox, decisions };
  }, []);
  return <InboxView result={result} demo />;
}

export function FirmInbox() {
  const { id } = useParams();
  const result = useAsync(async () => {
    const [inbox, decisions] = await Promise.all([loadInbox(id), loadDecisionsQuietly()]);
    return { ...inbox, decisions };
  }, [id]);
  return <InboxView result={result} demo={result.data?.firm?.is_demo} />;
}

function InboxView({ result, demo }) {
  const { status, data, reload } = result;
  return (
    <Shell demo={demo}>
      {status === "loading" && <LoadingBlock rows={4} />}
      {status === "error" && <ErrorBlock onRetry={reload} />}
      {status === "ready" && data.missingDemoFirm && <EmptyBlock title={COPY.noDemoFirm} />}
      {status === "ready" && !data.missingDemoFirm && <InboxBody {...data} />}
    </Shell>
  );
}

function InboxBody({ firm, groups, flagCount, pagesScanned, decisions }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{firm.name}</h1>
        <p className="mt-1 text-slate-600" data-testid="issue-count">
          {COPY.issueCountAcross(flagCount, groups.length, pagesScanned)}
        </p>
        <p data-testid="scope-note" className="mt-1 text-sm text-slate-500">
          {COPY.scopeNote}
        </p>
        <Link to={`/firm/${firm.id}/exam`} data-testid="exam-link" className="mt-2 inline-block text-sm underline">
          {COPY.examLink}
        </Link>
      </div>
      {groups.length === 0 ? (
        <EmptyBlock title={COPY.emptyInbox} detail={COPY.emptyInboxDetail} />
      ) : (
        <div className="space-y-8">
          {groups.map(({ page, flags }) => (
            <section key={page.id} aria-label={pageTitle(page)}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{pageTitle(page)}</h2>
                <ChannelChip channel={page.channel} />
                <span className="text-xs text-slate-500">{COPY.issueCount(flags.length)}</span>
              </div>
              <p className="mb-3 break-all text-xs text-slate-500">{page.url}</p>
              <ul className="space-y-2">
                {flags.map((flag) => (
                  <li key={flag.id}>
                    <FlagCard flag={flag} decision={decisions[flag.id]} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function FlagCard({ flag, decision }) {
  return (
    <Link
      to={`/flag/${flag.id}`}
      data-testid="flag-card"
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge category={flag.category} />
        <span className="font-medium">{categoryLabel(flag.category)}</span>
        <DecisionBadge decision={decision} />
        <span className="ml-auto">
          <Confidence value={flag.confidence} />
        </span>
      </div>
      <blockquote className="mt-2 border-l-2 border-amber-400 pl-3 text-sm text-slate-700">
        {quoted(truncate(flag.span))}
      </blockquote>
    </Link>
  );
}
