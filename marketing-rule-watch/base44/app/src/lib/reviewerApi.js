// Client for the Clerk-authenticated reviewer endpoints. The Clerk session token travels inside
// the JSON body (field `clerk_token`), so it can never collide with the Authorization header
// Base44 uses for its own session — a Clerk session is not a Base44 session.
// Identity is always the verified token's `sub`; nothing here sends a user id.
import { base44 } from "@/api/base44Client";
import { COPY } from "@/lib/copy";

// Thrown when the Clerk session is absent/expired or the backend answers 401.
// The message is user-facing copy, safe to show verbatim.
export class ReviewerAuthError extends Error {}

async function reviewerToken(getToken) {
  const token = await getToken().catch(() => null);
  if (!token) throw new ReviewerAuthError(COPY.reviewsSessionExpired);
  return token;
}

async function invoke(name, getToken, data) {
  try {
    const res = await base44.functions.invoke(name, { ...data, clerk_token: await reviewerToken(getToken) });
    return res.data;
  } catch (error) {
    if (error instanceof ReviewerAuthError) throw error;
    if (error?.response?.status === 401) throw new ReviewerAuthError(COPY.reviewsSessionExpired);
    const detail = error?.response?.data?.message ?? error?.response?.data?.error;
    throw new Error(typeof detail === "string" && detail ? detail : COPY.loadError);
  }
}

/** The reviewer's own decisions, newest first. Server filters by the verified user id. */
export async function listMyDecisions(getToken) {
  const data = await invoke("reviewer-decision-list", getToken, {});
  return Array.isArray(data?.decisions) ? data.decisions : [];
}

/** Records one decision. `request_id` dedupes double clicks and retries server-side. */
export async function submitReviewerDecision(getToken, { flag_id, action, final_text, request_id }) {
  return invoke("reviewer-decision-create", getToken, { flag_id, action, final_text, request_id });
}
