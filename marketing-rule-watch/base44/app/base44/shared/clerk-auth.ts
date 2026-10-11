// Verifies Clerk session tokens for the reviewer workspace ("My reviews"). Clerk signs session
// JWTs with the instance's private key (RS256); the backend verifies with the instance public key:
// a PEM pasted from the Clerk Dashboard (CLERK_JWT_KEY, networkless) or, failing that, the
// instance JWKS at <CLERK_JWT_ISSUER>/.well-known/jwks.json — one HTTPS fetch, then cached by jose.
// Checks: signature, exp/nbf, iss, azp (when CLERK_AUTHORIZED_PARTIES is set), and a non-empty sub,
// which becomes clerk_user_id. Clerk docs: "Manual JWT verification".
//   https://clerk.com/docs/guides/sessions/manual-jwt-verification
// A Clerk session is NOT a Base44 session; this module never touches base44.auth.
// Self-check: deno run base44/shared/clerk-auth.ts
import { createRemoteJWKSet, importSPKI, jwtVerify } from "npm:jose@6.2.12";

export interface ClerkAuthConfig {
  issuer: string; // token `iss`, e.g. https://name.clerk.accounts.dev; also the JWKS base URL
  authorizedParties: string[]; // allowed `azp` origins; empty list skips the check
  jwtKeyPem?: string; // CLERK_JWT_KEY: PEM public key for networkless verification
  // deno-lint-ignore no-explicit-any
  jwks?: any; // injected key set (tests); normally resolved from the issuer URL
}

export interface ReviewerIdentity {
  userId: string; // JWT `sub` — the stable Clerk user id
  sessionId: string; // JWT `sid`
}

export class ClerkAuthError extends Error {}

const MIN_TOKEN_CHARS = 16;
const MAX_TOKEN_CHARS = 8192;

// deno-lint-ignore no-explicit-any
async function verificationKey(config: ClerkAuthConfig): Promise<any> {
  if (config.jwtKeyPem) return importSPKI(config.jwtKeyPem, "RS256");
  if (config.jwks) return config.jwks;
  if (!config.issuer) throw new ClerkAuthError("clerk issuer not configured");
  return createRemoteJWKSet(new URL(`${config.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`));
}

/** Returns the verified reviewer identity or throws ClerkAuthError (caller maps it to 401). */
export async function verifyClerkSessionToken(token: unknown, config: ClerkAuthConfig): Promise<ReviewerIdentity> {
  if (typeof token !== "string" || token.length < MIN_TOKEN_CHARS || token.length > MAX_TOKEN_CHARS || !token.includes(".")) {
    throw new ClerkAuthError("missing or malformed token");
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, await verificationKey(config), {
      algorithms: ["RS256"],
      issuer: config.issuer || undefined,
      clockTolerance: 30,
    }));
  } catch (e) {
    // jose errors carry a stable .code; the detail stays in logs, never in the response.
    throw new ClerkAuthError(`verification failed: ${(e as { code?: string }).code ?? "invalid"}`);
  }
  if (config.authorizedParties.length > 0) {
    const azp = payload.azp;
    if (typeof azp !== "string" || !config.authorizedParties.includes(azp)) {
      throw new ClerkAuthError("token not issued for this app");
    }
  }
  if (typeof payload.sub !== "string" || !payload.sub) throw new ClerkAuthError("token has no user id");
  return { userId: payload.sub, sessionId: typeof payload.sid === "string" ? payload.sid : "" };
}

if (import.meta.main) {
  const { createLocalJWKSet, exportJWK, exportSPKI, generateKeyPair, SignJWT } = await import("npm:jose@6.2.12");
  const ISSUER = "https://self-check.clerk.accounts.dev";
  const AZP = "https://vigil.example.app";

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "self-check";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const config: ClerkAuthConfig = { issuer: ISSUER, authorizedParties: [AZP], jwks };

  const sign = (claims: Record<string, unknown>, { iss = ISSUER, exp = "5m", key = privateKey } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "self-check" }).setIssuedAt().setIssuer(iss)
      .setExpirationTime(exp).sign(key);

  const rejects = async (p: Promise<unknown>, what: string) => {
    try {
      await p;
    } catch (e) {
      if (e instanceof ClerkAuthError) return;
      throw new Error(`${what}: rejected but not with ClerkAuthError (${e})`);
    }
    throw new Error(`${what}: should have been rejected`);
  };
  const eq = (a: unknown, b: unknown, what: string) => {
    if (a !== b) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };

  // A well-formed token verifies and yields the user id.
  const good = await sign({ sub: "user_2abc", sid: "sess_1", azp: AZP });
  const who = await verifyClerkSessionToken(good, config);
  eq(who.userId, "user_2abc", "valid token sub");
  eq(who.sessionId, "sess_1", "valid token sid");

  // Missing / malformed tokens.
  for (const bad of [undefined, null, "", "abc", "no.dots", 42]) {
    await rejects(verifyClerkSessionToken(bad, config), `malformed ${JSON.stringify(bad)}`);
  }
  // Expired.
  await rejects(verifyClerkSessionToken(await sign({ sub: "u", azp: AZP }, { exp: "-60s" }), config), "expired");
  // Wrong issuer.
  await rejects(verifyClerkSessionToken(await sign({ sub: "u", azp: AZP }, { iss: "https://other.example" }), config), "wrong iss");
  // Wrong signature (foreign key, same iss/azp).
  const foreign = await generateKeyPair("RS256");
  await rejects(verifyClerkSessionToken(await sign({ sub: "u", azp: AZP }, { key: foreign.privateKey }), config), "bad signature");
  // azp: wrong value, and missing while parties are configured.
  await rejects(verifyClerkSessionToken(await sign({ sub: "u", azp: "https://evil.example" }), config), "wrong azp");
  await rejects(verifyClerkSessionToken(await sign({ sub: "u" }), config), "missing azp");
  // azp check is skipped when no authorized parties are configured.
  const relaxed = await verifyClerkSessionToken(await sign({ sub: "u", azp: "https://anything.example" }), {
    issuer: ISSUER,
    authorizedParties: [],
    jwks,
  });
  eq(relaxed.userId, "u", "azp skipped when unconfigured");
  // Missing sub.
  await rejects(verifyClerkSessionToken(await sign({ azp: AZP }), config), "missing sub");
  // Networkless PEM path (CLERK_JWT_KEY) verifies the same token.
  const pem = await exportSPKI(publicKey);
  const viaPem = await verifyClerkSessionToken(good, { issuer: ISSUER, authorizedParties: [AZP], jwtKeyPem: pem });
  eq(viaPem.userId, "user_2abc", "pem verification");

  console.log("clerk-auth.ts self-check: ok");
}
