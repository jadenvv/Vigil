// Every user-facing string lives here so the copy rules can be checked in one place:
// say "potential issue for review"; never the two banned words listed in base44/CLAUDE.md "Copy rules".

// Rule paragraph refs are unverified. Flip only after a mentor or tester confirms them.
export const SHOW_RULE_REFS = false;

export const COPY = {
  appName: "Marketing Rule Watch",
  footer: "Not legal advice. All flags require human review.",
  demoBanner: "Fictional firm for a hackathon demo",
  issueCount: (n: number) => `${n} potential ${n === 1 ? "issue" : "issues"} for review`,
  issueCountAcross: (n: number, pages: number) =>
    `${n} potential ${n === 1 ? "issue" : "issues"} for review across ${pages} ${pages === 1 ? "page" : "pages"}`,
  emptyInbox: "No potential issues found",
  emptyInboxDetail: "Nothing on these pages matched a Marketing Rule pattern. A person should still review new content.",
  loadError: "We couldn't load this. Check your connection and try again.",
  retry: "Try again",
  notFound: "We couldn't find that item.",
  noDemoFirm: "The demo firm isn't loaded yet.",
  screenshotUnavailable: "Screenshot unavailable",
  quoteNotLocated: "The flagged quote couldn't be located in the page text. It is shown on its own above.",
  whyLabel: "Why this was flagged",
  quoteLabel: "Flagged quote",
  confidenceLabel: "Confidence",
  sourceLabel: "Source",
  fetchedLabel: "Captured",
  ruleLabel: "Rule reference",
  backToInbox: "Back to all issues",
  pageTextLabel: "Page text",
  rewriteTitle: "Suggested rewrite",
  originalLabel: "Original",
  suggestedLabel: "Suggested",
  rewriteUnavailable: "A suggested rewrite isn't available yet. You can write one with Edit.",
  flagsCleared: (cleared: number, total: number) => `Flags cleared: ${cleared} of ${total}`,
  approve: "Approve",
  edit: "Edit",
  reject: "Dismiss",
  saveEdit: "Save edit",
  cancel: "Cancel",
};

// Phase 5 rewrite drawer stays off until after Sense Check 2.
export const SHOW_REWRITE = false;

export const CHANNEL_LABELS: Record<string, string> = {
  website: "Website",
  blog: "Blog",
  linkedin: "LinkedIn",
  review_site: "Review site",
  press: "Press",
  other: "Other",
};
