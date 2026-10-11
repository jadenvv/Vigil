// /evals: how we measure ourselves. Numbers come from src/lib/evalResults.js (`details`) when that
// export exists; until then from FALLBACK_DETAILS below, copied from research/slide_numbers.md
// (live run 16:03–16:05 on 10-10). Never round, never add a number those sources don't have.
import { useEffect } from "react";
import { Shell } from "@/components/Chrome";
import { HBarChart, SeriesKey } from "@/components/evals/HBarChart";
import * as evalResults from "@/lib/evalResults";

const BASELINE_NAME = "Keyword";
const VIGIL_NAME = "Vigil";

// Fallback, copied exactly from research/slide_numbers.md. Counts are {n, of}; scores are 0..1.
export const FALLBACK_DETAILS = {
  title: "How we measure ourselves",
  model: "Base44 InvokeLLM",
  modelNote:
    "Every one of the 69 live calls was answered by base44:base44-invokellm, with no Groq fallback. Base44 doesn't tell us which underlying model InvokeLLM uses, so we don't name one.",
  runNote: "Each live number comes from one run. The LLM isn't fully deterministic.",
  sets: [
    {
      id: "synthetic",
      name: "Main eval",
      setLabel: "37 cases we wrote",
      description:
        "On our 37-case synthetic, unreviewed test set: 19 cases with planted issues (21 issues in all), 18 clean.",
      isDevSet: false,
      vigilVersion: "Live LLM detector (v3)",
      metrics: {
        f1: { baseline: 0.7, vigil: 0.98 },
        precision: {
          baseline: 0.68,
          vigil: 0.95,
          baselineDetail: "15 of 22 flags correct",
          vigilDetail: "21 of 22",
        },
        recall: {
          baseline: 0.71,
          vigil: 1.0,
          baselineDetail: "15 of 21 issues",
          vigilDetail: "21 of 21",
        },
        issuesFound: { baseline: { n: 15, of: 21 }, vigil: { n: 21, of: 21 } },
        cleanFlagged: {
          baseline: { n: 5, of: 18, pct: "28%" },
          vigil: { n: 0, of: 18, pct: "0%" },
        },
        grounding: { baseline: "100%", vigil: "100%" },
        minimalPairs: { baseline: { n: 6, of: 8 }, vigil: { n: 8, of: 8 } },
      },
      caveats: [
        "We wrote these cases ourselves from SEC deficiency categories. No compliance professional has reviewed them.",
        "The detection prompt was developed with these cases visible, so this is not a blind test.",
        "The one false positive is email_riskfree. Besides the labeled \"Risk-free income for life\", the detector also flagged \"Our annuity-like portfolio pays 7% every year.\" That is arguably a real issue our label left out. We scored it as a false positive anyway and did not change the label after seeing the result.",
      ],
      reports: "baseline_regex_120954.json (12:09) vs llm_invokellm_160353.json (16:03)",
    },
    {
      id: "tester",
      name: "Tester-style cases",
      setLabel: "10 cases from tester comments",
      description:
        "10 cases written by us based on Sense Check 1 testers' comments (not tester-labeled). 5 contain an issue and 5 are clean.",
      isDevSet: false,
      vigilVersion: "Live LLM detector",
      metrics: {
        issuesFound: { baseline: { n: 0, of: 5 }, vigil: { n: 5, of: 5 } },
        cleanFlagged: { baseline: { n: 2, of: 5 }, vigil: { n: 0, of: 5 } },
      },
      caveats: [
        "The case text was written by us, not by the testers.",
        "3 of the 10 cases were written together with the fix they test (B4: examples and rule text are not ads), so this is not an independent test.",
        "On the first 7 cases alone, written before any fix, the keyword baseline caught 0 of 4 issues and the live detector caught 4 of 4, with 0 of 3 clean cases flagged by either.",
      ],
      reports: "baseline_regex_tester.json vs llm_invokellm_tester_160414.json",
    },
    {
      id: "demo",
      name: "Demo-site cases",
      setLabel: "Our fictional site (dev set)",
      description:
        "16 cases taken from our own fictional site, Quarrywick Wealth: 11 planted issues and 8 clean cases.",
      isDevSet: true,
      vigilVersion: "Live LLM detector",
      metrics: {
        f1: { baseline: 0.36, vigil: 1.0 },
        issuesFound: { baseline: { n: 6, of: 11 }, vigil: { n: 11, of: 11 } },
        cleanFlagged: { baseline: { n: 5, of: 8 }, vigil: { n: 0, of: 8 } },
      },
      caveats: [
        "This is a development set, not a test. We first ran the detector on this site and it missed 2 planted issues. We fixed both (2948ba6, ac7c18d) before this run. Do not present 11 of 11 as accuracy. Present it as \"found 9 of 11, fixed the 2 misses, now 11 of 11\".",
      ],
      history: [
        {
          label: "Before the fixes (earlier detector version, no longer live)",
          text: "9 of 11 planted issues flagged, 0 false positives.",
        },
        {
          label: "After the fixes (detector v3, live since 16:00)",
          text: "Re-running it through the live detect-text on the stored page text (10 calls, base44-invokellm) gave 11 of 11 planted issues, 0 extra flags and 0 flags on clean items.",
        },
      ],
      reports: "baseline_regex_demo_site.json vs llm_invokellm_demo_site_160443.json",
    },
  ],
  consistency: {
    scope: "n = 3 pages, 2 runs each, our own fictional site (home, performance, testimonials)",
    identicalFlagSets: { n: 2, of: 3 },
    sameCategories: { n: 3, of: 3 },
    meanJaccard: 0.78,
    difference:
      "The one difference was on the home page. Both runs flagged the same claim, but one quoted the whole sentence (\"Quarrywick Wealth is the most trusted retirement firm in the Pacific Northwest.\") and the other a phrase (\"the most trusted retirement firm in the Pacific Northwest\"). Same issue, different quote length.",
    caveat:
      "6 calls is far too few for a consistency rate. It shows the kind of variation we saw, not how often it happens.",
    report: "consistency_160459.json",
  },
  grounding: {
    text: "Grounding means the flag's quote is found word-for-word in the text. On the main eval, both the keyword baseline and the live LLM detector scored 100%.",
  },
  limits: [
    "Not real-world accuracy.",
    "The detection prompt was developed with these cases visible, so this is not a blind test.",
    "The demo site is a development set, not a test: the detector was tuned on this site.",
    "We wrote these cases ourselves from SEC deficiency categories. No compliance professional has reviewed them.",
  ],
};

