// Focused tests for the reviewer API client and the anonymous Decision path it must not touch.
// The base44 client is mocked; nothing here hits the network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const decisionCreate = vi.hoisted(() => vi.fn());

vi.mock("@/api/base44Client", () => ({
  base44: {
    functions: { invoke },
    entities: { Decision: { create: decisionCreate } },
  },
}));

// session.ts uses window.localStorage under jsdom — the anonymous path's only identity.
import { recordDecision } from "@/lib/data";
import { getSessionId } from "@/lib/session";
import { listMyDecisions, ReviewerAuthError, submitReviewerDecision } from "@/lib/reviewerApi";

const httpError = (status, data = {}) => ({ response: { status, data } });

describe("reviewerApi", () => {
  beforeEach(() => {
    invoke.mockReset();
    decisionCreate.mockReset();
  });

  it("sends the Clerk session token in the body, never a user identity", async () => {
    invoke.mockResolvedValue({ data: { decisions: [] } });
    await listMyDecisions(async () => "tok_xyz");
    expect(invoke).toHaveBeenCalledWith("reviewer-decision-list", { clerk_token: "tok_xyz" });
    const body = invoke.mock.calls[0][1];
    for (const key of Object.keys(body)) {
      expect(["clerk_token"]).toContain(key);
    }
  });

  it("forwards flag, action, text and request_id on create", async () => {
    invoke.mockResolvedValue({ data: { decision: { id: "rd_1" }, deduped: false } });
    const out = await submitReviewerDecision(async () => "tok", {
      flag_id: "flag_1",
      action: "edit",
      final_text: "my rewrite",
      request_id: "req-1234",
    });
    expect(invoke).toHaveBeenCalledWith("reviewer-decision-create", {
      flag_id: "flag_1",
      action: "edit",
      final_text: "my rewrite",
      request_id: "req-1234",
      clerk_token: "tok",
    });
    expect(out.decision.id).toBe("rd_1");
  });

  it("maps a backend 401 to ReviewerAuthError (expired-session state)", async () => {
    invoke.mockRejectedValue(httpError(401));
    await expect(listMyDecisions(async () => "tok")).rejects.toBeInstanceOf(ReviewerAuthError);
  });

  it("rejects with ReviewerAuthError when no session token exists", async () => {
    await expect(listMyDecisions(async () => null)).rejects.toBeInstanceOf(ReviewerAuthError);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces the backend message on non-auth failures", async () => {
    invoke.mockRejectedValue(httpError(403, { message: "Only the fictional demo firm" }));
    await expect(listMyDecisions(async () => "tok")).rejects.toThrow("Only the fictional demo firm");
  });

  it("never touches the anonymous Decision entity", async () => {
    invoke.mockResolvedValue({ data: { decision: {} } });
    await submitReviewerDecision(async () => "tok", {
      flag_id: "f", action: "approve", final_text: "t", request_id: "r-1234567",
    });
    expect(decisionCreate).not.toHaveBeenCalled();
  });
});

describe("anonymous recordDecision (unchanged demo path)", () => {
  it("writes a session-scoped Decision with no Clerk identity", async () => {
    invoke.mockReset();
    decisionCreate.mockReset().mockResolvedValue({ id: "d_1" });
    await recordDecision({ flagId: "flag_1", action: "approve", finalText: "ok" });
    expect(decisionCreate).toHaveBeenCalledTimes(1);
    const row = decisionCreate.mock.calls[0][0];
    expect(row.session_id).toBe(getSessionId());
    expect(row).not.toHaveProperty("clerk_user_id");
    expect(row).not.toHaveProperty("clerk_token");
    expect(row).not.toHaveProperty("request_id");
    expect(invoke).not.toHaveBeenCalledWith("reviewer-decision-create", expect.anything());
  });
});
