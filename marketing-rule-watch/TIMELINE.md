# Timeline — Sat Oct 10 (all times PT)

Fixed event times are in **bold**. Everything else is our plan.

## Hand-offs (the deadlines that matter)

| Time | From → To | What | If late |
|---|---|---|---|
| 1:30 | Devin → P3 | Demo firm site live at a public URL | P3 tests crawl on 2–3 public pages meanwhile |
| 1:30 | P1 → all | Mentor answer: can Base44 make outbound calls? Pick plan A or B | Assume plan B |
| 1:45 | P3 → P2 | Crawl returns page text + screenshot for the demo site | P2 pastes demo-site text into entities by hand for Check 2 |
| 2:30 | P4 → P2 | Detection prompt that beats baseline, ready to paste into Base44 | Ship the best version so far; label it v1 |
| 2:45 | P2 → P1 | Live link with demo mode | P1 sends 3 screenshots instead |
| 7:00 | P4 → P1 | Eval before/after numbers | Slide uses the last saved report |
| 7:45 | P1 | **Submit** | Hard deadline 8:00 |

## Grid

| Time | P1 Lead | P2 Base44 | P3 Data | P4 Detector | Devin |
|---|---|---|---|---|---|
| 12:55–1:15 | Collect Sense Check 1 results | Account, Builder plan, create app + entities | Bright Data token + Web Unlocker zone | Scaffold `engine/`, LLM key, first prompt | — |
| 1:15–1:30 | Kick off Devin; ask mentor about outbound calls | Setup + inbox screens | Fetch test on public pages | Iterate prompt vs eval | Start site |
| 1:30–2:30 | Log Check 1 quotes; update hypotheses | Flag detail + demo mode | Crawl demo site → port into Base44 | Beat baseline; grounding filter | Ship site, mirror cases into eval |
| 2:30–3:00 | Write Check 2 description | Paste detect prompt; run end to end | Pair with P2 on wiring | Hand off prompt; help P2 test | — |
| **3:00–4:00** | **Launch Sense Check 2** | Fix live bugs during calls | Watch credits + logs | Turn quotes into eval cases | — |
| 4:00–5:30 | Log feedback; pick the top fix | Fix top complaint; rewrite drawer | Discovery, or snapshot storage | Rewrite prompt; Daytona if time | — |
| **5:00–6:00** | **Mentor hour 3**; draft slides | Polish | Snapshot timeline (stretch) | Re-run eval, compare report | — |
| **6:00–7:00** | **Launch Sense Check 3** | Live fixes | Support | Eval cases from quotes | — |
| 7:00–7:45 | Slides, rehearse, record fallback video, **submit** | Freeze app | Freeze | Final numbers to P1 | — |
| **8:00** | Hacking ends | | | | |
| **8:30** | Judging | | | | |

Mentor hours: **11–12, 2–3, 5–6**. Sense Check windows: **12–1, 3–4, 6–7**.

## Cut order if we're behind

1. Snapshot timeline
2. Discovery (use a fixed URL list)
3. Daytona verify
4. Rewrite

**Never cut:** crawl → detect → flag detail, demo mode, or the eval.