const SET_NAMES = { synthetic: "Main eval", tester: "Tester-style cases", demo_site: "Demo-site cases" };
const pct = (v) => `${Math.round(v * 100)}%`;

function parseCount(text) {
  const match = typeof text === "string" && text.match(/^(\d+)\s+of\s+(\d+)$/);
  return match ? { n: Number(match[1]), of: Number(match[2]) } : null;
}

const isBaselineRun = (run) => !run.model && /keyword/i.test(run.label || "");

// One `details` set (runs[]) -> the shape the cards read: keyword baseline vs the live detector.
function liveSetFromDetails(set) {
  const baseline = set.runs.find(isBaselineRun);
  const vigil = set.runs.find((r) => r.live === true);
  if (!baseline || !vigil) return null;
  const fallback = FALLBACK_DETAILS.sets.find((s) => s.id === set.id || (set.id === "demo_site" && s.id === "demo"));
  const flagsDetail = (r) => `${r.tp} of ${r.tp + r.fp} flags correct`;
  const issuesDetail = (r) => `${r.tp} of ${r.tp + r.fn} issues`;
  return {
    id: set.id,
    name: SET_NAMES[set.id] || set.title,
    setLabel: set.title,
    description: set.caveat,
    isDevSet: set.id === "demo_site",
    vigilVersion: vigil.label,
    vigilModel: vigil.model,
    metrics: {
      f1: { baseline: baseline.f1, vigil: vigil.f1 },
      precision: { baseline: baseline.precision, vigil: vigil.precision, baselineDetail: flagsDetail(baseline), vigilDetail: flagsDetail(vigil) },
      recall: { baseline: baseline.recall, vigil: vigil.recall, baselineDetail: issuesDetail(baseline), vigilDetail: issuesDetail(vigil) },
      issuesFound: { baseline: { n: baseline.tp, of: baseline.tp + baseline.fn }, vigil: { n: vigil.tp, of: vigil.tp + vigil.fn } },
      cleanFlagged: {
        baseline: parseCount(baseline.cleanFlagged) || { n: 0, of: 0 },
        vigil: parseCount(vigil.cleanFlagged) || { n: 0, of: 0 },
      },
      grounding: { baseline: pct(baseline.grounding), vigil: pct(vigil.grounding) },
      minimalPairs:
        baseline.minimalPairs && vigil.minimalPairs
          ? { baseline: parseCount(baseline.minimalPairs), vigil: parseCount(vigil.minimalPairs) }
          : null,
    },
    // slide_numbers.md caveats are fuller than the run notes; use the notes only when we have none.
    caveats: fallback?.caveats?.length ? fallback.caveats : set.runs.filter((r) => r.note).map((r) => r.note),
    history: fallback?.history,
    reports: `${baseline.report} vs ${vigil.report}`,
  };
}

