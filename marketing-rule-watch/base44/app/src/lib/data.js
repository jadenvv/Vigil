// Read-only loaders for the screens. Anonymous users can read Firm, Page, Flag and Decision.
// No LLM calls here: screens only read stored rows, so the demo stays instant.
import { base44 } from "@/api/base44Client";
import { bySeverityDesc, severityScore } from "@/lib/severity";
import { getSessionId } from "@/lib/session";

export async function findDemoFirm() {
  const firms = await base44.entities.Firm.filter({ is_demo: true }, "-created_date", 1);
  return firms[0] ?? null;
}

// The SDK documents no `$in` filter, so flags are fetched per page in parallel.
export async function loadInbox(firmId) {
  const [firm, pages] = await Promise.all([
    base44.entities.Firm.get(firmId),
    base44.entities.Page.filter({ firm_id: firmId }),
  ]);
  const flagsPerPage = await Promise.all(pages.map((page) => base44.entities.Flag.filter({ page_id: page.id })));
  const groups = pages
    .map((page, i) => ({ page, flags: [...flagsPerPage[i]].sort(bySeverityDesc) }))
    .filter((group) => group.flags.length > 0)
    .sort((a, b) => severityScore(b.flags[0]) - severityScore(a.flags[0]));
  const flagCount = groups.reduce((n, group) => n + group.flags.length, 0);
  return { firm, groups, flagCount, pagesScanned: pages.length };
}

export async function loadFlag(flagId) {
  const flag = await base44.entities.Flag.get(flagId);
  const page = await base44.entities.Page.get(flag.page_id);
  const firm = await base44.entities.Firm.get(page.firm_id);
  return { flag, page, firm };
}

// Status shown in the UI comes only from this browser session's decisions, never Flag.status,
// so testers can't see each other's clicks.
export async function loadSessionDecisions() {
  const decisions = await base44.entities.Decision.filter({ session_id: getSessionId() }, "-decided_at");
  const latestByFlag = {};
  for (const decision of decisions) {
    if (!latestByFlag[decision.flag_id]) latestByFlag[decision.flag_id] = decision;
  }
  return latestByFlag;
}

export async function recordDecision({ flagId, action, finalText }) {
  return base44.entities.Decision.create({
    flag_id: flagId,
    action,
    final_text: finalText ?? "",
    decided_at: new Date().toISOString(),
    session_id: getSessionId(),
  });
}
