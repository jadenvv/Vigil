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
  approve: "Approve",
  edit: "Edit",
  reject: "Dismiss",
  saveEdit: "Save edit",
  cancel: "Cancel",
};

// Phase 5 rewrite drawer stays off until after Sense Check 2.
// "Page as captured" tab: off until page-html returns captures for the demo pages.
export const SHOW_PAGE_VIEW = false;

export const SHOW_REWRITE = true;

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