// Prefer p4-eval's `details` (src/lib/evalResults.js) whenever it has the shape this page reads.
function pickDetails() {
  const details = evalResults.details;
  if (!details || !Array.isArray(details.sets)) return { ...FALLBACK_DETAILS, nextSet: null, fromFallback: true };
  const sets = details.sets.filter((s) => Array.isArray(s.runs)).map(liveSetFromDetails).filter(Boolean);
  if (sets.length === 0) return { ...FALLBACK_DETAILS, nextSet: null, fromFallback: true };
  // Sets with no live run (e.g. the held-out set measured on a laptop model) render apart, labelled not live.
  const nextSet = details.sets.find((s) => Array.isArray(s.runs) && s.runs.length > 0 && !s.runs.some((r) => r.live === true)) || null;
  const c = details.consistency;
  const consistency = c
    ? {
        ...FALLBACK_DETAILS.consistency,
        scope: `n = ${c.pages} pages, ${c.runsPerPage} runs each, our own fictional site. Model: ${c.model}.`,
        identicalFlagSets: parseCount(c.identical) || FALLBACK_DETAILS.consistency.identicalFlagSets,
        sameCategories: parseCount(c.sameCategories) || FALLBACK_DETAILS.consistency.sameCategories,
        caveat: c.caveat || FALLBACK_DETAILS.consistency.caveat,
        report: c.report || FALLBACK_DETAILS.consistency.report,
      }
    : FALLBACK_DETAILS.consistency;
  return { ...FALLBACK_DETAILS, sets, nextSet, consistency, fromFallback: false };
}

const count = (c) => `${c.n} of ${c.of}`;
const countWithPct = (c) => (c.pct ? `${count(c)} · ${c.pct}` : count(c));
const ratio = (c) => (c.of ? c.n / c.of : 0);
const score = (v) => v.toFixed(2);

