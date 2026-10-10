# Marketing Rule Watch (working title)

**One line:** a tool that keeps watching everything a small investment advisory firm has published online and flags anything that might break the SEC's marketing rule, before an examiner finds it.

**Theme:** Catch what humans miss
**Who it's for:** compliance officers and advisors at small RIAs

## The problem

The SEC treats a firm's website, blog, social posts and client testimonials as advertising. Every piece has to be reviewed and archived. Small firms get no exemption, and the SEC has put out repeated risk alerts on the same mistakes: claims with no backing, testimonials with no disclosure, cherry-picked performance, ratings with no methodology.

A compliance vendor's survey says about half of compliance leaders still review marketing by hand. And review only covers what people remember to submit. An advisor's old blog post or a LinkedIn comment never reaches the compliance officer.

There's a second problem we think nobody talks about: a website only shows what it says today. If an examiner asks what the page said six months ago, most firms can't prove it. We'll find out on the calls whether that's real pain or just our guess.

## What we're building

1. **Find** everything the firm has published: site, blog, social, third-party pages (Bright Data).
2. **Flag** risky language. Each flag shows the exact text, a screenshot, and which part of the rule it touches.
3. **Check the math** on any performance numbers, in a sandbox, so it's not just an AI opinion (Daytona).
4. **Suggest a fix**: a compliant rewrite the compliance officer approves or rejects.
5. **Keep dated snapshots** so the firm can show what was live on any day. (Stretch goal.)

It flags *potential issues for human review*. It never says "violation" and it isn't legal advice.

## Why it could win

- **Real pain:** it's in the SEC's own alerts, not something we made up.
- **Not the obvious build:** most tools sit in a review queue. This one goes looking in the places no one reviews.
- **Trust:** every flag quotes real text and cites a rule. We also have a real eval (37 seeded cases) that measures misses and false alarms, so we can show before and after numbers.
- **Feedback loop:** we change the product after each tester round and show exactly what changed and why.

## How we'll know it works

An eval harness is already built and running. A simple keyword baseline scores about 0.70 F1. It misses things like "never lost money in a down year" and flags standard disclaimers like "past performance does not guarantee future results." Our job is to beat that, and to stay quiet on clean documents.

Caveat: the 37 test cases are written from SEC categories and haven't been checked by a compliance pro yet. Tester calls are how we fix that.

## Plan for today

| Time | What |
|---|---|
| 12-1 | Sense Check 1: pitch the idea, ask how they find what advisors posted outside review |
| 1-3 | Build the loop: crawl, flag, rewrite, on a fake firm's site |
| 3-4 | Sense Check 2: show the live demo |
| 4-6 | Fix the top complaint from the calls |
| 6-7 | Sense Check 3: ask "would you trust these flags without checking?" |
| 8:00 | Submit, with a 3-slide pitch |

## Sponsor tracks we can hit

Base44 (the app), Bright Data (crawling), Daytona (math checks), maybe Clerk (compliance officer vs advisor logins). Devin can take a side piece.

## What I need from the team

- Someone on the Base44 front end
- Someone on the crawler and detector
- Someone to run the eval and sit in on tester calls

## Questions we're asking testers

1. How do you find out what advisors posted outside your review process?
2. If an examiner asked what your website said six months ago, what would you do?
3. What would stop you from trusting a tool's flags?
