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
  const ready = status === "ready" && !data.missingDemoFirm;
  return (
    <Shell demo={demo} hero={ready ? <InboxHeader {...data} /> : null}>
      {status === "loading" && <LoadingBlock rows={4} />}
      {status === "error" && <ErrorBlock onRetry={reload} />}
      {status === "ready" && data.missingDemoFirm && <EmptyBlock title={COPY.noDemoFirm} />}
      {ready && <InboxBody {...data} />}
    </Shell>
  );
}

// The firm's summary sits in the same Dusk night band as the home hero, so the two read as one site.
function InboxHeader({ firm, groups, flagCount, pagesScanned }) {
  return (
    <div className="hero-scope" data-scheme="dusk-night">
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 sm:pb-12 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{firm.name}</h1>
        <p className="mt-2 text-[color:var(--h-muted)]" data-testid="issue-count">
          {COPY.issueCountAcross(flagCount, groups.length, pagesScanned)}
        </p>
        <p data-testid="scope-note" className="mt-1 text-sm text-[color:var(--h-muted)]">
          {COPY.scopeNote}
        </p>
        <Link
          to={`/firm/${firm.id}/exam`}
          data-testid="exam-link"
          className="mt-3 inline-block text-sm text-[color:var(--h-fg)] underline decoration-[color:var(--h-muted)] underline-offset-4 hover:decoration-[color:var(--h-fg)]"
        >
          {COPY.examLink}
        </Link>
      </div>
    </div>
  );
}

function InboxBody({ groups, decisions }) {
  return (
    <>
      {groups.length === 0 ? (
        <EmptyBlock title={COPY.emptyInbox} detail={COPY.emptyInboxDetail} />
      ) : (
        <div className="space-y-8">
          {groups.map(({ page, flags }) => (
            <section key={page.id} aria-label={pageTitle(page)}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{pageTitle(page)}</h2>
                <ChannelChip channel={page.channel} />
                <span className="text-xs text-night-600">{COPY.issueCount(flags.length)}</span>
              </div>
              <p className="mb-3 break-all text-xs text-night-600">{page.url}</p>
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
      className="block rounded-lg border border-paper-200 bg-white p-4 transition hover:border-night-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge category={flag.category} />
        <span className="font-medium">{categoryLabel(flag.category)}</span>
        <DecisionBadge decision={decision} />
        <span className="ml-auto">
          <Confidence value={flag.confidence} />
        </span>
      </div>
      <blockquote className="mt-2 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono text-sm text-night-700">
        {quoted(truncate(flag.span))}
      </blockquote>
    </Link>
  );
}