function Section({ id, title, children, intro }) {
  return (
    <section aria-labelledby={id} className="space-y-5 border-t border-paper-200 pt-10">
      <div className="max-w-3xl space-y-2">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {intro && <p className="text-pretty leading-relaxed text-night-600">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Header({ data }) {
  return (
    <header className="max-w-3xl space-y-4 pb-10">
      <p className="text-sm font-medium text-night-600">Evals</p>
      <h1 className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-night-950 sm:text-5xl">
        {data.title}
      </h1>
      <p className="text-pretty text-base leading-relaxed text-night-600 sm:text-lg">
        We test Vigil's detector on cases we wrote ourselves, from SEC deficiency categories and from what our Sense
        Check testers told us. No compliance professional has reviewed these cases. Each set runs through two
        detectors: a simple keyword baseline, kept only for comparison, and Vigil's live LLM detector, which runs on{" "}
        <span className="font-medium text-night-950">{data.model}</span>. {data.runNote}
      </p>
      <p className="text-sm leading-relaxed text-night-600">{data.modelNote}</p>
    </header>
  );
}

function Headline({ sets }) {
  const lead = sets[0];
  const clean = sets.map((s) => ({
    label: `${s.name}: ${s.setLabel}`,
    bars: [
      { series: "baseline", name: BASELINE_NAME, value: ratio(s.metrics.cleanFlagged.baseline), text: countWithPct(s.metrics.cleanFlagged.baseline) },
      {
        series: "vigil",
        name: VIGIL_NAME,
        value: ratio(s.metrics.cleanFlagged.vigil),
        text: countWithPct(s.metrics.cleanFlagged.vigil),
        highlight: s === lead,
      },
    ],
  }));
  const found = sets.map((s) => ({
    label: `${s.name}: ${s.setLabel}`,
    bars: [
      { series: "baseline", name: BASELINE_NAME, value: ratio(s.metrics.issuesFound.baseline), text: count(s.metrics.issuesFound.baseline) },
      { series: "vigil", name: VIGIL_NAME, value: ratio(s.metrics.issuesFound.vigil), text: count(s.metrics.issuesFound.vigil) },
    ],
  }));
  return (
    <Section
      id="headline-title"
      title="Keyword rules vs Vigil"
      intro="The same cases, scored two ways. Fewer clean cases wrongly flagged means fewer false alarms for a reviewer to wade through; issues found is how many planted potential issues each detector caught."
    >
      <SeriesKey />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-[10px] border border-paper-200 bg-white p-5">
          <h3 className="text-base font-semibold">Clean cases wrongly flagged</h3>
          <p className="mb-4 text-sm text-night-600">Lower is better.</p>
          <HBarChart
            title="Clean cases wrongly flagged, keyword baseline vs Vigil"
            desc="Lower is better. One run per set."
            valueHeader="Clean cases flagged"
            groups={clean}
          />
        </div>
        <div className="min-w-0 rounded-[10px] border border-paper-200 bg-white p-5">
          <h3 className="text-base font-semibold">Planted issues found</h3>
          <p className="mb-4 text-sm text-night-600">Higher is better.</p>
          <HBarChart
            title="Planted potential issues found, keyword baseline vs Vigil"
            desc="Higher is better. One run per set."
            valueHeader="Issues found"
            groups={found}
          />
        </div>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-night-600">
        The demo-site row is a development set: the detector was tuned on that site, so its 11 of 11 is not a test
        result. Every Vigil number here is from the live detector; the keyword baseline is not in the app.
      </p>
    </Section>
  );
}

function metricRows(m) {
  const rows = [];
  if (m.f1) rows.push({ label: "F1", baseline: score(m.f1.baseline), vigil: score(m.f1.vigil) });
  if (m.precision)
    rows.push({
      label: "Precision",
      baseline: `${score(m.precision.baseline)}${m.precision.baselineDetail ? ` (${m.precision.baselineDetail})` : ""}`,
      vigil: `${score(m.precision.vigil)}${m.precision.vigilDetail ? ` (${m.precision.vigilDetail})` : ""}`,
    });
  if (m.recall)
    rows.push({
      label: "Recall",
      baseline: `${score(m.recall.baseline)}${m.recall.baselineDetail ? ` (${m.recall.baselineDetail})` : ""}`,
      vigil: `${score(m.recall.vigil)}${m.recall.vigilDetail ? ` (${m.recall.vigilDetail})` : ""}`,
    });
  rows.push({ label: "Issues found", baseline: count(m.issuesFound.baseline), vigil: count(m.issuesFound.vigil) });
  rows.push({
    label: "Clean cases wrongly flagged",
    baseline: countWithPct(m.cleanFlagged.baseline),
    vigil: countWithPct(m.cleanFlagged.vigil),
  });
  if (m.grounding) rows.push({ label: "Grounding (quote found word-for-word)", baseline: m.grounding.baseline, vigil: m.grounding.vigil });
  if (m.minimalPairs)
    rows.push({ label: "Minimal pairs passed", baseline: count(m.minimalPairs.baseline), vigil: count(m.minimalPairs.vigil) });
  return rows;
}

function chartGroups(m) {
  const pair = (label, b, v, bt, vt) => ({
    label,
    bars: [
      { series: "baseline", name: BASELINE_NAME, value: b, text: bt },
      { series: "vigil", name: VIGIL_NAME, value: v, text: vt },
    ],
  });
  if (m.precision || m.recall || m.f1) {
    const groups = [];
    if (m.precision) groups.push(pair("Precision", m.precision.baseline, m.precision.vigil, score(m.precision.baseline), score(m.precision.vigil)));
    if (m.recall) groups.push(pair("Recall", m.recall.baseline, m.recall.vigil, score(m.recall.baseline), score(m.recall.vigil)));
    if (m.f1) groups.push(pair("F1", m.f1.baseline, m.f1.vigil, score(m.f1.baseline), score(m.f1.vigil)));
    return groups;
  }
  return [
    pair("Issues caught", ratio(m.issuesFound.baseline), ratio(m.issuesFound.vigil), count(m.issuesFound.baseline), count(m.issuesFound.vigil)),
    pair(
      "Clean cases wrongly flagged",
      ratio(m.cleanFlagged.baseline),
      ratio(m.cleanFlagged.vigil),
      count(m.cleanFlagged.baseline),
      count(m.cleanFlagged.vigil),
    ),
  ];
}

function SetCard({ set }) {
  const m = set.metrics;
  const hasScores = Boolean(m.precision || m.recall || m.f1);
  const rows = metricRows(m);
  const headingId = `set-${set.id}`;
  return (
    <article aria-labelledby={headingId} className="min-w-0 space-y-5 rounded-[10px] border border-paper-200 bg-white p-5 sm:p-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 id={headingId} className="text-lg font-semibold tracking-tight">
            {set.name}
          </h3>
          {set.isDevSet && (
            <span className="rounded-full bg-paper-100 px-2 py-0.5 text-xs font-medium text-night-700">
              Development set, not a test
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-night-600">{set.description}</p>
        {set.vigilModel && <p className="text-sm text-night-600">Vigil run: <span className="font-medium text-night-950">{set.vigilModel}</span></p>}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-3 text-sm font-medium">{hasScores ? (m.precision ? "Precision, recall and F1" : "F1") : "Issues caught and false alarms"}</h4>
          <HBarChart
            compact
            title={`${set.name}: ${hasScores ? "scores" : "counts"}, keyword baseline vs Vigil`}
            desc={hasScores ? "Scores from 0 to 1; higher is better. One run." : "Issues caught: higher is better. Clean cases flagged: lower is better. One run."}
            valueHeader={hasScores ? "Score" : "Count"}
            groups={chartGroups(m)}
          />
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{set.name}: every measured number</caption>
            <thead>
              <tr className="border-b border-paper-200 text-xs text-night-600">
                <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                <th scope="col" className="py-2 pr-3 font-medium">Keyword</th>
                <th scope="col" className="py-2 font-medium">{set.vigilVersion || "Vigil"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-paper-100 align-top">
                  <th scope="row" className="py-2 pr-3 font-normal text-night-700">{row.label}</th>
                  <td className="py-2 pr-3 font-mono tabular-nums text-night-600">{row.baseline}</td>
                  <td className="py-2 font-mono tabular-nums text-night-950">{row.vigil}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {set.history && (
        <div className="space-y-2 rounded-md bg-paper-50 p-4">
          <p className="text-sm font-medium">Real crawl of the same site, in the app</p>
          <ul className="space-y-2 text-sm leading-relaxed text-night-600">
            {set.history.map((h) => (
              <li key={h.label}>
                <span className="font-medium text-night-950">{h.label}:</span> {h.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">Caveats</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-night-600">
          {set.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {set.reports && (
          <p className="break-words pt-1 text-xs text-night-600">
            Source reports: <span className="font-mono">{set.reports}</span>
          </p>
        )}
      </div>
    </article>
  );
}

// A set with no live run: every row is labelled with its model and "not yet live", and it never
// shares a chart with the live numbers above.
const NEXT_FILL = { v3: "#5878AD", v4: "#22674A" }; // dusk-500, sage-700

function NextVersion({ set }) {
  const subsetV3 = set.runs.find((r) => /v3/i.test(r.label) && r.cases !== set.runs[0]?.cases && !isBaselineRun(r));
  const subsetV4 = set.runs.find((r) => /v4/i.test(r.label) && r.cases === subsetV3?.cases && !isBaselineRun(r));
  const models = [...new Set(set.runs.map((r) => r.model).filter(Boolean))];
  const groups =
    subsetV3 && subsetV4
      ? ["precision", "recall", "f1"].map((key) => ({
          label: key === "f1" ? "F1" : key[0].toUpperCase() + key.slice(1),
          bars: [
            { series: "vigil", fill: NEXT_FILL.v3, name: "v3 prompt", value: subsetV3[key], text: score(subsetV3[key]) },
            { series: "vigil", fill: NEXT_FILL.v4, name: "v4, not live", value: subsetV4[key], text: score(subsetV4[key]) },
          ],
        }))
      : null;
  return (
    <Section
      id="next-title"
      title="Next version, not yet live"
      intro="We also test the next detector prompt on held-out cases written before it. None of these numbers come from the live app."
    >
      <article aria-labelledby="next-set" className="min-w-0 space-y-5 rounded-[10px] border border-dashed border-night-300 bg-white p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 id="next-set" className="text-lg font-semibold tracking-tight">{set.title}</h3>
            <span className="rounded-full bg-paper-100 px-2 py-0.5 text-xs font-medium text-night-700">Next version, not yet live</span>
          </div>
          <p className="text-sm leading-relaxed text-night-600">{set.caveat}</p>
          {models.length > 0 && (
            <p className="text-sm text-night-600">
              Model: <span className="font-medium text-night-950">{models.join("; ")}</span>
            </p>
          )}
        </div>
        {groups && (
          <div className="min-w-0 md:max-w-xl">
            <h4 className="mb-1 text-sm font-medium">
              v3 vs v4 on the same {subsetV3.cases} cases (next version, not yet live; {subsetV4.model})
            </h4>
            <p className="mb-3 text-xs text-night-600">Not comparable to the live numbers above: different model, different cases.</p>
            <HBarChart
              compact
              nameWidth={112}
              title={`Next version, not yet live: detector v3 vs v4 on the same ${subsetV3.cases} held-out cases`}
              desc={`Scores from 0 to 1; higher is better. One run each on ${subsetV4.model}. Neither run is the live app.`}
              valueHeader="Score"
              groups={groups}
            />
          </div>
        )}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{set.title}: every run, none of them live</caption>
            <thead>
              <tr className="border-b border-paper-200 text-xs text-night-600">
                <th scope="col" className="py-2 pr-3 font-medium">Run</th>
                <th scope="col" className="py-2 pr-3 font-medium">Cases</th>
                <th scope="col" className="py-2 pr-3 font-medium">Precision</th>
                <th scope="col" className="py-2 pr-3 font-medium">Recall</th>
                <th scope="col" className="py-2 pr-3 font-medium">F1</th>
                <th scope="col" className="py-2 font-medium">Clean flagged</th>
              </tr>
            </thead>
            <tbody>
              {set.runs.map((r) => (
                <tr key={`${r.label}-${r.cases}`} className="border-b border-paper-100 align-top">
                  <th scope="row" className="py-2 pr-3 font-normal text-night-700">
                    {r.label}
                    <span className="block text-xs text-night-600">
                      {r.model ? `${r.model} · not live` : "No model · comparison only"}
                    </span>
                    {r.note && <span className="block text-xs text-night-600">{r.note}</span>}
                  </th>
                  <td className="py-2 pr-3 font-mono tabular-nums">{r.cases}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{score(r.precision)}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{score(r.recall)}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{score(r.f1)}</td>
                  <td className="py-2 font-mono tabular-nums">{r.cleanFlagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </Section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-[10px] border border-paper-200 bg-white p-5">
      <span className="block font-mono text-3xl tabular-nums tracking-tight text-night-950">{value}</span>
      <span className="mt-2 block text-sm leading-relaxed text-night-600">{label}</span>
    </div>
  );
}

function ConsistencyAndGrounding({ consistency, grounding }) {
  const c = consistency;
  return (
    <Section
      id="consistency-title"
      title="Consistency and grounding"
      intro="A tester told us they'd seen differing responses from tools like this. So we ran the same pages twice. And every flag must quote the page exactly; if the quote isn't in the text, the flag is dropped."
    >
      <p className="text-sm text-night-600">{c.scope}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={count(c.identicalFlagSets)} label="pages gave identical flag sets (same category and same quote) in both runs" />
        <Stat value={count(c.sameCategories)} label="pages flagged the same categories in both runs" />
        <Stat value={c.meanJaccard.toFixed(2)} label="mean overlap (Jaccard) between the two runs" />
      </div>
      <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-night-600">
        <p>{c.difference}</p>
        <p>
          <span className="font-medium text-night-950">Caveat:</span> {c.caveat}
        </p>
        {c.report && (
          <p className="text-xs">
            Source report: <span className="font-mono">{c.report}</span>
          </p>
        )}
      </div>
      <div className="max-w-3xl rounded-[10px] border border-paper-200 bg-white p-5">
        <h3 className="text-base font-semibold">Grounding</h3>
        <p className="mt-2 text-sm leading-relaxed text-night-600">{grounding.text}</p>
      </div>
    </Section>
  );
}

function Limits({ limits }) {
  return (
    <Section id="limits-title" title="What these numbers don't show">
      <ul className="max-w-3xl space-y-3">
        {limits.map((l) => (
          <li key={l} className="rounded-r-md border-l-[3px] border-night-300 bg-white px-4 py-3 text-sm leading-relaxed text-night-950">
            {l}
          </li>
        ))}
      </ul>
      <p className="max-w-3xl text-sm leading-relaxed text-night-600">
        Every flag Vigil raises is a potential issue for a person to review, not a finding.
      </p>
    </Section>
  );
}

export default function Evals() {
  const data = pickDetails();
  useEffect(() => {
    document.title = `${data.title} · Vigil`;
  }, [data.title]);

  return (
    <Shell>
      <div data-testid="evals-page" data-source={data.fromFallback ? "fallback" : "details"} className="space-y-10">
        <Header data={data} />
        <Headline sets={data.sets} />
        <Section
          id="sets-title"
          title="Each test set in detail"
          intro="Every number we measured for each set, with the caveats that go with it."
        >
          <div className="space-y-6">
            {data.sets.map((set) => (
              <SetCard key={set.id} set={set} />
            ))}
          </div>
        </Section>
        {data.nextSet && <NextVersion set={data.nextSet} />}
        <ConsistencyAndGrounding consistency={data.consistency} grounding={data.grounding} />
        <Limits limits={data.limits} />
      </div>
    </Shell>
  );
}
