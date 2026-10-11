// "My reviews": the signed-in reviewer's workspace. Findings to review come from the public demo
// firm; the history list comes only from reviewer-decision-list, which returns the caller's own
// rows. Private data lives in component state keyed to the Clerk user id — signing out or
// switching accounts unmounts it and refetches, so one reviewer never sees another's work.
import { SignIn, useAuth } from "@clerk/react";
import { DecisionBadge, SeverityBadge, ChannelChip, Confidence } from "@/components/Badges";
import { EmptyBlock, ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { clerkEnabled } from "@/lib/clerk";
import { COPY } from "@/lib/copy";
import { findDemoFirm, loadInbox } from "@/lib/data";
import { quoted, truncate } from "@/lib/highlight";
import { formatDate } from "@/pages/FlagDetail";
import { listMyDecisions, ReviewerAuthError } from "@/lib/reviewerApi";
import { Link } from "@/lib/router";
import { categoryLabel } from "@/lib/severity";
import { pageTitle, useAsync } from "@/lib/useAsync";

export function SignInPrompt() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{COPY.reviewsSignInTitle}</h1>
        <p className="mt-2 text-sm text-night-600">{COPY.reviewsSignInDetail}</p>
      </div>
      {/* Hash routing keeps Clerk's internal steps out of this app's pathname router. */}
      <SignIn routing="hash" fallbackRedirectUrl="/reviews" />
    </div>
  );
}

export default function Reviews() {
  return (
    <Shell>{clerkEnabled ? <GatedWorkspace /> : <EmptyBlock title={COPY.reviewsNotConfigured} />}</Shell>
  );
}

function GatedWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingBlock rows={3} />;
  if (!isSignedIn) return <SignInPrompt />;
  return <Workspace />;
}

function Workspace() {
  const { getToken, userId } = useAuth();
  const { status, data, error, reload } = useAsync(async () => {
    const firm = await findDemoFirm();
    const [inbox, decisions] = await Promise.all([
      firm ? loadInbox(firm.id, firm) : Promise.resolve(null),
      listMyDecisions(getToken),
    ]);
    return { firm, inbox, decisions };
  }, [userId]);

  if (status === "loading") return <LoadingBlock rows={4} />;
  if (status === "error") {
    if (error instanceof ReviewerAuthError) return <SignInPrompt />;
    return <ErrorBlock onRetry={reload} />;
  }
  const { firm, inbox, decisions } = data;
  // First occurrence per flag is the latest decision (the list arrives newest-first).
  const latestByFlag = {};
  for (const decision of decisions) latestByFlag[decision.flag_id] ??= decision;
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{COPY.reviewsTitle}</h1>
        <p className="mt-1 text-sm text-night-600">
          {COPY.reviewsSavedNote} {COPY.reviewsDemoNote}
        </p>
      </div>
      <section aria-label={COPY.reviewsHistoryTitle}>
        <h2 className="mb-3 font-medium">{COPY.reviewsHistoryTitle}</h2>
        {decisions.length === 0 ? (
          <EmptyBlock title={COPY.reviewsEmptyTitle} detail={COPY.reviewsEmptyDetail} />
        ) : (
          <ul className="space-y-2">
            {decisions.map((decision) => (
              <ReviewRow key={decision.id} decision={decision} />
            ))}
          </ul>
        )}
      </section>
      <section aria-label={COPY.reviewsFindingsTitle}>
        <h2 className="mb-3 font-medium">{COPY.reviewsFindingsTitle}</h2>
        {!firm || !inbox || inbox.groups.length === 0 ? (
          <EmptyBlock title={COPY.emptyInbox} detail={COPY.emptyInboxDetail} />
        ) : (
          <div className="space-y-6">
            {inbox.groups.map(({ page, flags }) => (
              <section key={page.id} aria-label={pageTitle(page)}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{pageTitle(page)}</h3>
                  <ChannelChip channel={page.channel} />
                </div>
                <p className="mb-2 break-all text-xs text-night-600">{page.url}</p>
                <ul className="space-y-2">
                  {flags.map((flag) => (
                    <li key={flag.id}>
                      <FindingCard flag={flag} decision={latestByFlag[flag.id]} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FindingCard({ flag, decision }) {
  return (
    <Link
      to={`/reviews/flag/${flag.id}`}
      data-testid="review-flag-card"
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

function ReviewRow({ decision }) {
  return (
    <li className="rounded-lg border border-paper-200 bg-white p-4 text-sm" data-testid="review-row">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionBadge decision={decision} />
        {decision.category && <span className="font-medium">{categoryLabel(decision.category)}</span>}
        <span className="ml-auto text-xs text-night-600">
          {COPY.reviewDecidedAt} {formatDate(decision.decided_at)}
        </span>
      </div>
      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-night-600">
        {COPY.reviewOriginalQuote}
      </h3>
      <blockquote className="mt-1 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono text-night-700">
        {quoted(truncate(decision.original_quote))}
      </blockquote>
      {decision.final_text && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-night-600">
            {COPY.reviewFinalText}
          </h3>
          <p className="mt-1 rounded bg-sage-100 p-2">{decision.final_text}</p>
        </>
      )}
      {decision.page_url && (
        <a
          href={decision.page_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block break-all text-xs text-night-600 underline"
        >
          {decision.page_url}
        </a>
      )}
    </li>
  );
}
