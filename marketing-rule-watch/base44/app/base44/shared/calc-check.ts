// "Check the calculation" (reviewer tool): recompute the arithmetic behind a stated return claim in a
// Daytona Python sandbox and report whether the stated percentage matches the calculation.
// ARITHMETIC ONLY. A match means the math is consistent with the inputs; it never verifies the
// underlying performance was real or the claim is compliant.
//
// Two check types:
//   cumulative  inputs {start_value > 0, end_value >= 0}  ->  (end/start - 1) * 100
//               assumes no deposits or withdrawals; the caller must confirm that by sending
//               assumption_confirmed: true or the check is rejected.
//   compounded  inputs {annual_return_pct >= -100, years: integer 1..MAX_YEARS}  ->  ((1+r/100)^years - 1) * 100
//               constant annual rate, compounded annually.
//
// Contract for functions/check-calculation:
//   POST {check_type, inputs: {...}, stated_pct, assumption_confirmed?}  (flag_id optional, log only)
//   -> 200 {ok:true, stated_pct, calculated_pct, difference_pp, match, formula, explanation,
//           tolerance_pp, checked_at, cached?}
//   -> 400 {error:"invalid_input", missing, details} | 401 | 429 {error:"cooldown", retry_after}
//   -> 502 {error:"calc_check_failed"} | 503 {error:"calc_service_unavailable"}
//
// Secret: DAYTONA_API_KEY (npx base44 secrets set --env-file ../../.env), read like llm.ts reads its
// secrets (base44:runtime, Deno.env fallback) but lazily so this file stays runnable under plain deno.
// Nothing is persisted; a check is read-only arithmetic.
// Self-check: deno run --allow-run --allow-env=DAYTONA_API_KEY base44/app/base44/shared/calc-check.ts

export const TOLERANCE_PP = 0.05; // percentage points
export const MAX_YEARS = 100;
const MAX_ABS = 1e12; // absurd-magnitude cap on every numeric input
const RUN_TIMEOUT_S = 30;
const MAX_OUTPUT = 8 * 1024; // script prints one small JSON line; anything bigger is an error

/** The sandbox couldn't be used at all (no key, create failed) — entry maps this to 503. */
export class DaytonaUnavailable extends Error {}
/** The sandbox ran but the run failed (nonzero exit, timeout, bad output) — entry maps this to 502. */
export class CalcRunFailed extends Error {}

export interface Validation {
  ok: boolean;
  missing: string[];
  errors: string[];
}

export interface CheckSpec {
  check_type: "cumulative" | "compounded";
  inputs: Record<string, number>;
  stated_pct: number;
  tolerance_pp: number;
  max_years: number;
}

