import { CHANNEL_LABELS, COPY } from "@/lib/copy";
import { SEVERITY_LABELS, severityOf } from "@/lib/severity";

const SEVERITY_STYLES = {
  high: "bg-ember-100 text-ember-700",
  medium: "bg-lamp-100 text-lamp-700",
  low: "bg-dusk-100 text-dusk-700",
};

export function SeverityBadge({ category }) {
  const severity = severityOf(category);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function ChannelChip({ channel }) {
  return (
    <span className="rounded-full border border-night-200 px-2 py-0.5 text-xs text-night-600">
      {CHANNEL_LABELS[channel] ?? CHANNEL_LABELS.other}
    </span>
  );
}

export function Confidence({ value }) {
  if (typeof value !== "number") return null;
  return (
    <span className="text-xs text-night-600">
      {COPY.confidenceLabel} {Math.round(value * 100)}%
    </span>
  );
}

export function DecisionBadge({ decision }) {
  if (!decision) return null;
  const label = { approve: "Approved", edit: "Edited", reject: "Dismissed" }[decision.action] ?? decision.action;
  return <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-700">{label}</span>;
}
