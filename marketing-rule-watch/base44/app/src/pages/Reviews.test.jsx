// Focused tests for the "My reviews" workspace: auth gating, per-reviewer isolation, and
// private-state clearing on sign-out / account switch. Clerk and the base44 client are mocked;
// nothing hits the network.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable Clerk session the tests flip between signed-out, reviewer A, and reviewer B.
const auth = vi.hoisted(() => ({ isLoaded: true, isSignedIn: false, userId: null, token: null }));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isLoaded: auth.isLoaded, isSignedIn: auth.isSignedIn, userId: auth.userId, getToken: async () => auth.token }),
  SignIn: () => <div data-testid="clerk-signin" />,
  Show: ({ when, children }) => {
    const signed = when === "signed-in" ? auth.isSignedIn : !auth.isSignedIn;
    return signed ? children : null;
  },
  SignInButton: ({ children }) => <>{children}</>,
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

// Keep the test about the workspace, not the evidence components it imports.
vi.mock("@/pages/FlagDetail", () => ({ formatDate: (v) => v }));

const invoke = vi.hoisted(() => vi.fn());
const decisionCreate = vi.hoisted(() => vi.fn());

vi.mock("@/api/base44Client", () => ({
  base44: {
    functions: { invoke },
    entities: {
      Firm: { filter: async () => [{ id: "firm_demo", name: "Demo", is_demo: true }] },
      Page: { filter: async () => [{ id: "page_1", firm_id: "firm_demo", url: "https://demo.example/a", channel: "website", markdown: "# About us" }] },
      Flag: { list: async () => [{ id: "flag_1", page_id: "page_1", category: "BENEFITS_WITHOUT_RISK", span: "never lost money", confidence: 0.9 }] },
      Decision: { create: decisionCreate, filter: async () => [] },
      // ReviewerDecision deliberately absent: if any code path tried the ordinary public
      // entity route it would throw (and in production RLS all-false denies it outright).
    },
  },
}));

import { COPY } from "@/lib/copy";
import Reviews from "@/pages/Reviews";

const decisionsFor = (user) => [
  {
    id: `rd_${user}`,
    flag_id: "flag_1",
    action: "edit",
    final_text: `reviewer ${user} final text`,
    original_quote: "never lost money",
    page_url: "https://demo.example/a",
    decided_at: "2026-10-10T12:00:00Z",
    category: "BENEFITS_WITHOUT_RISK",
  },
];

const signInAs = (user) => {
  auth.isSignedIn = true;
  auth.userId = `user_${user}`;
  auth.token = `tok_${user}`;
};

describe("My reviews workspace", () => {
  beforeEach(() => {
    auth.isSignedIn = false;
    auth.userId = null;
    auth.token = null;
    invoke.mockReset().mockImplementation(async (name, body) => {
      if (name !== "reviewer-decision-list") throw new Error(`unexpected function ${name}`);
      const user = body.clerk_token === "tok_A" ? "A" : body.clerk_token === "tok_B" ? "B" : null;
      return { data: { decisions: user ? decisionsFor(user) : [] } };
    });
    decisionCreate.mockReset();
  });
  afterEach(cleanup);

  it("signed out: shows the sign-in prompt and fetches no private data", async () => {
    render(<Reviews />);
    expect(await screen.findByText(COPY.reviewsSignInTitle)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("signed in: loads only the caller's history with their token", async () => {
    signInAs("A");
    render(<Reviews />);
    expect(await screen.findByText("reviewer A final text")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("reviewer-decision-list", { clerk_token: "tok_A" });
    // Demo findings are listed for review and link to the review screen.
    expect(screen.getByTestId("review-flag-card").getAttribute("href")).toBe("/reviews/flag/flag_1");
  });

  it("switching accounts clears and refetches — A never sees B's history", async () => {
    signInAs("A");
    const { rerender } = render(<Reviews />);
    expect(await screen.findByText("reviewer A final text")).toBeTruthy();

    signInAs("B");
    rerender(<Reviews />);
    expect(await screen.findByText("reviewer B final text")).toBeTruthy();
    expect(screen.queryByText("reviewer A final text")).toBeNull();
    expect(invoke).toHaveBeenLastCalledWith("reviewer-decision-list", { clerk_token: "tok_B" });
  });

  it("sign-out unmounts private data — nothing from the history stays rendered", async () => {
    signInAs("A");
    const { rerender } = render(<Reviews />);
    expect(await screen.findByText("reviewer A final text")).toBeTruthy();

    auth.isSignedIn = false;
    auth.userId = null;
    auth.token = null;
    rerender(<Reviews />);
    await waitFor(() => expect(screen.queryByText("reviewer A final text")).toBeNull());
    expect(screen.getByText(COPY.reviewsSignInTitle)).toBeTruthy();
  });

  it("a 401 from the endpoint falls back to the sign-in prompt", async () => {
    signInAs("A");
    invoke.mockImplementation(async () => {
      throw { response: { status: 401 } };
    });
    render(<Reviews />);
    expect(await screen.findByText(COPY.reviewsSignInTitle)).toBeTruthy();
  });
});