export interface CheckResult {
  ok: true;
  stated_pct: number;
  calculated_pct: number;
  difference_pp: number;
  match: boolean;
  formula: string;
  explanation: string;
  tolerance_pp: number;
  checked_at: string;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function checkRange(name: string, v: number, errors: string[]): void {
  if (Math.abs(v) > MAX_ABS) errors.push(`${name} out of range (|value| <= ${MAX_ABS})`);
}

/**
 * Validate the request body. Never returns a spec — callers must not launch a sandbox when !ok.
 * `missing` = absent/non-numeric required fields; `errors` = values that failed a range/shape rule.
 */
export function validateCheck(body: unknown): Validation {
  const missing: string[] = [];
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const type = b.check_type;
  const inputs = (b.inputs ?? {}) as Record<string, unknown>;

  if (type !== "cumulative" && type !== "compounded") {
    errors.push("check_type must be 'cumulative' or 'compounded'");
  }

  const stated = num(b.stated_pct);
  if (stated === null) {
    if (b.stated_pct === undefined || b.stated_pct === null) missing.push("stated_pct");
    else errors.push("stated_pct must be a finite number");
  } else {
    checkRange("stated_pct", stated, errors);
  }

  const need = (name: string): number | null => {
    const v = num(inputs[name]);
    if (v === null) {
      if (inputs[name] === undefined || inputs[name] === null) missing.push(`inputs.${name}`);
      else errors.push(`inputs.${name} must be a finite number`);
      return null;
    }
    checkRange(`inputs.${name}`, v, errors);
    return v;
  };

  if (type === "cumulative") {
    const start = need("start_value");
    const end = need("end_value");
    if (start !== null && start <= 0) errors.push("inputs.start_value must be > 0");
    if (end !== null && end < 0) errors.push("inputs.end_value must be >= 0");
    if (b.assumption_confirmed !== true) {
      errors.push("cumulative assumes no deposits or withdrawals; send assumption_confirmed: true to confirm");
    }
  } else if (type === "compounded") {
    const r = need("annual_return_pct");
    const years = need("years");
    if (r !== null && r < -100) errors.push("inputs.annual_return_pct must be >= -100");
    if (years !== null && (!Number.isInteger(years) || years < 1 || years > MAX_YEARS)) {
      errors.push(`inputs.years must be an integer 1..${MAX_YEARS}`);
    }
  }
  return { ok: missing.length === 0 && errors.length === 0, missing, errors };
}

/**
 * Percentage-point comparison on the RAW values, before any display rounding.
 * tolerance_pp is an absolute difference in percentage points: stated 50.04 vs calculated 50 with
 * tolerance 0.05 matches; round-for-display first and this boundary would lie.
 */
export function comparePct(stated: number, calculated: number, tol = TOLERANCE_PP): boolean {
  return Math.abs(stated - calculated) <= tol + 1e-12; // epsilon so an exact-boundary float still matches
}

/**
 * The fixed script run inside the sandbox. NO user text is interpolated: the spec arrives as a
 * base64-encoded JSON literal on the DATA line below, which the executor fills. The script
 * re-validates everything (defense in depth — it does not trust the TS validation ran) and prints
 * exactly one JSON line.
 */
export const CALC_SCRIPT = String.raw`
import base64, json, math, sys

DATA = "__CALC_SPEC_B64__"

def fail(details):
    print(json.dumps({"ok": False, "error": "invalid_input", "details": details}))
    sys.exit(0)

try:
    spec = json.loads(base64.b64decode(DATA))
except Exception:
    fail(["payload is not base64 JSON"])
if not isinstance(spec, dict):
    fail(["payload is not a JSON object"])

errors = []
MAX_ABS = 1e12

def finite(name, v):
    if not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v):
        errors.append(name + " must be a finite number")
        return None
    if abs(v) > MAX_ABS:
        errors.append(name + " out of range")
        return None
    return float(v)

ctype = spec.get("check_type")
inputs = spec.get("inputs")
if not isinstance(inputs, dict):
    fail(["inputs must be an object"])
stated = finite("stated_pct", spec.get("stated_pct"))
tol = spec.get("tolerance_pp")
if not isinstance(tol, (int, float)) or not math.isfinite(tol) or tol < 0:
    tol = 0.05
max_years = spec.get("max_years")
if not isinstance(max_years, int) or max_years < 1:
    max_years = 100

if ctype == "cumulative":
    start = finite("inputs.start_value", inputs.get("start_value"))
    end = finite("inputs.end_value", inputs.get("end_value"))
    if start is not None and start <= 0:
        errors.append("inputs.start_value must be > 0")
    if end is not None and end < 0:
        errors.append("inputs.end_value must be >= 0")
    if not errors:
        calc = (end / start - 1.0) * 100.0
        formula = "(end_value / start_value - 1) * 100"
        explanation = ("Cumulative return assuming no deposits or withdrawals: "
                       + repr(end) + " / " + repr(start) + " - 1.")
elif ctype == "compounded":
    r = finite("inputs.annual_return_pct", inputs.get("annual_return_pct"))
    years = inputs.get("years")
    if not isinstance(years, int) or isinstance(years, bool) or years < 1 or years > max_years:
        errors.append("inputs.years must be an integer 1..max_years")
        years = None
    if r is not None and r < -100:
        errors.append("inputs.annual_return_pct must be >= -100")
    if not errors:
        calc = ((1.0 + r / 100.0) ** years - 1.0) * 100.0
        formula = "((1 + annual_return_pct/100) ** years - 1) * 100"
        explanation = ("Constant annual rate of " + repr(r) + "% compounded annually over "
                       + str(years) + " year(s).")
else:
    fail(["check_type must be 'cumulative' or 'compounded'"])

if errors:
    fail(errors)

diff = abs(stated - calc)
print(json.dumps({
    "ok": True,
    "calculated_pct": calc,
    "stated_pct": stated,
    "difference_pp": diff,
    "match": diff <= tol + 1e-12,
    "formula": formula,
    "explanation": explanation,
    "tolerance_pp": tol,
}))
`.trimStart();

// ---- Daytona executor ----

interface DaytonaSandbox {
  process: { codeRun: (code: string, params?: unknown, timeoutSeconds?: number) => Promise<{ exitCode: number; result?: string }> };
}
interface DaytonaClient {
  create: (opts: { language: string }) => Promise<DaytonaSandbox>;
  delete: (sandbox: DaytonaSandbox) => Promise<void>;
}
export interface ExecutorDeps {
  createClient?: () => Promise<DaytonaClient>;
}
export type Executor = (spec: CheckSpec) => Promise<Record<string, unknown>>;

/** Lazy so importing this module never loads the SDK; also lets the self-check inject a fake. */
async function defaultClient(): Promise<DaytonaClient> {
  let apiKey = "";
  try {
    // @ts-ignore: base44:runtime only resolves inside Base44; caught everywhere else.
    const { secrets } = await import("base44:runtime");
    apiKey = secrets.get("DAYTONA_API_KEY") ?? "";
  } catch { /* running under plain deno */ }
  try {
    if (!apiKey) apiKey = Deno.env.get("DAYTONA_API_KEY") ?? "";
  } catch { /* no --allow-env locally */ }
  if (!apiKey) throw new DaytonaUnavailable("DAYTONA_API_KEY is not set"); // before any sandbox exists
  const { Daytona } = await import("npm:@daytona/sdk");
  // Daytona is richer than our minimal client interface; we only use create/delete/codeRun.
  return new Daytona({ apiKey }) as unknown as DaytonaClient;
}

/**
 * (spec) -> raw script JSON. One sandbox per check, always destroyed in finally — including on a
 * thrown create/run — so a failed check cannot leak a running (billing) sandbox. No retries.
 */
export function makeDaytonaExecutor(deps: ExecutorDeps = {}): Executor {
  const createClient = deps.createClient ?? defaultClient;
  return async (spec) => {
    const client = await createClient().catch((e) => {
      throw e instanceof DaytonaUnavailable ? e : new DaytonaUnavailable(`daytona client: ${(e as Error).message}`);
    });
    let sandbox: DaytonaSandbox | null = null;
    try {
      sandbox = await client.create({ language: "python" }).catch((e) => {
        throw new DaytonaUnavailable(`sandbox create: ${(e as Error).message}`);
      });
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(spec)))); // UTF-8 safe base64
      const code = CALC_SCRIPT.replace("__CALC_SPEC_B64__", b64);
      const run = await sandbox.process.codeRun(code, undefined, RUN_TIMEOUT_S).catch((e) => {
        throw new CalcRunFailed(`codeRun: ${(e as Error).message}`);
      });
      if (run.exitCode !== 0) throw new CalcRunFailed(`script exit code ${run.exitCode}`);
      const out = String(run.result ?? "");
      if (out.length > MAX_OUTPUT) throw new CalcRunFailed(`script output over ${MAX_OUTPUT} chars`);
      const line = out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("{"));
      if (!line) throw new CalcRunFailed("script printed no JSON line");
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new CalcRunFailed("script output was not JSON");
      }
    } finally {
      if (sandbox) {
        await client.delete(sandbox).catch((e) => console.log(`calc sandbox delete failed: ${(e as Error).message}`));
      }
    }
  };
}

