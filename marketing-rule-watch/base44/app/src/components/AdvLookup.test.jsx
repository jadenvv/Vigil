import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/api/base44Client", () => ({ base44: { functions: { invoke: (...a) => invoke(...a) } } }));

import AdvLookup from "@/components/AdvLookup";
import { COPY } from "@/lib/copy";

const FIRM = { id: "f1", name: "Example Advisers" };

beforeEach(() => invoke.mockReset());
afterEach(cleanup);

describe("AdvLookup", () => {
  it("lists candidates with record and PDF links", async () => {
    invoke.mockResolvedValue({
      data: { candidates: [{ url: "https://adviserinfo.sec.gov/firm/summary/123456", crd: "123456", pdf_url: "https://reports.adviserinfo.sec.gov/reports/ADV/123456/PDF/123456.pdf" }] },
    });
    render(<AdvLookup firm={FIRM} />);
    fireEvent.click(screen.getByTestId("adv-run"));
    await screen.findByTestId("adv-result");
    expect(invoke).toHaveBeenCalledWith("adv-lookup", { firm_id: "f1" });
    expect(screen.getAllByTestId("adv-candidate")).toHaveLength(1);
    expect(screen.getByText("CRD 123456")).toBeTruthy();
    expect(screen.getByText(COPY.advOpenPdf).getAttribute("href")).toContain("/reports/ADV/123456/PDF/");
    expect(screen.getByText(COPY.advCandidatesNote)).toBeTruthy();
  });

  it("says the demo firm has no Form ADV", async () => {
    invoke.mockResolvedValue({ data: { candidates: [], demo: true } });
    render(<AdvLookup firm={FIRM} />);
    fireEvent.click(screen.getByTestId("adv-run"));
    expect((await screen.findByTestId("adv-none")).textContent).toBe(COPY.advDemo);
  });

  it("says nothing was found, and handles denied and failed calls", async () => {
    invoke.mockResolvedValueOnce({ data: { candidates: [] } });
    render(<AdvLookup firm={FIRM} />);
    fireEvent.click(screen.getByTestId("adv-run"));
    expect((await screen.findByTestId("adv-none")).textContent).toBe(COPY.advNone);
    invoke.mockRejectedValueOnce({ response: { status: 403 } });
    fireEvent.click(screen.getByTestId("adv-run"));
    await screen.findByTestId("adv-denied");
    invoke.mockRejectedValueOnce({ response: { status: 500 } });
    fireEvent.click(screen.getByTestId("adv-run"));
    await screen.findByTestId("adv-error");
  });
});
