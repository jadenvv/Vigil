// Records a signed-in reviewer's approve / edit / reject on a demo-firm finding as a private
// ReviewerDecision row. This is the ONLY write path: the entity's RLS is all-false.
//
// Auth: Clerk session token in body.clerk_token, verified with the instance public key
// (CLERK_JWT_KEY PEM, else the issuer JWKS) by shared/clerk-auth.ts. The reviewer identity is the
// verified JWT `sub` — never a user id, email or session id from the request body. Base44 auth is
// untouched: this endpoint deliberately does not check base44.auth.me().
// Findings are scoped to the fictional demo firm (Firm.is_demo) — other firms' flags get 403.
//
// POST {clerk_token, flag_id, action: "approve"|"edit"|"reject", final_text?, request_id}
// 201 {decision}        — stored
// 200 {decision, deduped: true} — same (clerk_user_id, request_id) was already stored; safe retry
// 400 invalid action/ids/text 401 missing/invalid/expired token 403 non-demo flag 404 unknown flag
// 500 reviewer sign-in not configured on this deployment
//
// Secrets: CLERK_JWT_ISSUER (token iss, e.g. https://name.clerk.accounts.dev) — required unless
// CLERK_JWT_KEY is set; CLERK_JWT_KEY (optional PEM public key, networkless verify);
// CLERK_AUTHORIZED_PARTIES (optional, comma-separated allowed azp origins).
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { ClerkAuthError, type ClerkAuthConfig, verifyClerkSessionToken } from "../../shared/clerk-auth.ts";
import { createReviewerDecision, parseDecisionInput, ReviewerError } from "../../shared/reviewer-core.ts";

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
    if (!(e instanceof ClerkAuthError)) console.log(`reviewer-decision-create auth: ${(e as Error).message}`);
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = parseDecisionInput(body);
  if (!parsed.ok) return Response.json({ error: "invalid_input", fields: parsed.errors }, { status: 400 });

  try {
    const result = await createReviewerDecision(base44, identity.userId, parsed.value);
    // Never log the token or the review text; ids and the action are enough to trace a call.
    console.log(`reviewer-decision-create ${result.deduped ? "deduped" : "created"} flag=${parsed.value.flag_id}`);
    return Response.json(result, { status: result.deduped ? 200 : 201 });
  } catch (e) {
    if (e instanceof ReviewerError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    console.log(`reviewer-decision-create failed: ${(e as Error).message}`);
    return Response.json({ error: "Could not save the review" }, { status: 500 });
  }
}
