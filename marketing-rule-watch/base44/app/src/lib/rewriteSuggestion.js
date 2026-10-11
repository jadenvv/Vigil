// Rewrite suggestions are fetched only when the reviewer asks: each call spends LLM quota,
// and calling on every flag view used up a monthly quota in one afternoon. Shared by the
// anonymous RewriteDrawer and the signed-in reviewer workspace.
import { base44 } from "@/api/base44Client";
import { COPY, FETCH_REWRITE_SUGGESTIONS } from "@/lib/copy";

// Per flag id, for this page session, so reopening a flag never calls the LLM again.
const suggestionCache = new Map();

// rewrite writes nothing; it returns {original_text, suggested_text, flags_total, flags_cleared, placeholders}.
// 503 = no model available, 502 = no usable suggestion, 401 = not allowed.
export async function fetchSuggestion(flagId) {
  try {
    const res = await base44.functions.invoke("rewrite", { flag_id: flagId });
    const result = { status: "ready", ...res.data };
    suggestionCache.set(flagId, result);
    return result;
  } catch (error) {
    const httpStatus = error?.response?.status;
    console.warn("Rewrite unavailable:", httpStatus, error?.response?.data?.error ?? error?.message);
    if (httpStatus === 503) {
      const result = { status: "manual" };
      suggestionCache.set(flagId, result);
      return result;
    }
    if (httpStatus === 502) {
      const result = { status: "unavailable", message: COPY.rewriteNoSuggestion };
      suggestionCache.set(flagId, result);
      return result;
    }
    // Network or unknown errors are not cached, so the reviewer can click Suggest again.
    return { status: "unavailable", message: COPY.rewriteFailed, canRetry: true };
  }
}

export function initialSuggestionState(flagId) {
  if (!FETCH_REWRITE_SUGGESTIONS) return { status: "manual" };
  return suggestionCache.get(flagId) ?? { status: "idle" };
}
