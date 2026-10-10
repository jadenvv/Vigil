// Read-only loaders for the screens. Anonymous users can read Firm, Page, Flag and Decision.
// No LLM calls here: screens only read stored rows, so the demo stays instant.
import { base44 } from "@/api/base44Client";
import { bySeverityDesc, severityScore } from "@/lib/severity";
import { getSessionId } from "@/lib/session";

// Base44 answers 429 when several testers load at once. Reads get exactly one delayed second try
// on 429 only; anything else, or a second 429, surfaces to the error state and its Try again button.
async function read(request) {
  try {
    return await request();
  } catch (error) {
    if (error?.response?.status !== 429 && error?.status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 600));
    return request();
  }
}

export async function findDemoFirm() {
  const firms = await read(() => base44.entities.Firm.filter({ is_demo: true }, "-created_date", 1));
  return firms[0] ?? null;
}

// One Flag request instead of one per page: the per-page fan-out tripped Base44's rate limit.
// The SDK documents no `$in` filter, so flags are matched to this firm's pages here.
// Flag rows are few (one demo firm plus test runs), so a single page of 1000 covers them.
export async function loadInbox(firmId, knownFirm = null) {
  const [firm, pages, allFlags] = await Promise.all([
    knownFirm ?? read(() => base44.entities.Firm.get(firmId)),
    read(() => base44.entities.Page.filter({ firm_id: firmId })),
    read(() => base44.entities.Flag.list("-created_date", 1000)),
  ]);
  const flagsByPage = {};
  for (const flag of allFlags) (flagsByPage[flag.page_id] ??= []).push(flag);
  const groups = pages
    .map((page) => ({ page, flags: [...(flagsByPage[page.id] ?? [])].sort(bySeverityDesc) }))
    .filter((group) => group.flags.length > 0)
    .sort((a, b) => severityScore(b.flags[0]) - severityScore(a.flags[0]));
  const flagCount = groups.reduce((n, group) => n + group.flags.length, 0);
  return { firm, groups, flagCount, pagesScanned: pages.length };
}

export async function loadFlag(flagId) {
  const flag = await read(() => base44.entities.Flag.get(flagId));
  const page = await read(() => base44.entities.Page.get(flag.page_id));
  const firm = await read(() => base44.entities.Firm.get(page.firm_id));
  return { flag, page, firm };
}

// Status shown in the UI comes only from this browser session's decisions, never Flag.status,
// so testers can't see each other's clicks.
export async function loadSessionDecisions() {
  const decisions = await read(() =>
    base44.entities.Decision.filter({ session_id: getSessionId() }, "-decided_at"),
  );
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
