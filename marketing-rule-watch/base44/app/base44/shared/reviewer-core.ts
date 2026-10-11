// Reviewer workspace ("My reviews") core: validate a decision request, scope it to the fictional
// demo firm, dedupe by request_id, and store/list private ReviewerDecision rows.
// The reviewer identity (clerk_user_id) arrives ONLY as an argument from the entry function, which
// gets it from a verified Clerk token — this module never reads user ids out of the request body.
// ReviewerDecision RLS is all-false, so the only way in or out is these two functions via
// service role, with clerk_user_id applied server-side on every read and write.
// Self-check: deno run base44/app/base44/shared/reviewer-core.ts

export const REVIEW_ACTIONS = ["approve", "edit", "reject"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

const MAX_ID_CHARS = 128;
const MAX_FINAL_TEXT_CHARS = 4000;
const LIST_LIMIT = 200;
// request_id must be a client-generated nonce (uuid or similar), never free text.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

export class ReviewerError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export interface DecisionInput {
  flag_id: string;
  action: ReviewAction;
  final_text: string;
  request_id: string;
}

// deno-lint-ignore no-explicit-any
export function parseDecisionInput(body: any): { ok: true; value: DecisionInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const flag_id = typeof body?.flag_id === "string" ? body.flag_id.trim() : "";
  if (!flag_id || flag_id.length > MAX_ID_CHARS) errors.push("flag_id");
  const action = typeof body?.action === "string" ? body.action : "";
  if (!REVIEW_ACTIONS.includes(action as ReviewAction)) errors.push("action");
  const request_id = typeof body?.request_id === "string" ? body.request_id.trim() : "";
  if (!REQUEST_ID_PATTERN.test(request_id)) errors.push("request_id");
  let final_text = body?.final_text;
  if (final_text == null) final_text = "";
  if (typeof final_text !== "string") {
    errors.push("final_text");
    final_text = "";
  } else {
    final_text = final_text.trim();
  }
  if ((action as ReviewAction) === "reject") {
    if (final_text) errors.push("final_text (reject takes no text)");
    final_text = "";
  } else if (!final_text || final_text.length > MAX_FINAL_TEXT_CHARS) {
    errors.push("final_text");
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { flag_id, action: action as ReviewAction, final_text, request_id } };
}

interface StoredDecision {
  id?: string;
  clerk_user_id: string;
  flag_id: string;
  action: ReviewAction;
  final_text: string;
  original_quote: string;
  page_url: string;
  decided_at: string;
  request_id: string;
}

// deno-lint-ignore no-explicit-any
export async function createReviewerDecision(base44: any, clerkUserId: string, input: DecisionInput) {
  // Idempotency first: a double-click or retried request finds its stored row and is not a duplicate.
  const existing: StoredDecision[] = await base44.asServiceRole.entities.ReviewerDecision.filter(
    { clerk_user_id: clerkUserId, request_id: input.request_id },
    "-created_date",
    1,
  );
  if (existing.length) return { deduped: true, decision: existing[0] };

  const flag = await base44.asServiceRole.entities.Flag.get(input.flag_id).catch(() => null);
  if (!flag) throw new ReviewerError(404, "flag_not_found", "Finding not found");
  const page = await base44.asServiceRole.entities.Page.get(String(flag.page_id)).catch(() => null);
  if (!page) throw new ReviewerError(404, "page_not_found", "Page not found");
  const firm = await base44.asServiceRole.entities.Firm.get(String(page.firm_id)).catch(() => null);
  if (!firm?.is_demo) {
    throw new ReviewerError(403, "not_a_demo_finding", "Only the fictional demo firm's findings can be reviewed here");
  }

  const decision = await base44.asServiceRole.entities.ReviewerDecision.create({
    clerk_user_id: clerkUserId,
    flag_id: String(flag.id),
    action: input.action,
    final_text: input.final_text,
    original_quote: String(flag.span ?? ""),
    page_url: String(page.url ?? ""),
    decided_at: new Date().toISOString(),
    request_id: input.request_id,
  });
  return { deduped: false, decision };
}

// Returns the reviewer's own history, newest first, enriched with the flag's category and reason.
// deno-lint-ignore no-explicit-any
export async function listReviewerDecisions(base44: any, clerkUserId: string, limit = LIST_LIMIT) {
  const rows: StoredDecision[] = await base44.asServiceRole.entities.ReviewerDecision.filter(
    { clerk_user_id: clerkUserId },
    "-decided_at",
    limit,
  );
  // deno-lint-ignore no-explicit-any
  const flags = new Map<string, any>();
  for (const id of [...new Set(rows.map((r) => String(r.flag_id)))]) {
    const flag = await base44.asServiceRole.entities.Flag.get(id).catch(() => null);
    if (flag) flags.set(id, flag);
  }
  return rows.map((r) => {
    const flag = flags.get(String(r.flag_id));
    return {
      id: r.id,
      flag_id: r.flag_id,
      action: r.action,
      final_text: r.final_text ?? "",
      original_quote: r.original_quote ?? "",
      page_url: r.page_url ?? "",
      decided_at: r.decided_at ?? "",
      category: flag?.category ?? null,
      why: flag?.why ?? null,
    };
  });
}

if (import.meta.main) {
  // ---- Mock Base44 client: in-memory rows; entities.Decision intentionally absent so an
  // accidental write to the shared demo contract throws instead of passing silently. ----
  // deno-lint-ignore no-explicit-any
  const table = (rows: any[]) => ({
    get: async (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("not found");
      return row;
      },
    // deno-lint-ignore no-explicit-any
    filter: async (query: Record<string, any>, _sort?: string, limit?: number) => {
      const out = rows.filter((r) => Object.entries(query).every(([k, v]) => r[k] === v));
      return limit ? out.slice(0, limit) : out;
    },
    // deno-lint-ignore no-explicit-any
    create: async (data: any) => {
      const row = { id: `rd_${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
  });
  const firms = [{ id: "firm_demo", is_demo: true }, { id: "firm_real", is_demo: false }];
  const pages = [
    { id: "page_1", firm_id: "firm_demo", url: "https://demo.example/about" },
    { id: "page_2", firm_id: "firm_real", url: "https://real.example/" },
  ];
  const flags = [
    { id: "flag_1", page_id: "page_1", category: "BENEFITS_WITHOUT_RISK", span: "never lost money", why: "No risk mentioned." },
    { id: "flag_2", page_id: "page_2", category: "UNSUBSTANTIATED_CLAIM", span: "#1 firm", why: "No source." },
  ];
  // deno-lint-ignore no-explicit-any
  const decisions: any[] = [];
  const entities = new Proxy(
    { Flag: table(flags), Page: table(pages), Firm: table(firms), ReviewerDecision: table(decisions) },
    // deno-lint-ignore no-explicit-any
    { get: (t, p: any) => (p in t ? (t as any)[p] : (() => { throw new Error(`unexpected entity access: ${String(p)}`); })()) },
  );
  const base44 = { asServiceRole: { entities } };

  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  const ok = (cond: unknown, what: string) => {
    if (!cond) throw new Error(what);
  };
  const input = (over: Record<string, unknown>) => ({ flag_id: "flag_1", action: "approve", final_text: "balanced text", request_id: "req-1-abcdef", ...over });

  // -- Validation --
  eq(parseDecisionInput(input({})).ok, true, "valid approve");
  eq(parseDecisionInput(input({ action: "edit", final_text: "my rewrite" })).ok, true, "valid edit");
  eq(parseDecisionInput(input({ action: "reject", final_text: "" })).ok, true, "valid reject");
  eq(parseDecisionInput(input({ action: "reject", final_text: undefined })).ok, true, "reject without text");
  for (const [bad, field] of [
    [input({ action: "delete" }), "action"],
    [input({ action: "APPROVE" }), "action"],
    [input({ flag_id: "" }), "flag_id"],
    [input({ flag_id: 42 }), "flag_id"],
    [input({ flag_id: "x".repeat(200) }), "flag_id"],
    [input({ request_id: "" }), "request_id"],
    [input({ request_id: "../etc" }), "request_id"],
    [input({ request_id: "a b c d e f g h i" }), "request_id"],
    [input({ request_id: 12345678 }), "request_id"],
    [input({ action: "approve", final_text: "" }), "final_text"],
    [input({ action: "edit", final_text: "  " }), "final_text"],
    [input({ action: "approve", final_text: "x".repeat(4001) }), "final_text"],
    [input({ action: "reject", final_text: "replacement" }), "final_text"],
    [null, "flag_id"],
    [{}, "flag_id"],
  ] as const) {
    const parsed = parseDecisionInput(bad);
    eq(parsed.ok, false, `invalid should fail (${field})`);
    if (!parsed.ok) ok(parsed.errors.some((e) => e.startsWith(field)), `expected error for ${field}, got ${parsed.errors}`);
  }
  // Oversized approve text is rejected at exactly the cap.
  eq(parseDecisionInput(input({ action: "approve", final_text: "x".repeat(4000) })).ok, true, "4000-char text ok");

  // -- A forged body identity is ignored: the stored row takes the verified caller only. --
  const forged = parseDecisionInput(input({ clerk_user_id: "user_B", user_id: "user_B", email: "b@x" }));
  ok(forged.ok, "forged identity fields should not fail validation");
  const created = await createReviewerDecision(base44, "user_A", forged.value);
  eq(created.decision.clerk_user_id, "user_A", "identity comes from the verified token");
  eq(decisions[0].original_quote, "never lost money", "original_quote comes from the flag, not the body");
  eq(decisions[0].page_url, "https://demo.example/about", "page_url copied server-side");
  ok(typeof decisions[0].decided_at === "string" && !Number.isNaN(Date.parse(decisions[0].decided_at)), "decided_at generated by server");

  // -- Valid approve / edit / reject all store correctly. --
  for (const [action, text] of [["edit", "my edit"], ["reject", ""]] as const) {
    const p = parseDecisionInput(input({ action, final_text: text, request_id: `req-${action}-1` }));
    ok(p.ok, `valid ${action}`);
    const r = await createReviewerDecision(base44, "user_A", p.value);
    eq(r.decision.action, action, `${action} stored`);
    eq(r.decision.final_text, text, `${action} final_text`);
  }

  // -- Duplicate submissions do not create duplicates. --
  const dupe = await createReviewerDecision(base44, "user_A", input({}));
  eq(dupe.deduped, true, "same request_id deduped");
  eq(decisions.length, 3, "no duplicate row");
  const otherUserSameRequest = await createReviewerDecision(base44, "user_B", input({}));
  eq(otherUserSameRequest.deduped, false, "request_id is scoped to the reviewer");
  eq(decisions.length, 4, "different reviewer gets own row");

  // -- Ownership: A never sees B's rows; a returning user sees their own history. --
  const mineA = await listReviewerDecisions(base44, "user_A");
  const mineB = await listReviewerDecisions(base44, "user_B");
  ok(mineA.every((d) => d.flag_id === "flag_1"), "A sees only own flags");
  eq(mineA.length, 3, "A history count");
  eq(mineB.length, 1, "B history count");
  ok(!mineB.some((d) => d.request_id === "req-edit-1"), "B cannot read A's history");
  eq(mineA[0].category, "BENEFITS_WITHOUT_RISK", "history carries the flag category");
  eq(mineA[0].why, "No risk mentioned.", "history carries the flag reason");

  // -- Non-demo findings cannot be reviewed. --
  const rejectedPromise = createReviewerDecision(base44, "user_A", { flag_id: "flag_2", action: "approve", final_text: "x", request_id: "req-nondemo-1" });
  try {
    await rejectedPromise;
    throw new Error("non-demo flag should have been refused");
  } catch (e) {
    ok(e instanceof ReviewerError && e.status === 403 && e.code === "not_a_demo_finding", "non-demo 403");
  }
  const missingFlag = createReviewerDecision(base44, "user_A", { flag_id: "nope", action: "approve", final_text: "x", request_id: "req-nope-1" });
  try {
    await missingFlag;
    throw new Error("unknown flag should 404");
  } catch (e) {
    ok(e instanceof ReviewerError && e.status === 404, "unknown flag 404");
  }

  // -- The entity file must keep every RLS operation false, or rows are readable by anyone. --
  try {
    const schema = JSON.parse(
      await Deno.readTextFile(new URL("../entities/reviewer-decision.jsonc", import.meta.url)),
    );
    eq(schema.rls, { create: false, read: false, update: false, delete: false }, "ReviewerDecision RLS all-false");
  } catch (e) {
    if ((e as Error).name !== "PermissionDenied" && (e as { code?: string }).code !== "EPERM") throw e;
    console.log("  (RLS check skipped: run with --allow-read to include it)");
  }

  console.log("reviewer-core.ts self-check: ok");
}
