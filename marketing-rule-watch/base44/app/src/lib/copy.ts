// Every user-facing string lives here so the copy rules can be checked in one place:
// say "potential issue for review"; never the two banned words listed in base44/CLAUDE.md "Copy rules".

// Rule paragraph refs are unverified. Flip only after a mentor or tester confirms them.
export const SHOW_RULE_REFS = false;

export const COPY = {
  appName: "Vigil",
  footer: "Not legal advice. All flags require human review.",
  demoBanner: "Fictional firm for a hackathon demo",
  issueCount: (n: number) => `${n} potential ${n === 1 ? "issue" : "issues"} for review`,
  issueCountAcross: (n: number, flaggedPages: number, pagesChecked: number) =>
    `${n} potential ${n === 1 ? "issue" : "issues"} for review on ${flaggedPages} of ${pagesChecked} ${pagesChecked === 1 ? "page" : "pages"} checked`,
  // Check 1, Tester A: unreviewed content is often employees venting; say what we do and don't check.
  scopeNote: "We check content your firm and its advisers publish or adopt. We don't flag personal posts or complaints.",
  examLink: "Before your exam",
  examTitle: "Before your exam",
  examPrint: "Print",
  examPrepared: "Prepared",
  examPage: "Page",
  emptyInbox: "No potential issues found",
  emptyInboxDetail: "Nothing on these pages matched a Marketing Rule pattern. A person should still review new content.",
  loadError: "We couldn't load this. Check your connection and try again.",
  retry: "Try again",
  notFound: "We couldn't find that item.",
  noDemoFirm: "The demo firm isn't loaded yet.",
  screenshotUnavailable: "Screenshot unavailable",
  openScreenshot: "Open full-size screenshot",
  quoteNotLocated: "The flagged quote couldn't be located in the page text. It is shown on its own above.",
  whyLabel: "Why this was flagged",
  quoteLabel: "Flagged quote",
  confidenceLabel: "Confidence",
  sourceLabel: "Source",
  fetchedLabel: "Captured",
  hashLabel: "Page fingerprint",
  hashHelp: "SHA-256 of the page text as captured. Any later change to the text gives a different fingerprint.",
  recheck: "Re-check now",
  rechecking: "Checking the live page…",
  recheckQuote: (present: boolean) => (present ? "The flagged quote is still on the live page." : "The flagged quote is no longer on the live page."),
  recheckText: (unchanged: boolean) => (unchanged ? "Page text unchanged since capture." : "Page text has changed since capture."),
  recheckCheckedAgo: (minutes: number) => (minutes < 1 ? "Checked less than a minute ago." : `Checked ${minutes} min ago.`),
  recheckCacheNote: "Each page is checked live at most once every 10 minutes.",
  recheckNotAllowed: "Re-check is open on the demo firm, and to this firm's owner or an admin. Each check uses a search credit.",
  recheckFailed: "We couldn't reach the live page. The captured copy is unchanged.",
  historyLink: "Page history",
  historyTitle: "Page history",
  historyIntro: "Every time Vigil captured this page, with its fingerprint. Nothing here is fetched again.",
  historyCount: (n: number) => `${n} ${n === 1 ? "capture" : "captures"}`,
  historyBack: "Back to the flagged quote",
  historyFirst: "First capture",
  historyChanged: "Text changed",
  historyUnchanged: "No change",
  historyLatest: "Latest",
  historyAsOfLabel: "What did it say on",
  historyAsOfHelp: "Shows the latest capture made on or before the end of that day.",
  historyAsOfNone: "No capture yet on that date. The first capture is shown below.",
  historyAsOfFound: (when: string) => `On that date, the live version was the one captured ${when}.`,
  historyDiffTitle: "Changes from the previous capture",
  historyDiffNone: "Text is the same as the previous capture.",
  historyDiffFirst: "This is the first capture, so there is nothing to compare.",
  historyTextTitle: "Text as captured",
  ruleLabel: "Rule reference",
  backToInbox: "Back to all issues",
  pageTextLabel: "Page text",
  tabText: "Text",
  tabCaptured: "Page as captured",
  capturedCaption: (when: string) => `Captured ${when} · styles load from the live site`,
  captureMissing: "No captured copy of this page yet. Showing the text instead.",
  captureTooLarge: "This captured page is too large to show. Showing the text instead.",
  captureFailed: "The captured page couldn't load. Showing the text instead.",
  captureSpanMissing: "The flagged words couldn't be found in the captured page. Showing the text instead.",
  rewriteTitle: "Suggested rewrite",
  manualRewriteTitle: "Rewrite this quote",
  suggestRewrite: "Suggest a rewrite",
  suggesting: "Suggesting…",
  yourRewriteLabel: "Your rewrite",
  originalLabel: "Original",
  suggestedLabel: "Suggested",
  rewriteUnavailable: "Suggestions unavailable right now. You can write one with Edit.",
  rewriteNoSuggestion: "No usable suggestion for this quote. You can write one with Edit.",
  rewriteFailed: "We couldn't load a suggestion. You can write one with Edit.",
  placeholdersNote: (placeholders: string[]) =>
    `Fill in ${placeholders.join(", ")} with real facts before approving. Use Edit.`,
  flagsCleared: (cleared: number, total: number) => `Flags cleared: ${cleared} of ${total}`,
  showChanges: "Show changes",
  diffRemoved: "removed:",
  diffAdded: "added:",
  diffLegend: "Struck-through words are removed. Underlined words are added. You decide what gets saved.",
  approve: "Approve",
  edit: "Edit",
  reject: "Dismiss",
  saveEdit: "Save edit",
  cancel: "Cancel",
  calcCheckTitle: "Check calculation",
  calcCheckQuoteLabel: "Quote being checked",
  calcTypeLabel: "Check type",
  calcTypeCumulative: "Cumulative return",
  calcTypeCompounded: "Compounded annual return",
  calcStartValue: "Starting value (you supply)",
  calcEndValue: "Ending value (you supply)",
  calcAnnualReturn: "Annual return % (you supply)",
  calcYears: "Years (you supply)",
  calcStatedPct: "Stated return (%)",
  calcAssumption: "No deposits or withdrawals between start and end",
  calcCompoundedNote: "Assumes a constant annual rate, compounded annually.",
  calcRun: "Run check",
  calcRunning: "Checking…",
  calcMissing: (fields: string[]) => `Fill in ${fields.join(", ")} before running the check.`,
  calcInvalid: (fields: string[]) =>
    fields.length > 0 ? `The check needs valid numbers for ${fields.join(", ")}.` : "Check the inputs and try again.",
  calcStatedLabel: "Stated",
  calcCalculatedLabel: "Calculated",
  calcMatch: "Matches supplied inputs",
  calcMismatch: "Does not match supplied inputs",
  calcCheckedAt: (when: string) => `Checked ${when}`,
  calcCached: "Served from a recent check.",
  calcStale: "Inputs changed — run the check again.",
  calcDenied: "Calculation checks are limited to reviewers.",
  calcCooldown: "Too many checks just now. Try again shortly.",
  calcServiceError: "The calculation service isn't reachable right now. Try again later.",
  calcNote: "Checks arithmetic only; does not verify actual investment performance.",
};

// Phase 5 rewrite drawer stays off until after Sense Check 2.
// "Page as captured" tab: off until page-html returns captures for the demo pages.
export const SHOW_PAGE_VIEW = true;

export const SHOW_REWRITE = true;

// "Re-check now" on flag detail: off until the `recheck` function and the Recheck entity are deployed.
// Open on the demo firm, to the firm's owner and to admins; capped at one Bright Data fetch per page per 10 min.
export const SHOW_RECHECK = true;

// "Check calculation" panel on flag detail. Backend: functions/check-calculation.
export const SHOW_CALC_CHECK = true;

// When false, the drawer skips the rewrite call and offers Edit / Dismiss only,
// so no failed request ever reaches the console. Turn off again if the Base44 LLM quota runs out.
export const FETCH_REWRITE_SUGGESTIONS = true;

export const CHANNEL_LABELS: Record<string, string> = {
  website: "Website",
  blog: "Blog",
  linkedin: "LinkedIn",
  review_site: "Review site",
  press: "Press",
  other: "Other",
};
