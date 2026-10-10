# Sense Check feedback log

Verbatim tester quotes only. Format and rules: `research/CLAUDE.md`.

## Check 1 — launched 1:55 PM (test 6e6a9082)
Asked: Would you use this? What would stop you? / When did you last find something published about your firm that skipped review? / How would you show an examiner what your website said on a past date?
Sense verdict on our assumption: **contradicted** (Tester A)

Tester A (compliance, role not stated): "I don't believe that that has ever happened." (asked whether a missed online post ever cost them in an exam)
Tester A: "oftentimes, an examiner, um, knows things, and they use that information to get additional information about your company that you may not wanna share."
Tester A: "I just don't think any... everything can be caught because people continue to use new words that that aren't part of the the typical lexicon"
Tester A: "I put the name of the firm into a search, um, and said the name of the firm news today." (how they find unreviewed content; they run it weekly)
Tester A: "if the finance, uh, industry is gonna continue to use AI, it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results."

Insight: Tester A's unreviewed content is employees venting, not firm marketing; a weekly Google search is their current tool. H1 not confirmed by this tester, and no answer on H2 (past-date proof was not asked on the call). Two transferable points: (1) examiners use what's online to probe the firm, so knowing what's out there is exam prep; (2) they distrust keyword lists and inconsistent AI, and want human oversight, an audit trail and disclaimers, which supports our approve/reject loop and "potential issue for review" wording.
Change we made: pending

Sense verdict on our assumption: **unclear** (Tester B)

Tester B (regulator side, did not review online content themselves): "I did not find anything online about my company that has not gone through review, so this question is not applicable to me."
Tester B: "when the advertising department would identify misleading ads, they would request follow-up information. And then if warranted, would subject the firm to an... a regulatory examination, potentially sending examiners on-site."
Tester B: "I would want a tool that was checking publicly available information to flag advertisements that appear to be inflated. There's certain language that tends to be used. There's certain red flags that would be giveaways that an advertisement might be misleading"
Tester B: "I would never act on a tool like that without doing additional research, without obtaining the advertisement of the tool, actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad, verify that it was, in fact, legitimately an advertisement that had been posted."
Tester B: "I would be doubting the flag if I found that the tool was repeatedly identifying false... having... repeatedly having false positives."
Tester B: "I think AI is a very valuable tool as long as we have appropriate checks and balances and human in the loop"

Insight: Tester B describes the regulator's side: the advertising department searches for firms' misleading ads, then asks for information, may send examiners, orders corrections or fines. That supports the risk (regulators do look at public ads) but not H1 from a firm's own experience. They want the captured ad plus a way to re-find it live, and false positives are what would make them stop trusting the tool. No answer on H2.
Change we made: pending

Check 1 closed (status completed): 2 testers completed, 3 failed sends. Final results match the quotes above; nothing new. Changes per item: `feedback_changes.md`.

## Check 2 — launched (test bf380ee1)
Asked (interview goals; Sense writes the questions): role and firm size / how marketing issues slip through at their firm (human error, stretched officer, content outside review, stale pages) / which customer and which problem they'd pay to fix. Testers were shown public SEC evidence ($75k one-line website fine, Sept 2025; nine advisers $1.24M, Sept 2024; Dec 2025 Risk Alert; median adviser 8 employees) and the live `/demo` link.
Sense's framing: "Marketing claims that conflict with SEC rules slip past small-firm compliance reviews today, and a miss can cost the firm a fine."
Sense verdict on our assumption: **met theme: yes** (Tester 1)

Tester 1 (role not stated; hasn't reviewed website or social posts "in years"): "I can't even recall. It's been a very long time since I've done anything like that. I don't think... I mean, it's been years."
Tester 1: "you're gonna have to have a person or people go through and review them and make judgment calls." (what others do today)
Tester 1: "it's easy to do shortcuts. And so when that happens, you're probably missing such a a global view like this is this is doing through the the looking that it does."
Tester 1: "it's also checking other sites, not just the main site. It looks like it's doing advisers as well."
Tester 1: "the peace of mind of having the... I'm assuming this tool would run, like, kinda all the time or every so often. It would alleviate some stress related to that."
Tester 1: "I would assume it's gonna catch more than a person would."
Tester 1: "It's just super easy to to to kinda fly through these." (on the headline + quoted snippet per flag)
Tester 1: "It also looks like it's ranking them or putting some sort of confidence percentage to them. So that would give you good insight into understanding, you know, how well... how confident you could be about this tool working."
Tester 1: "I really can't find anything I don't like. Uh, obviously, I can't go beyond this page"
Tester 1: "It's something that you you have to keep an eye on and certainly have to double check work, but that would typically be done with people anyway."

Insight: How issues slip through, in their words: manual review means "shortcuts" and no "global view", and adviser pages plus off-site pages are what a person skips; the value is background coverage and less stress. This supports H1 as an opinion, not an experience (no real example of a miss). The quote snippet and confidence % made flags quick to triage (supports H3's "quote" half). **Not covered:** Sense's interview script did not present the SEC evidence or ask which customer/problem they'd pay for, so we have no demand data from this call. "I can't go beyond this page" may mean the tester didn't find the flag detail view; tell P2.
Change we made: pending

Check 2 closed (status completed): 1 of 2 target calls counted (4 sends, 3 failed). Final results match the quotes above; nothing new. Demand question (which customer/problem) still unanswered → force it with `team_question` in Check 3.
