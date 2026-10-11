// Rewrite drawer: Approve / Edit / Dismiss. With the default `record` it writes a session-scoped
// Decision (anonymous demo); the reviewer workspace passes a Clerk-backed `record` instead.
// Suggestions are fetched only when the reviewer asks: each rewrite call costs LLM quota,
// and calling on every flag view used up a monthly quota in one afternoon.
import { useEffect, useMemo, useRef, useState } from "react";
import { DecisionBadge } from "@/components/Badges";
import { COPY } from "@/lib/copy";
import { recordDecision } from "@/lib/data";
import { fetchSuggestion, initialSuggestionState } from "@/lib/rewriteSuggestion";
import { newRequestId } from "@/lib/session";
import { readableWordDiff } from "@/lib/wordDiff";

// Renders one side of a word diff. Changes carry <del>/<ins> semantics plus visually hidden
// "removed:"/"added:" text, so the change never relies on color or strike-through alone.
function DiffText({ segments }) {
  return segments.map((segment, index) => {
    const spacer = index > 0 ? " " : "";
    if (segment.type === "del") {
      return (
        <span key={index}>
          {spacer}
          <del className="text-night-600 line-through decoration-night-600 decoration-1">
            <span className="sr-only">{COPY.diffRemoved} </span>
            {segment.text}
          </del>
        </span>
      );
    }
    if (segment.type === "add") {
      return (
        <span key={index}>
          {spacer}
          <ins className="font-medium text-sage-700 underline decoration-sage-700 decoration-2 underline-offset-2">
            <span className="sr-only">{COPY.diffAdded} </span>
            {segment.text}
          </ins>
        </span>
      );
    }
    return <span key={index}>{spacer + segment.text}</span>;
  });
}

export default function RewriteDrawer({ flag, decision, onDecided, record = recordDecision }) {
  const [suggestion, setSuggestion] = useState(() => initialSuggestionState(flag.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => initialSuggestionState(flag.id).suggested_text ?? flag.span);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showChanges, setShowChanges] = useState(true);
  // One idempotency key per decision intent: retries reuse it, a saved decision mints a new one.
  const requestIdRef = useRef(newRequestId());

  useEffect(() => {
    const state = initialSuggestionState(flag.id);
    setSuggestion(state);
    setDraft(state.suggested_text ?? flag.span);
    setEditing(false);
  }, [flag.id, flag.span]);

  const requestSuggestion = async () => {
    if (suggestion.status === "loading") return;
    setSuggestion({ status: "loading" });
    const result = await fetchSuggestion(flag.id);
    setSuggestion(result);
    if (result.suggested_text) setDraft(result.suggested_text);
  };

  const decide = async (action, finalText) => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await record({ flagId: flag.id, action, finalText, requestId: requestIdRef.current });
      requestIdRef.current = newRequestId();
      setEditing(false);
      onDecided?.(created);
    } catch (error) {
      setSaveError(error?.response?.data?.error ?? error?.message ?? COPY.loadError);
    } finally {
      setSaving(false);
    }
  };

  const { status } = suggestion;
  const suggested = suggestion.suggested_text;
  const placeholders = Array.isArray(suggestion.placeholders) ? suggestion.placeholders : [];
  // Bracketed facts like [X] must be filled in by a person before anything is approved.
  const unfilledInDraft = placeholders.filter((placeholder) => draft.includes(placeholder));
  const showSecondColumn = editing || status === "loading" || status === "ready" || status === "unavailable";
  const canSuggest = status === "idle" || (status === "unavailable" && suggestion.canRetry);
  const originalText = suggestion.original_text ?? flag.span;
  // Display only: the diff never feeds into what Approve / Edit / Dismiss save.
  // Null past the token cap or when the rewrite is mostly new; then both sides show plain, with no toggle.
  const diff = useMemo(
    () => (status === "ready" && suggested ? readableWordDiff(originalText, suggested) : null),
    [status, originalText, suggested],
  );
  const showDiff = Boolean(diff) && showChanges && !editing;
  const button = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <section aria-label={COPY.rewriteTitle} className="rounded-lg border border-paper-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{status === "ready" ? COPY.rewriteTitle : COPY.manualRewriteTitle}</h2>
        <DecisionBadge decision={decision} />
      </div>
      <div className={`mt-3 grid gap-3 ${showSecondColumn ? "sm:grid-cols-2" : ""}`}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.originalLabel}</h3>
          <p data-testid="original-text" className="mt-1 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono">
            {showDiff ? <DiffText segments={diff.original} /> : originalText}
          </p>
        </div>
        {showSecondColumn && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-night-600">
              {status === "ready" ? COPY.suggestedLabel : COPY.yourRewriteLabel}
            </h3>
            {status === "loading" && !editing && (
              <div aria-busy="true" aria-label="Loading suggestion" className="mt-1 h-16 animate-pulse rounded bg-paper-200" />
            )}
            {status === "unavailable" && !editing && (
              <p className="mt-1 rounded bg-paper-50 p-2 text-night-600">{suggestion.message}</p>
            )}
            {status === "ready" && !editing && (
              <p data-testid="suggested-text" className="mt-1 rounded bg-sage-100 p-2">
                {showDiff ? <DiffText segments={diff.suggested} /> : suggested}
              </p>
            )}
            {editing && (
              <textarea
                aria-label={COPY.yourRewriteLabel}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1 h-28 w-full rounded border border-night-200 p-2"
              />
            )}
          </div>
        )}
      </div>
      {diff && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-night-600">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showChanges}
              onChange={(event) => setShowChanges(event.target.checked)}
              className="h-3.5 w-3.5 accent-night-950"
            />
            {COPY.showChanges}
          </label>
          {showChanges && <span>{COPY.diffLegend}</span>}
        </div>
      )}
      {status === "ready" && typeof suggestion.flags_total === "number" && (
        <p className="mt-2 text-xs text-night-600">
          {COPY.flagsCleared(suggestion.flags_cleared ?? 0, suggestion.flags_total)}
        </p>
      )}
      {placeholders.length > 0 && (
        <p data-testid="placeholders-note" className="mt-2 text-xs text-lamp-700">
          {COPY.placeholdersNote(placeholders)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!editing && (
          <>
            {(canSuggest || status === "loading") && (
              <button
                type="button"
                disabled={status === "loading" || saving}
                onClick={requestSuggestion}
                className={`${button} bg-night-950 text-paper-50 hover:bg-night-800`}
              >
                {status === "loading" ? COPY.suggesting : COPY.suggestRewrite}
              </button>
            )}
            {status === "ready" && (
              <button
                type="button"
                disabled={saving || placeholders.length > 0}
                onClick={() => decide("approve", suggested)}
                className={`${button} bg-night-950 text-paper-50 hover:bg-night-800`}
              >
                {COPY.approve}
              </button>
            )}
            <button
              type="button"
              disabled={saving || status === "loading"}
              onClick={() => setEditing(true)}
              className={`${button} border border-night-200 hover:bg-paper-50`}
            >
              {COPY.edit}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => decide("reject", "")}
              className={`${button} border border-night-200 hover:bg-paper-50`}
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
              className={`${button} bg-night-950 text-paper-50 hover:bg-night-800`}
            >
              {COPY.saveEdit}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className={`${button} border border-night-200 hover:bg-paper-50`}
            >
              {COPY.cancel}
            </button>
          </>
        )}
      </div>
      {saveError && (
        <p role="alert" className="mt-2 text-xs text-ember-700">
          {saveError}
        </p>
      )}
    </section>
  );
}
