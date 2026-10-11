// Returns the signed-in reviewer's own decision history ("My reviews"), newest first.
// This is the ONLY read path for ReviewerDecision: the entity's RLS is all-false, so rows are
// reachable only here, always filtered by the verified clerk_user_id — client-side filtering is
// not authorization, and there is no way to ask for another reviewer's rows.
//
// Auth: Clerk session token in body.clerk_token, verified by shared/clerk-auth.ts.
// POST {clerk_token}
// 200 {decisions: [{id, flag_id, action, final_text, original_quote, page_url, decided_at, category, why}]}
// 401 missing/invalid/expired token · 500 reviewer sign-in not configured
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { ClerkAuthError, type ClerkAuthConfig, verifyClerkSessionToken } from "../../shared/clerk-auth.ts";
import { listReviewerDecisions } from "../../shared/reviewer-core.ts";

function clerkConfig(): ClerkAuthConfig | null {
  const issuer = (secrets.get("CLERK_JWT_ISSUER") ?? "").trim();
  const jwtKeyPem = (secrets.get("CLERK_JWT_KEY") ?? "").trim();
  if (!issuer && !jwtKeyPem) return null;
  const authorizedParties = (secrets.get("CLERK_AUTHORIZED_PARTIES") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { issuer, authorizedParties, jwtKeyPem: jwtKeyPem || undefined };
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const config = clerkConfig();
  if (!config) return Response.json({ error: "Reviewer sign-in is not configured" }, { status: 500 });
  const body = await req.json().catch(() => ({}));

  let identity;
  try {
    identity = await verifyClerkSessionToken(body?.clerk_token, config);
  } catch (e) {
    if (!(e instanceof ClerkAuthError)) console.log(`reviewer-decision-list auth: ${(e as Error).message}`);
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const decisions = await listReviewerDecisions(base44, identity.userId);
    return Response.json({ decisions });
  } catch (e) {
    console.log(`reviewer-decision-list failed: ${(e as Error).message}`);
    return Response.json({ error: "Could not load your reviews" }, { status: 500 });
  }
}
