export type ReadinessTone = "success" | "info" | "warning" | "danger";

export interface ReadinessPresentation {
  score: number;
  label: "Ready" | "Nearly ready" | "In progress" | "Needs work";
  tone: ReadinessTone;
}

/** Shared score, label, and status presentation for readiness UI. */
export function getReadinessPresentation(rawScore: number): ReadinessPresentation {
  const score = Number.isNaN(rawScore)
    ? 0
    : Math.min(100, Math.max(0, rawScore));

  if (score >= 90) {
    return { score, label: "Ready", tone: "success" };
  }

  if (score >= 70) {
    return { score, label: "Nearly ready", tone: "info" };
  }

  if (score >= 40) {
    return { score, label: "In progress", tone: "warning" };
  }

  return { score, label: "Needs work", tone: "danger" };
}
