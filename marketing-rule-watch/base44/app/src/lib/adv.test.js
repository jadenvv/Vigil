import { describe, expect, it } from "vitest";
import { ADV_QUERY, advCandidates, crdFromUrl, MAX_CANDIDATES } from "../../base44/shared/adv.ts";

describe("Form ADV helpers", () => {
  it("builds one site-restricted query and strips quotes from the name", () => {
    expect(ADV_QUERY('Example "Wealth" Advisers ')).toBe('"Example Wealth Advisers" Form ADV site:adviserinfo.sec.gov');
  });

  it("reads the CRD from record and PDF URLs", () => {
    expect(crdFromUrl("https://adviserinfo.sec.gov/firm/summary/123456")).toBe("123456");
    expect(crdFromUrl("https://adviserinfo.sec.gov/firm/123456")).toBe("123456");
    expect(crdFromUrl("https://reports.adviserinfo.sec.gov/reports/ADV/123456/PDF/123456.pdf")).toBe("123456");
    expect(crdFromUrl("https://adviserinfo.sec.gov/")).toBeNull();
  });

  it("keeps only SEC adviser-site results, one per CRD, capped", () => {
    const out = advCandidates([
      "https://example.com/firm/summary/999",
      "https://adviserinfo.sec.gov.evil.example/firm/summary/111",
      "http://adviserinfo.sec.gov/firm/summary/222",
      "https://adviserinfo.sec.gov/firm/summary/123456?tab=x",
      "https://reports.adviserinfo.sec.gov/reports/ADV/123456/PDF/123456.pdf",
      "https://adviserinfo.sec.gov/firm/summary/2",
      "https://adviserinfo.sec.gov/firm/summary/3333",
      "https://adviserinfo.sec.gov/firm/summary/4444",
      "https://adviserinfo.sec.gov/firm/summary/5555",
      "not a url",
    ]);
    expect(out).toHaveLength(MAX_CANDIDATES);
    expect(out[0]).toEqual({
      url: "https://adviserinfo.sec.gov/firm/summary/123456",
      crd: "123456",
      pdf_url: "https://reports.adviserinfo.sec.gov/reports/ADV/123456/PDF/123456.pdf",
    });
    expect(out[1]).toEqual({ url: "https://adviserinfo.sec.gov/firm/summary/2", crd: null, pdf_url: null });
    expect(out[2].crd).toBe("3333");
  });
});
