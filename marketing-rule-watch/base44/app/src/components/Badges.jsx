import { CHANNEL_LABELS, COPY } from "@/lib/copy";
import { SEVERITY_LABELS, severityOf } from "@/lib/severity";

const SEVERITY_STYLES = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-200 text-slate-700",
};

export function SeverityBadge({ category }) {
  const severity = severityOf(category);
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function ChannelChip({ channel }) {
  return (
    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
      {CHANNEL_LABELS[channel] ?? CHANNEL_LABELS.other}
    </span>
  );
}

export function Confidence({ value }) {
  if (typeof value !== "number") return null;
  return (
    <span className="text-xs text-slate-500">
      {COPY.confidenceLabel} {Math.round(value * 100)}%
    </span>
  );
}

export function DecisionBadge({ decision }) {
  if (!decision) return null;
  const label = { approve: "Approved", edit: "Edited", reject: "Dismissed" }[decision.action] ?? decision.action;
  return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>;
}
