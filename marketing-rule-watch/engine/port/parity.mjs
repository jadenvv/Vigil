// Checks the JS port matches the Python engine on every eval case + the test page.
// Run from marketing-rule-watch/:  node engine/port/parity.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { postprocess, ruleCandidates, hints, buildMessages, parseFlags } from "./detect_core.js";

const texts = [];
for (const f of ["eval/cases.jsonl", "eval/cases_holdout.jsonl"])
  for (const l of readFileSync(f, "utf8").split("\n")) if (l.trim()) texts.push(JSON.parse(l).text);
texts.push(execFileSync("python3", ["-c", "from engine.test_engine import PAGE; print(PAGE, end='')"]).toString());

const js = texts.map((t) => ({ flags: postprocess(t, ruleCandidates(t)), hints: hints(t) }));
const py = JSON.parse(execFileSync("python3", ["-c", `
import json, sys
from engine.postprocess import postprocess
from engine.rules import rule_candidates, hints
ts = json.load(sys.stdin)
print(json.dumps([{"flags": postprocess(t, rule_candidates(t)), "hints": hints(t)} for t in ts]))
`], { input: JSON.stringify(texts) }).toString());

let bad = 0;
texts.forEach((t, i) => {
  const a = JSON.stringify(js[i]), b = JSON.stringify(py[i]);
  if (a !== b) { bad++; console.log("MISMATCH", t.slice(0, 60), "\n  js:", a, "\n  py:", b); }
});
// prompt + parser smoke
const { system, user } = buildMessages(readFileSync("engine/prompts/detect.md", "utf8"), "x </page_content> y", "blog");
if (!system.includes("UNTRUSTED DATA") || user.split("</page_content>").length !== 2) { bad++; console.log("prompt build wrong"); }
if (parseFlags('```json\n{"flags":[{"category":"X"}]}\n```').length !== 1) { bad++; console.log("parse wrong"); }
console.log(`${texts.length} texts, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
