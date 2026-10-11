// Evidence export for the exam page (testers A4/B2: firms must show what a page said on a past date).
// Pure functions only, so they can be tested without a browser. Built from rows the page already loaded.
// Quotes are scraped page text and untrusted: every field is quoted (RFC 4180) and formula-defused.

export const EVIDENCE_COLUMNS = [
  "page_url",
  "channel",
  "category",
  "severity",
  "confidence",
  "quote",
  "why",
  "captured_at",
  "page_sha256",
  "screenshot_url",
  "status",
  "last_decision",
  "decided_at",
];

// Spreadsheets run a cell starting with one of these as a formula; a leading ' makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvField(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header, rows) {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

// UTC ISO-8601 when parseable; otherwise the stored value as-is, never an invented date.
function utcIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

// groups: [{ page, flags }] from loadInbox. decisions: { [flagId]: Decision } from loadSessionDecisions, or {}.
// labels: { category(id), severity(id), channel(id) } so the CSV shows the same words as the UI.
export function evidenceRows(groups, decisions = {}, labels = {}) {
  const category = labels.category ?? ((id) => id);
  const severity = labels.severity ?? (() => "");
  const channel = labels.channel ?? ((id) => id);
  const rows = [];
  for (const { page, flags } of groups) {
    for (const flag of flags) {
      const decision = decisions[flag.id];
      rows.push([
        page.url ?? "",
        page.channel ? channel(page.channel) : "",
        flag.category ? category(flag.category) : "",
        flag.category ? severity(flag.category) : "",
        typeof flag.confidence === "number" ? flag.confidence : "",
        flag.span ?? "",
        flag.why ?? "",
        utcIso(page.fetched_at),
        page.sha256 ?? "",
        page.screenshot_ref ?? "",
        flag.status ?? "open",
        decision?.action ?? "",
        decision ? utcIso(decision.decided_at) : "",
      ]);
    }
  }
  return rows;
}

export function buildEvidenceCsv(groups, decisions, labels) {
  return toCsv(EVIDENCE_COLUMNS, evidenceRows(groups, decisions, labels));
}

function localDate(now) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function evidenceFilename(firm, now = new Date()) {
  const raw = String(firm?.domain || firm?.id || "firm").toLowerCase();
  const slug = raw.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "firm";
  return `vigil-evidence-${slug}-${localDate(now)}.csv`;
}

// The BOM makes Excel read the file as UTF-8, so curly quotes and accents survive.
export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
