// Severity is a frontend constant, not a contract field, so P4 can override it here.
// Category ids are TAXONOMY in eval/compliance_eval.py.

export type Severity = "high" | "medium" | "low";

export const CATEGORY_SEVERITY: Record<string, Severity> = {
  BENEFITS_WITHOUT_RISK: "high",
  HYPOTHETICAL_PERFORMANCE: "high",
  GROSS_WITHOUT_NET: "high",
  TESTIMONIAL_NO_DISCLOSURE: "high",
  UNFAIR_PERFORMANCE_PRESENTATION: "medium",
  UNBALANCED_SPECIFIC_ADVICE: "medium",
  RATING_NO_DISCLOSURE: "medium",
  UNSUBSTANTIATED_CLAIM: "low",
};

export const CATEGORY_LABELS: Record<string, string> = {
  BENEFITS_WITHOUT_RISK: "Benefits without balancing risks",
  HYPOTHETICAL_PERFORMANCE: "Hypothetical or back-tested performance",
  GROSS_WITHOUT_NET: "Gross returns without net returns",
  TESTIMONIAL_NO_DISCLOSURE: "Testimonial missing disclosures",
  UNFAIR_PERFORMANCE_PRESENTATION: "Cherry-picked time period",
  UNBALANCED_SPECIFIC_ADVICE: "Past pick shown without balance",
  RATING_NO_DISCLOSURE: "Rating or award missing disclosures",
  UNSUBSTANTIATED_CLAIM: "Claim without support",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export function severityOf(category: string): Severity {
  return CATEGORY_SEVERITY[category] ?? "low";
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// Missing confidence counts as 0.5 so an unscored flag neither tops nor sinks the list.
export function severityScore(flag: { category: string; confidence?: number | null }): number {
  const confidence = typeof flag.confidence === "number" ? flag.confidence : 0.5;
  return SEVERITY_WEIGHT[severityOf(flag.category)] * confidence;
}

export function bySeverityDesc<T extends { category: string; confidence?: number | null }>(a: T, b: T): number {
  return severityScore(b) - severityScore(a);
}
