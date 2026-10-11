// Form ADV lookup on the exam page: one Bright Data search (adv-lookup function) for the firm's record on
// the SEC's adviser site. Shows up to 3 unconfirmed matches with links; the reviewer confirms the firm.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { COPY } from "@/lib/copy";

const button = "rounded-md border border-night-200 px-4 py-2 text-sm text-night-700 hover:bg-paper-100 disabled:opacity-50";
const link = "text-sm text-night-600 underline hover:text-night-950";

export default function AdvLookup({ firm }) {
  // { status: idle | loading | done | denied | error, candidates?, demo? }
  const [state, setState] = useState({ status: "idle" });

  const run = async () => {
    setState({ status: "loading" });
    try {
      const res = await base44.functions.invoke("adv-lookup", { firm_id: firm.id });
      setState({ status: "done", candidates: res.data?.candidates ?? [], demo: Boolean(res.data?.demo) });
    } catch (e) {
      const httpStatus = e?.response?.status ?? e?.status;
      console.warn("Form ADV lookup failed:", httpStatus, e?.response?.data?.error ?? e?.message);
      setState({ status: httpStatus === 401 || httpStatus === 403 ? "denied" : "error" });
    }
  };

  const candidates = state.status === "done" ? state.candidates : [];
  return (
    <section
      aria-label={COPY.advTitle}
      data-testid="adv-lookup"
      className={`space-y-3 rounded-lg border border-paper-200 bg-white p-4 ${candidates.length ? "" : "print:hidden"}`}
    >
      <h2 className="text-lg font-semibold">{COPY.advTitle}</h2>
      <p className="text-sm text-night-700 print:hidden">{COPY.advIntro}</p>
      <button type="button" onClick={run} disabled={state.status === "loading"} data-testid="adv-run" className={`${button} print:hidden`}>
        {state.status === "loading" ? COPY.advRunning : COPY.advRun}
      </button>
      {state.status === "denied" && <p className="text-sm text-night-700" data-testid="adv-denied">{COPY.advDenied}</p>}
      {state.status === "error" && <p className="text-sm text-ember-700" data-testid="adv-error">{COPY.advFailed}</p>}
      {state.status === "done" && candidates.length === 0 && (
        <p className="text-sm text-night-700" data-testid="adv-none">{state.demo ? COPY.advDemo : COPY.advNone}</p>
      )}
      {candidates.length > 0 && (
        <div data-testid="adv-result" className="space-y-2">
          <p className="text-sm text-night-600">{COPY.advCandidatesNote}</p>
          <ul className="space-y-2">
            {candidates.map((c) => (
              <li key={c.url} data-testid="adv-candidate" className="rounded-md border border-paper-200 p-3">
                {c.crd && <div className="text-sm font-medium">{COPY.advCrd(c.crd)}</div>}
                <div className="mt-1 flex flex-wrap gap-3">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className={link}>{COPY.advOpenRecord}</a>
                  {c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className={link}>{COPY.advOpenPdf}</a>}
                </div>
                <div className="mt-1 break-all text-xs text-night-600">{c.url}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
