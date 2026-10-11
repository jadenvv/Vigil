// Cross-document check: every absolute claim and checkable fact on the firm's latest pages, checked
// against its other pages plus documents the reviewer adds (Form ADV, old posts). Calls the admin-only
// crossref function; nothing is written to entities. Files are read in the browser and sent with the call.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { COPY } from "@/lib/copy";
import { buildMarksCsv, downloadCsv, marksFilename } from "@/lib/evidenceCsv";
import { quoted } from "@/lib/highlight";

const MAX_DOCS = 3;
const MAX_CHARS = 60_000;

export const MARK_GROUPS = [
  ["high", COPY.crossGroupContradicted, "bg-ember-100 text-ember-700"],
  ["review", COPY.crossGroupAbsolute, "bg-lamp-100 text-lamp-700"],
  ["info", COPY.crossGroupFact, "bg-dusk-100 text-dusk-700"],
];

const button = "rounded-md border border-night-200 px-4 py-2 text-sm text-night-700 hover:bg-paper-100 disabled:opacity-50";

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function CrossCheck({ firm }) {
  const [docs, setDocs] = useState([]); // [{url, markdown}]
  const [notice, setNotice] = useState("");
  // { status: idle | loading | done | denied | cooldown | error, marks?, model? }
  const [state, setState] = useState({ status: "idle" });

  const addFiles = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const added = [];
    const skipped = [];
    for (const file of files) {
      if (docs.length + added.length >= MAX_DOCS) break;
      const markdown = await readFile(file).catch(() => "");
      if (markdown.length > MAX_CHARS) skipped.push(file.name);
      else if (markdown.trim()) added.push({ url: file.name, markdown });
    }
    setNotice(skipped.map(COPY.crossDocTooLong).join(" "));
    setDocs((d) => [...d, ...added].slice(0, MAX_DOCS));
    setState({ status: "idle" });
  };

  const run = async () => {
    setState({ status: "loading" });
    try {
      const res = await base44.functions.invoke("crossref", { firm_id: firm.id, docs });
      setState({ status: "done", marks: res.data?.marks ?? [], model: res.data?.model ?? "" });
    } catch (e) {
      const httpStatus = e?.response?.status ?? e?.status;
      console.warn("Cross-document check failed:", httpStatus, e?.response?.data?.error ?? e?.message);
      if (httpStatus === 401 || httpStatus === 403) setState({ status: "denied" });
      else if (httpStatus === 429 || httpStatus === 503) setState({ status: "cooldown" });
      else setState({ status: "error" });
    }
  };

  const marks = state.status === "done" ? state.marks : [];
  return (
    <section
      aria-label={COPY.crossTitle}
      data-testid="cross-check"
      className={`space-y-3 rounded-lg border border-paper-200 bg-white p-4 ${state.status === "done" && marks.length ? "" : "print:hidden"}`}
    >
      <h2 className="text-lg font-semibold">{COPY.crossTitle}</h2>
      <p className="text-sm text-night-700 print:hidden">{COPY.crossIntro}</p>
      <div className="space-y-2 print:hidden">
        <label className="block text-sm text-night-700">
          {COPY.crossAddDocs}
          <input
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            multiple
            disabled={docs.length >= MAX_DOCS || state.status === "loading"}
            onChange={addFiles}
            data-testid="cross-check-files"
            className="mt-1 block text-xs"
          />
        </label>
        <p className="text-xs text-night-600">{COPY.crossAddDocsHelp}</p>
        {notice && (
          <p role="alert" className="text-xs text-ember-700">
            {notice}
          </p>
        )}
        {docs.length > 0 && (
          <ul className="space-y-1 text-xs text-night-700" data-testid="cross-check-docs">
            {docs.map((d, i) => (
              <li key={`${d.url}-${i}`} className="flex items-center gap-2">
                <span className="break-all font-mono">{d.url}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDocs((all) => all.filter((_, j) => j !== i));
                    setState({ status: "idle" });
                  }}
                  className="text-night-600 underline hover:text-night-950"
                >
                  {COPY.crossRemoveDoc}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={run} disabled={state.status === "loading"} data-testid="cross-check-run" className={button}>
            {COPY.crossRun}
          </button>
          {marks.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCsv(marksFilename(firm), buildMarksCsv(marks))}
              data-testid="cross-check-csv"
              className={button}
            >
              {COPY.crossDownloadCsv}
            </button>
          )}
        </div>
      </div>
      {state.status === "loading" && (
        <p role="status" aria-busy="true" className="text-sm text-night-600">
          {COPY.crossRunning}
        </p>
      )}
      {state.status === "denied" && <p role="status" data-testid="cross-check-denied" className="text-sm text-night-600">{COPY.crossDenied}</p>}
      {state.status === "cooldown" && <p role="status" data-testid="cross-check-cooldown" className="text-sm text-night-600">{COPY.crossCooldown}</p>}
      {state.status === "error" && <p role="status" data-testid="cross-check-error" className="text-sm text-night-600">{COPY.crossServiceError}</p>}
      {state.status === "done" && (
        <div data-testid="cross-check-result" className="space-y-4">
          <p className="text-sm text-night-600">
            {marks.length ? COPY.crossCount(marks.length) : COPY.crossNone}
            {state.model ? ` ${COPY.crossModel(state.model)}` : ""}
          </p>
          {MARK_GROUPS.map(([severity, label, style]) => {
            const group = marks.filter((m) => m.severity === severity);
            if (!group.length) return null;
            return (
              <div key={severity} data-testid={`cross-group-${severity}`} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{group.length}</span>
                  {label}
                </h3>
                <ol className="space-y-3">
                  {group.map((m, i) => (
                    <li key={i} data-testid="cross-mark" className="break-inside-avoid rounded-lg border border-paper-200 p-3 print:border-night-300">
                      <p className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.crossClaimLabel}</p>
                      <blockquote className="mt-1 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono text-sm">{quoted(m.claim_span)}</blockquote>
                      <p className="mt-1 break-all text-xs text-night-600">{m.claim_url}</p>
                      {m.evidence_span && (
                        <>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.crossEvidenceLabel}</p>
                          <blockquote className="mt-1 rounded-r-md border-l-[3px] border-ember-600 bg-ember-100 px-3 py-2 font-mono text-sm">{quoted(m.evidence_span)}</blockquote>
                          <p className="mt-1 break-all text-xs text-night-600">{m.evidence_url}</p>
                        </>
                      )}
                      {m.why && <p className="mt-2 text-sm text-night-700">{m.why}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          <p className="text-xs text-night-600">{COPY.crossNote}</p>
        </div>
      )}
    </section>
  );
}
