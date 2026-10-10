// Phase 5: suggested rewrite with Approve / Edit / Reject, each writing a session-scoped Decision.
// Hidden behind SHOW_REWRITE until Sense Check 2 is done.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DecisionBadge } from "@/components/Badges";
import { COPY } from "@/lib/copy";
import { recordDecision } from "@/lib/data";

// The rewrite function may not be deployed yet; the drawer still lets a reviewer edit by hand.
async function fetchSuggestion(flagId) {
  try {
    const res = await base44.functions.invoke("rewrite", { flag_id: flagId });
    return { status: "ready", ...res.data };
  } catch (error) {
    console.warn("Rewrite unavailable:", error?.response?.data?.error ?? error?.message);
    return { status: "unavailable" };
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
  const button = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <section aria-label={COPY.rewriteTitle} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{COPY.rewriteTitle}</h2>
        <DecisionBadge decision={decision} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COPY.originalLabel}</h3>
          <p className="mt-1 rounded bg-amber-50 p-2">{flag.span}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{COPY.suggestedLabel}</h3>
          {suggestion.status === "loading" && <div className="mt-1 h-16 animate-pulse rounded bg-slate-200" />}
          {suggestion.status === "unavailable" && !editing && (
            <p className="mt-1 rounded bg-slate-50 p-2 text-slate-500">{COPY.rewriteUnavailable}</p>
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
      <div className="mt-4 flex flex-wrap gap-2">
        {!editing && (
          <>
            <button
              type="button"
              disabled={saving || suggestion.status !== "ready"}
              onClick={() => decide("approve", suggested)}
              className={`${button} bg-slate-900 text-white hover:bg-slate-800`}
            >
              {COPY.approve}
            </button>
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
              disabled={saving || !draft.trim()}
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
