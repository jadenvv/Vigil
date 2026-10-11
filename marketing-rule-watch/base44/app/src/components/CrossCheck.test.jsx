import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/api/base44Client", () => ({ base44: { functions: { invoke: (...a) => invoke(...a) } } }));

import CrossCheck from "@/components/CrossCheck";
import { buildMarksCsv, MARK_COLUMNS } from "@/lib/evidenceCsv";

const FIRM = { id: "f1", domain: "quarrywick.example" };
const MARKS = [
  { status: "contradicted", severity: "high", topic: "losses", absolute: true, claim_span: "never lost money", claim_url: "https://q/about", evidence_span: "accounts declined 12%", evidence_url: "form_adv.md", confidence: 0.9, why: "2022 losses" },
  { status: "unverified", severity: "review", topic: "guarantees", absolute: true, claim_span: "always beat the market", claim_url: "https://q/", evidence_span: "", evidence_url: "", confidence: null, why: "substantiate" },
  { status: "unverified", severity: "info", topic: "size", absolute: false, claim_span: "=$412 million", claim_url: "https://q/", evidence_span: "", evidence_url: "", confidence: null, why: "keep records" },
];

beforeEach(() => invoke.mockReset());
afterEach(cleanup);

describe("CrossCheck", () => {
  it("groups marks by severity and shows evidence only for contradictions", async () => {
    invoke.mockResolvedValue({ data: { marks: MARKS, model: "gpt-oss-20b" } });
    render(<CrossCheck firm={FIRM} />);
    fireEvent.click(screen.getByTestId("cross-check-run"));
    await screen.findByTestId("cross-check-result");
    expect(invoke).toHaveBeenCalledWith("crossref", { firm_id: "f1", docs: [] });
    expect(within(screen.getByTestId("cross-group-high")).getByText(/accounts declined 12%/)).toBeTruthy();
    expect(within(screen.getByTestId("cross-group-review")).getAllByTestId("cross-mark")).toHaveLength(1);
    expect(within(screen.getByTestId("cross-group-info")).queryByText(/Other document says/)).toBeNull();
    expect(screen.getByText(/gpt-oss-20b/)).toBeTruthy();
    expect(screen.getByTestId("cross-check-csv")).toBeTruthy();
  });

  it("shows the reviewer-only message on 401 and a quota message on 503", async () => {
    invoke.mockRejectedValueOnce({ response: { status: 401 } });
    render(<CrossCheck firm={FIRM} />);
    fireEvent.click(screen.getByTestId("cross-check-run"));
    await screen.findByTestId("cross-check-denied");
    invoke.mockRejectedValueOnce({ response: { status: 503, data: { error: "llm_unavailable" } } });
    fireEvent.click(screen.getByTestId("cross-check-run"));
    await screen.findByTestId("cross-check-cooldown");
  });

  it("sends uploaded documents with the request", async () => {
    invoke.mockResolvedValue({ data: { marks: [] } });
    render(<CrossCheck firm={FIRM} />);
    const file = new File(["Item 5. Our fee is 1.0%."], "form_adv.md", { type: "text/markdown" });
    fireEvent.change(screen.getByTestId("cross-check-files"), { target: { files: [file] } });
    await screen.findByText("form_adv.md");
    fireEvent.click(screen.getByTestId("cross-check-run"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("crossref", { firm_id: "f1", docs: [{ url: "form_adv.md", markdown: "Item 5. Our fee is 1.0%." }] }));
    await screen.findByText(/No absolute claims/);
  });
});

describe("marks CSV", () => {
  it("has one row per mark, blanks for missing evidence, defused formulas", () => {
    const lines = buildMarksCsv(MARKS).trim().split("\r\n");
    expect(lines[0]).toBe(MARK_COLUMNS.map((c) => `"${c}"`).join(","));
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"0.9"');
    expect(lines[2]).toContain('"",""'); // no evidence url/quote
    expect(lines[3]).toContain(`"'=$412 million"`);
  });
});
