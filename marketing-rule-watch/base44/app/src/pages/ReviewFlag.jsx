// /reviews/flag/:id — review one demo-firm finding while signed in with Clerk.
// Reuses the flag detail evidence (page text, quote, screenshot) and the RewriteDrawer with a
// Clerk-backed `record`, so decisions land in the reviewer's account instead of the browser session.
import { useAuth } from "@clerk/react";
import { useState } from "react";
import { Confidence, SeverityBadge } from "@/components/Badges";
import { EmptyBlock, ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
import RewriteDrawer from "@/components/RewriteDrawer";
import { clerkEnabled } from "@/lib/clerk";
import { COPY, SHOW_REWRITE } from "@/lib/copy";
import { loadFlag } from "@/lib/data";
import { listMyDecisions, ReviewerAuthError, submitReviewerDecision } from "@/lib/reviewerApi";
import { Link, useParams } from "@/lib/router";
import { categoryLabel } from "@/lib/severity";
import { useAsync } from "@/lib/useAsync";
import { EvidencePanel, PageText, Screenshot } from "@/pages/FlagDetail";
import { SignInPrompt } from "@/pages/Reviews";

export default function ReviewFlag() {
  return (
    <Shell>{clerkEnabled ? <GatedReview /> : <EmptyBlock title={COPY.reviewsNotConfigured} />}</Shell>
  );
}

function GatedReview() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingBlock rows={3} />;
  if (!isSignedIn) return <SignInPrompt />;
  return <ReviewDetail />;
}

function ReviewDetail() {
  const { id } = useParams();
  const { getToken, userId } = useAuth();
  const { status, data, error, reload } = useAsync(async () => {
    const [detail, decisions] = await Promise.all([loadFlag(id), listMyDecisions(getToken)]);
    return { ...detail, decisions };
  }, [id, userId]);

  if (status === "loading") return <LoadingBlock rows={3} />;
  if (status === "error") {
    if (error instanceof ReviewerAuthError) return <SignInPrompt />;
    return <ErrorBlock message={COPY.notFound} onRetry={reload} />;
  }
  const { flag, page, firm, decisions } = data;
  if (!firm?.is_demo) return <EmptyBlock title={COPY.reviewsNotEligible} />;
  const myDecision = decisions.find((decision) => decision.flag_id === flag.id) ?? null;
  return <ReviewBody flag={flag} page={page} getToken={getToken} initialDecision={myDecision} />;
}

function ReviewBody({ flag, page, getToken, initialDecision }) {
  const [decision, setDecision] = useState(initialDecision);
  const record = async ({ flagId, action, finalText, requestId }) =>
    (await submitReviewerDecision(getToken, { flag_id: flagId, action, final_text: finalText, request_id: requestId }))
      .decision;
  return (
    <>
      <Link to="/reviews" className="text-sm text-night-600 hover:text-night-950">
        ← {COPY.backToReviews}
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
              <RewriteDrawer flag={flag} decision={decision} onDecided={setDecision} record={record} />
              {decision && (
                <p className="mt-2 text-xs text-night-600">
                  <Link to="/reviews" className="underline">
                    {COPY.reviewsSavedLink}
                  </Link>
                </p>
              )}
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