export interface RunCheckDeps {
  executor?: Executor; // injectable; defaults to the real Daytona executor
}

/** validate -> build spec -> executor -> normalize. Returns the function's 200 payload (minus `cached`). */
export async function runCheck(body: unknown, deps: RunCheckDeps = {}): Promise<CheckResult> {
  const v = validateCheck(body);
  if (!v.ok) {
    const err = new Error("invalid_input") as Error & { missing: string[]; details: string[] };
    err.missing = v.missing;
    err.details = v.errors;
    throw err;
  }
  const b = body as { check_type: "cumulative" | "compounded"; inputs: Record<string, number>; stated_pct: number };
  const spec: CheckSpec = {
    check_type: b.check_type,
    inputs: b.inputs,
    stated_pct: b.stated_pct,
    tolerance_pp: TOLERANCE_PP,
    max_years: MAX_YEARS,
  };
  const raw = await (deps.executor ?? makeDaytonaExecutor())(spec);
  if (raw.ok !== true) {
    throw new CalcRunFailed(`script rejected input: ${JSON.stringify(raw.details ?? raw.error)}`);
  }
  const stated = num(raw.stated_pct);
  const calculated = num(raw.calculated_pct);
  if (stated === null || calculated === null || typeof raw.formula !== "string") {
    throw new CalcRunFailed("script output missing fields");
  }
  const difference_pp = num(raw.difference_pp) ?? Math.abs(stated - calculated);
  return {
    ok: true,
    stated_pct: stated,
    calculated_pct: calculated,
    difference_pp,
    match: raw.match === true,
    formula: raw.formula,
    explanation: String(raw.explanation ?? ""),
    tolerance_pp: num(raw.tolerance_pp) ?? TOLERANCE_PP,
    checked_at: new Date().toISOString(),
  };
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  const near = (a: number, b: number, what: string) => {
    if (Math.abs(a - b) > 1e-9) throw new Error(`${what}: ${a} !~= ${b}`);
  };

  // Executor that runs the real CALC_SCRIPT through the local python3, the same way the
  // sandbox would: base64 payload embedded on the DATA line, one JSON line out.
  const localPythonExecutor: Executor = async (spec) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(spec))));
    const code = CALC_SCRIPT.replace("__CALC_SPEC_B64__", b64);
    const proc = new Deno.Command("python3", { args: ["-c", code], stdout: "piped", stderr: "piped" }).spawn();
    const out = await proc.output();
    if (out.code !== 0) throw new CalcRunFailed(`local python exit ${out.code}: ${new TextDecoder().decode(out.stderr)}`);
    return JSON.parse(new TextDecoder().decode(out.stdout).trim().split("\n").pop()!);
  };

  // Happy paths through runCheck against the real script.
  const local = { executor: localPythonExecutor };
  let r = await runCheck(
    { check_type: "cumulative", inputs: { start_value: 10000, end_value: 15000 }, stated_pct: 60, assumption_confirmed: true },
    local,
  );
  eq([r.ok, r.match], [true, false], "$10k->$15k stated 60 does not match");
  near(r.calculated_pct, 50, "calculated cumulative pct");
  r = await runCheck(
    { check_type: "cumulative", inputs: { start_value: 10000, end_value: 15000 }, stated_pct: 50, assumption_confirmed: true },
    local,
  );
  eq(r.match, true, "stated 50 matches");
  r = await runCheck({ check_type: "compounded", inputs: { annual_return_pct: 10, years: 3 }, stated_pct: 30 }, local);
  eq(r.match, false, "10%/3yr stated 30 does not match");
  near(r.calculated_pct, 33.1, "calculated compounded pct");
  r = await runCheck({ check_type: "compounded", inputs: { annual_return_pct: 10, years: 3 }, stated_pct: 33.1 }, local);
  eq(r.match, true, "stated 33.1 matches");

  // Tolerance boundary, raw values before rounding.
  eq(comparePct(50 + TOLERANCE_PP, 50), true, "exactly at tolerance matches");
  eq(comparePct(50 + TOLERANCE_PP + 1e-9, 50), false, "epsilon beyond tolerance does not match");
  r = await runCheck(
    { check_type: "cumulative", inputs: { start_value: 10000, end_value: 15000 }, stated_pct: 50 + TOLERANCE_PP, assumption_confirmed: true },
    local,
  );
  eq(r.match, true, "script: stated exactly at tolerance matches");

  // Validation: executor must NEVER be invoked on bad input.
  let invoked = 0;
  const counting: RunCheckDeps = {
    executor: async (spec) => {
      invoked++;
      return localPythonExecutor(spec);
    },
  };
  const rejected = async (body: unknown) => {
    try {
      await runCheck(body, counting);
      return false;
    } catch {
      return true;
    }
  };
  const bad: [unknown, string][] = [
    [{ check_type: "cumulative", inputs: { start_value: 10000 }, stated_pct: 50, assumption_confirmed: true }, "missing end_value"],
    [{ check_type: "cumulative", inputs: { start_value: 10000, end_value: NaN }, stated_pct: 50, assumption_confirmed: true }, "NaN end_value"],
    [{ check_type: "cumulative", inputs: { start_value: 10000, end_value: "abc" }, stated_pct: 50, assumption_confirmed: true }, "string end_value"],
    [{ check_type: "cumulative", inputs: { start_value: 0, end_value: 5 }, stated_pct: 50, assumption_confirmed: true }, "zero start"],
    [{ check_type: "cumulative", inputs: { start_value: 10000, end_value: Infinity }, stated_pct: 50, assumption_confirmed: true }, "Infinity end_value"],
    [{ check_type: "cumulative", inputs: { start_value: 10000, end_value: 15000 }, stated_pct: 50 }, "assumption not confirmed"],
    [{ check_type: "compounded", inputs: { annual_return_pct: 10, years: 0 }, stated_pct: 10 }, "years 0"],
    [{ check_type: "compounded", inputs: { annual_return_pct: 10, years: 101 }, stated_pct: 10 }, "years 101"],
    [{ check_type: "compounded", inputs: { annual_return_pct: 10, years: 2.5 }, stated_pct: 10 }, "non-integer years"],
    [{ check_type: "compounded", inputs: { annual_return_pct: -101, years: 2 }, stated_pct: 10 }, "annual < -100"],
    [{ check_type: "compounded", inputs: { annual_return_pct: 1e13, years: 2 }, stated_pct: 10 }, "absurd magnitude"],
    [{ check_type: "nonsense", inputs: {}, stated_pct: 10 }, "bad check_type"],
  ];
  for (const [body, what] of bad) {
    eq(await rejected(body), true, `rejected: ${what}`);
  }
  eq(invoked, 0, "executor never invoked on invalid input");
  // And a valid one does invoke it.
  await runCheck(
    { check_type: "cumulative", inputs: { start_value: 10000, end_value: 15000 }, stated_pct: 50, assumption_confirmed: true },
    counting,
  );
  eq(invoked, 1, "valid input invokes executor once");

  // Daytona error paths via a fake client. delete must be recorded on success AND on failure.
  type Call = "create" | "codeRun" | "delete";
  const fake = (runBehavior: "ok" | "exit1" | "throws" | "garbage" | "huge", createFails = false) => {
    const calls: Call[] = [];
    const client = {
      create: async () => {
        calls.push("create");
        if (createFails) throw new Error("quota");
        return {
          process: {
            codeRun: async () => {
              calls.push("codeRun");
              if (runBehavior === "throws") throw new Error("sandbox died");
              if (runBehavior === "exit1") return { exitCode: 1, result: "boom" };
              if (runBehavior === "garbage") return { exitCode: 0, result: "not json at all" };
              if (runBehavior === "huge") return { exitCode: 0, result: "x".repeat(MAX_OUTPUT + 1) };
              return { exitCode: 0, result: JSON.stringify({ ok: true, calculated_pct: 50, stated_pct: 50, difference_pp: 0, match: true, formula: "f", explanation: "e", tolerance_pp: 0.05 }) };
            },
          },
        };
      },
      delete: async () => {
        calls.push("delete");
      },
    };
    return { calls, executor: makeDaytonaExecutor({ createClient: async () => client }) };
  };
  const spec: CheckSpec = { check_type: "cumulative", inputs: { start_value: 1, end_value: 2 }, stated_pct: 100, tolerance_pp: TOLERANCE_PP, max_years: MAX_YEARS };

  for (const [behavior, name, klass] of [
    ["ok", "success", null],
    ["exit1", "nonzero exit", CalcRunFailed],
    ["throws", "codeRun throws", CalcRunFailed],
    ["garbage", "unparseable output", CalcRunFailed],
    ["huge", "oversized output", CalcRunFailed],
  ] as const) {
    const f = fake(behavior);
    try {
      await f.executor(spec);
      if (klass) throw new Error(`${name}: expected ${klass.name}`);
    } catch (e) {
      if (!klass || !(e instanceof klass)) throw e;
    }
    eq(f.calls.includes("delete"), true, `delete called after ${name}`);
    eq(f.calls[0], "create", `${name}: create first`);
  }
  {
    const f = fake("ok", true);
    try {
      await f.executor(spec);
      throw new Error("expected DaytonaUnavailable");
    } catch (e) {
      if (!(e instanceof DaytonaUnavailable)) throw e;
    }
    eq(f.calls.includes("codeRun"), false, "create failure never reaches codeRun");
    eq(f.calls.includes("delete"), false, "no sandbox to delete when create fails");
  }
  {
    // Missing API key is caught BEFORE create — create must not even be attempted.
    const prev = Deno.env.get("DAYTONA_API_KEY");
    Deno.env.delete("DAYTONA_API_KEY");
    try {
      await defaultClient();
      throw new Error("expected DaytonaUnavailable for missing key");
    } catch (e) {
      if (!(e instanceof DaytonaUnavailable)) throw e;
    } finally {
      if (prev !== undefined) Deno.env.set("DAYTONA_API_KEY", prev);
    }
  }
  console.log("calc-check.ts self-check: ok");
}
