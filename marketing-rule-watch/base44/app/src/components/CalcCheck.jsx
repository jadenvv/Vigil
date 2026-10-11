// Check calculation: the reviewer supplies the numbers behind a return claim and the
// check-calculation function verifies the arithmetic. Nothing is written to entities;
// any input edit invalidates the previous result so it is never read against new numbers.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { COPY } from "@/lib/copy";
import { quoted } from "@/lib/highlight";

// check_type -> the numeric inputs the backend expects, in display order.
const CHECK_TYPES = {
  cumulative: [
    ["start_value", COPY.calcStartValue],
    ["end_value", COPY.calcEndValue],
  ],
  compounded: [
    ["annual_return_pct", COPY.calcAnnualReturn],
    ["years", COPY.calcYears],
  ],
};

const inputClass = "mt-1 w-full rounded border border-night-200 px-2 py-1";
const button = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";

export default function CalcCheck({ flag }) {
  const [open, setOpen] = useState(false);
  const [checkType, setCheckType] = useState("cumulative");
  const [values, setValues] = useState({ start_value: "", end_value: "", annual_return_pct: "", years: "", stated_pct: "" });
  const [assumed, setAssumed] = useState(false);
  // { status: idle | loading | done | invalid | denied | cooldown | error, result?, missing? }
  const [state, setState] = useState({ status: "idle" });
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setOpen(false);
    setCheckType("cumulative");
    setValues({ start_value: "", end_value: "", annual_return_pct: "", years: "", stated_pct: "" });
    setAssumed(false);
    setState({ status: "idle" });
    setStale(false);
  }, [flag.id]);

  // Any edit invalidates the previous result; a done result stays visible but marked stale.
  const invalidate = () => {
    if (state.status === "done") setStale(true);
    else if (state.status !== "loading") setState({ status: "idle" });
  };
  const setField = (name) => (event) => {
    setValues((v) => ({ ...v, [name]: event.target.value }));
    invalidate();
  };
  const pickType = (type) => {
    setCheckType(type);
    invalidate();
  };

  const fields = [...CHECK_TYPES[checkType], ["stated_pct", COPY.calcStatedPct]];
  const missing = fields.filter(([name]) => values[name].trim() === "" || !Number.isFinite(Number(values[name]))).map(([, label]) => label);
  const needsAssumption = checkType === "cumulative" && !assumed;
  const canRun = state.status !== "loading" && missing.length === 0 && !needsAssumption;

  const run = async () => {
    if (missing.length > 0) {
      setState({ status: "invalid", missing });
      return;
    }
    if (needsAssumption) {
      setState({ status: "invalid", missing: [COPY.calcAssumption] });
      return;
    }
    const inputs = {};
    for (const [name] of CHECK_TYPES[checkType]) inputs[name] = Number(values[name]);
    const payload = { check_type: checkType, inputs, stated_pct: Number(values.stated_pct) };
    if (checkType === "cumulative") payload.assumption_confirmed = true;
    setStale(false);
    setState({ status: "loading" });
    try {
      const res = await base44.functions.invoke("check-calculation", payload);
      setState({ status: "done", result: res.data });
    } catch (e) {
      const httpStatus = e?.response?.status ?? e?.status;
      const body = e?.response?.data ?? {};
      console.warn("Calculation check failed:", httpStatus, body?.error ?? e?.message);
      if (httpStatus === 400) {
        // invalid_input: report what the backend says is missing; no re-fire until inputs change.
        setState({ status: "invalid", missing: Array.isArray(body.missing) ? body.missing : [] });
      } else if (httpStatus === 401 || httpStatus === 403) {
        setState({ status: "denied" });
      } else if (httpStatus === 429) {
        setState({ status: "cooldown" });
      } else {
        setState({ status: "error" });
      }
    }
  };

  const r = state.result;
  return (
    <section aria-label={COPY.calcCheckTitle} data-testid="calc-check" className="rounded-lg border border-paper-200 bg-white p-4 text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="calc-check-toggle"
          className="rounded-md border border-night-200 px-2 py-1 text-night-700 hover:bg-paper-100"
        >
          {COPY.calcCheckTitle}
        </button>
      ) : (
        <>
          <h2 className="font-semibold">{COPY.calcCheckTitle}</h2>
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.calcCheckQuoteLabel}</h3>
            <blockquote className="mt-1 rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-3 py-2 font-mono">{quoted(flag.span)}</blockquote>
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-night-600">{COPY.calcTypeLabel}</h3>
            <div className="mt-1 flex gap-1" role="group" aria-label={COPY.calcTypeLabel}>
              {[
                ["cumulative", COPY.calcTypeCumulative],
                ["compounded", COPY.calcTypeCompounded],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={checkType === key}
                  onClick={() => pickType(key)}
                  data-testid={`calc-check-type-${key}`}
                  className={`rounded px-2 py-1 text-xs ${checkType === key ? "bg-night-950 text-paper-50" : "text-night-600 hover:bg-paper-100"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fields.map(([name, label]) => (
              <label key={name} className="block text-xs font-medium text-night-700">
                {label}
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[name]}
                  onChange={setField(name)}
                  aria-label={label}
                  data-testid={`calc-check-input-${name}`}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          {checkType === "cumulative" ? (
            <label className="mt-3 flex items-start gap-2 text-xs text-night-700">
              <input
                type="checkbox"
                checked={assumed}
                onChange={(e) => {
                  setAssumed(e.target.checked);
                  invalidate();
                }}
                data-testid="calc-check-assumption"
                className="mt-0.5"
              />
              {COPY.calcAssumption}
            </label>
          ) : (
            <p className="mt-3 text-xs text-night-600">{COPY.calcCompoundedNote}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              data-testid="calc-check-run"
              className={`${button} bg-night-950 text-paper-50 hover:bg-night-800`}
            >
              {state.status === "loading" ? COPY.calcRunning : COPY.calcRun}
            </button>
            {missing.length > 0 && state.status !== "loading" && (
              <p role="status" data-testid="calc-check-missing" className="text-xs text-night-600">
                {COPY.calcMissing(missing)}
              </p>
            )}
            {needsAssumption && missing.length === 0 && (
              <p role="status" className="text-xs text-night-600">
                {COPY.calcMissing([COPY.calcAssumption])}
              </p>
            )}
          </div>
          {state.status === "loading" && <div aria-busy="true" aria-label={COPY.calcRunning} className="mt-3 h-16 animate-pulse rounded bg-paper-200" />}
          {state.status === "done" && r && (
            <div data-testid="calc-check-result" className="mt-3 space-y-2 rounded bg-paper-50 p-3">
              <p>
                <span
                  data-testid="calc-check-verdict"
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${r.match ? "bg-sage-100 text-sage-700" : "bg-lamp-100 text-lamp-700"}`}
                >
                  {r.match ? COPY.calcMatch : COPY.calcMismatch}
                </span>
              </p>
              <p className="font-mono text-xs text-night-700">
                {COPY.calcStatedLabel} {r.stated_pct}% · {COPY.calcCalculatedLabel} {r.calculated_pct}%
              </p>
              {r.formula && <p className="font-mono text-xs text-night-700">{r.formula}</p>}
              {r.explanation && <p className="text-night-700">{r.explanation}</p>}
              <p className="text-xs text-night-600">
                {COPY.calcCheckedAt(formatDate(r.checked_at))}
                {r.cached ? ` · ${COPY.calcCached}` : ""}
              </p>
            </div>
          )}
          {stale && (
            <p role="status" data-testid="calc-check-stale" className="mt-2 text-xs text-night-600">
              {COPY.calcStale}
            </p>
          )}
          {state.status === "invalid" && (
            <p role="alert" className="mt-2 text-xs text-ember-700">
              {COPY.calcInvalid(state.missing ?? [])}
            </p>
          )}
          {state.status === "denied" && (
            <p role="status" data-testid="calc-check-denied" className="mt-2 text-xs text-night-600">
              {COPY.calcDenied}
            </p>
          )}
          {state.status === "cooldown" && (
            <p role="status" data-testid="calc-check-cooldown" className="mt-2 text-xs text-night-600">
              {COPY.calcCooldown}
            </p>
          )}
          {state.status === "error" && (
            <p role="status" data-testid="calc-check-error" className="mt-2 text-xs text-night-600">
              {COPY.calcServiceError}
            </p>
          )}
          <p className="mt-3 text-xs text-night-600">{COPY.calcNote}</p>
        </>
      )}
    </section>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
