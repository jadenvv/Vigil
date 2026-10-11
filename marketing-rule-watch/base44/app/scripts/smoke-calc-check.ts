// Live smoke test for check-calculation: one real Daytona sandbox round-trip.
// Reads DAYTONA_API_KEY from the environment (or ../../.env when run from base44/app). Never prints the key.
// Run from anywhere (DENO_NO_PACKAGE_JSON=1 makes npm:@daytona/sdk resolve despite package.json):
//   DENO_NO_PACKAGE_JSON=1 deno run --allow-env --allow-net --allow-sys --allow-read scripts/smoke-calc-check.ts
// Expect: ok:true, match:false, calculated_pct:50. One sandbox created and deleted; ~1 credit unit.
import { runCheck } from "../base44/shared/calc-check.ts";

try {
  const env = Deno.readTextFileSync("../../.env");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[1] === "DAYTONA_API_KEY" && !Deno.env.get(m[1])) {
      Deno.env.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
    }
  }
} catch { /* no .env — rely on exported env var */ }

if (!Deno.env.get("DAYTONA_API_KEY")) {
  console.error("DAYTONA_API_KEY not set (export it or add it to ../../.env)");
  Deno.exit(2);
}

console.log("creating sandbox, running the $10k->$15k / stated 60% check...");
const r = await runCheck({
  check_type: "cumulative",
  inputs: { start_value: 10000, end_value: 15000 },
  stated_pct: 60,
  assumption_confirmed: true,
});
console.log(JSON.stringify(r, null, 2));
if (r.match !== false || Math.abs(r.calculated_pct - 50) > 0.05) {
  console.error("SMOKE FAIL: unexpected result");
  Deno.exit(1);
}
console.log("smoke ok: real Daytona sandbox ran the script and was deleted");
