// Form ADV lookup: one Bright Data SERP query for the firm's public adviser record on the SEC's
// Investment Adviser Public Disclosure site. Pure helpers, no imports: runs on Deno (Base44) and in vitest.
// Results are candidates only; a person confirms the match. Nothing is fetched beyond the search itself.

export const ADV_QUERY = (firmName: string) => `"${firmName.replace(/"/g, "").trim()}" Form ADV site:adviserinfo.sec.gov`;
export const MAX_CANDIDATES = 3;

export interface AdvCandidate {
  url: string;
  crd: string | null;
  pdf_url: string | null; // the Form ADV Part 1 PDF the SEC publishes for that CRD
}

const ADV_HOSTS = /(^|\.)adviserinfo\.sec\.gov$/;

export function advPdfUrl(crd: string): string {
  return `https://reports.adviserinfo.sec.gov/reports/ADV/${crd}/PDF/${crd}.pdf`;
}

/** CRD number from an IAPD URL: /firm/summary/123, /firm/123, or the reports PDF path. */
export function crdFromUrl(url: string): string | null {
  const m = url.match(/\/firm\/(?:summary\/)?(\d{3,})/i) ?? url.match(/\/reports\/ADV\/(\d{3,})\//i);
  return m ? m[1] : null;
}

/** Keeps only adviserinfo.sec.gov results, one per CRD (or per URL when there is none), first MAX_CANDIDATES. */
export function advCandidates(urls: string[]): AdvCandidate[] {
  const out: AdvCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" || !ADV_HOSTS.test(u.host.toLowerCase())) continue;
    const url = `${u.origin}${u.pathname}`;
    const crd = crdFromUrl(url);
    const key = crd ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, crd, pdf_url: crd ? advPdfUrl(crd) : null });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}
