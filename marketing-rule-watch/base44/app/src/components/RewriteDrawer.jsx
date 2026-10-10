// Phase 5: suggested rewrite with Approve / Edit / Reject, each writing a session-scoped Decision.
// Hidden behind SHOW_REWRITE until Sense Check 2 is done.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DecisionBadge } from "@/components/Badges";
import { COPY, FETCH_REWRITE_SUGGESTIONS } from "@/lib/copy";
import { recordDecision } from "@/lib/data";

// rewrite writes nothing; it returns {original_text, suggested_text, flags_total, flags_cleared, placeholders}.
// 503 = no model key yet, 502 = no usable suggestion, 401 = not allowed. Every failure still allows a manual edit.
async function fetchSuggestion(flagId) {
  if (!FETCH_REWRITE_SUGGESTIONS) return { status: "manual" };
  try {
    const res = await base44.functions.invoke("rewrite", { flag_id: flagId });
    return { status: "ready", ...res.data };
  } catch (error) {
    const httpStatus = error?.response?.status;
    console.warn("Rewrite unavailable:", httpStatus, error?.response?.data?.error ?? error?.message);
    const message =
      httpStatus === 503 ? COPY.rewriteUnavailable : httpStatus === 502 ? COPY.rewriteNoSuggestion : COPY.rewriteFailed;
    // 503 means no model is configured at all: show a manual-only drawer instead of an error on every flag.
    if (httpStatus === 503) return { status: "manual" };
    return { status: "unavailable", message };
  }
}

export default function RewriteDrawer({ flag, decision, onDecided }) {
  const [suggestion, setSuggestion] = useState({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSuggestion({ status: "loading" });
    fetchSuggestion(flag.id).then((result) => {
      if (cancelled) return;
      setSuggestion(result);
      setDraft(result.suggested_text ?? flag.span);
    });
    return () => {
      cancelled = true;
    };
  }, [flag.id, flag.span]);

  const decide = async (action, finalText) => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await recordDecision({ flagId: flag.id, action, finalText });
      setEditing(false);
      onDecided?.(created);
    } catch (error) {
      setSaveError(error?.response?.data?.error ?? error?.message ?? COPY.loadError);
    } finally {
      setSaving(false);
    }
  };

  const suggested = suggestion.suggested_text;
  const placeholders = Array.isArray(suggestion.placeholders) ? suggestion.placeholders : [];
  // Bracketed facts like [X] must be filled in by a person before anything is approved.
  const unfilledInDraft = placeholders.filter((placeholder) => draft.includes(placeholder));
  const button = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <section aria-label={COPY.rewriteTitle} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{suggestion.status === "manual" ? COPY.manualRewriteTitle : COPY.rewriteTitle}</h2>
        <DecisionBadge decision={decision} />
      </div>
      <div className={`mt-3 grid gap-3 ${suggestion.status === "manual" && !editing ? "" : "sm:grid-cols-2"}`}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COPY.originalLabel}</h3>
          <p className="mt-1 rounded bg-amber-50 p-2">{suggestion.original_text ?? flag.span}</p>
        </div>
        <div hidden={suggestion.status === "manual" && !editing}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {suggestion.status === "manual" ? COPY.yourRewriteLabel : COPY.suggestedLabel}
          </h3>
          {suggestion.status === "loading" && <div className="mt-1 h-16 animate-pulse rounded bg-slate-200" />}
          {suggestion.status === "unavailable" && !editing && (
            <p className="mt-1 rounded bg-slate-50 p-2 text-slate-500">{suggestion.message}</p>
          )}
          {suggestion.status === "ready" && !editing && (
            <p data-testid="suggested-text" className="mt-1 rounded bg-emerald-50 p-2">
              {suggested}
            </p>
          )}
          {editing && (
            <textarea
              aria-label={COPY.suggestedLabel}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-1 h-28 w-full rounded border border-slate-300 p-2"
            />
          )}
        </div>
      </div>
      {suggestion.status === "ready" && typeof suggestion.flags_total === "number" && (
        <p className="mt-2 text-xs text-slate-500">
          {COPY.flagsCleared(suggestion.flags_cleared ?? 0, suggestion.flags_total)}
        </p>
      )}
      {placeholders.length > 0 && (
        <p data-testid="placeholders-note" className="mt-2 text-xs text-amber-800">
          {COPY.placeholdersNote(placeholders)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!editing && (
          <>
            {suggestion.status !== "manual" && (
            <button
              type="button"
              disabled={saving || suggestion.status !== "ready" || placeholders.length > 0}
              onClick={() => decide("approve", suggested)}
              className={`${button} bg-slate-900 text-white hover:bg-slate-800`}
            >
              {COPY.approve}
            </button>
            )}
            <button
              type="button"
              disabled={saving || suggestion.status === "loading"}
              onClick={() => setEditing(true)}
              className={`${button} border border-slate-300 hover:bg-slate-50`}
            >
              {COPY.edit}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => decide("reject", "")}
              className={`${button} border border-slate-300 hover:bg-slate-50`}
            >
              {COPY.reject}
            </button>
          </>
        )}
        {editing && (
          <>
            <button
              type="button"
              disabled={saving || !draft.trim() || unfilledInDraft.length > 0}
              onClick={() => decide("edit", draft.trim())}
              className={`${button} bg-slate-900 text-white hover:bg-slate-800`}
            >
              {COPY.saveEdit}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className={`${button} border border-slate-300 hover:bg-slate-50`}
            >
              {COPY.cancel}
            </button>
          </>
        )}
      </div>
      {saveError && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {saveError}
        </p>
      )}
    </section>
  );
}
