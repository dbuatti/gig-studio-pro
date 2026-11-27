import { describe, expect, it } from "vitest";

import {
  getReadinessPresentation,
  type ReadinessPresentation,
  type ReadinessTone,
} from "./readinessUi";

describe("getReadinessPresentation", () => {
  it.each<[number, ReadinessPresentation["label"], ReadinessTone]>([
    [0, "Needs work", "danger"],
    [39, "Needs work", "danger"],
    [39.9, "Needs work", "danger"],
    [40, "In progress", "warning"],
    [69, "In progress", "warning"],
    [69.9, "In progress", "warning"],
    [70, "Nearly ready", "info"],
    [89, "Nearly ready", "info"],
    [89.9, "Nearly ready", "info"],
    [90, "Ready", "success"],
    [100, "Ready", "success"],
  ])("maps score %s to %s / %s", (score, label, tone) => {
    expect(getReadinessPresentation(score)).toEqual({ score, label, tone });
  });

  it("keeps displayed scores within the readiness range", () => {
    expect(getReadinessPresentation(-10)).toEqual({
      score: 0,
      label: "Needs work",
      tone: "danger",
    });
    expect(getReadinessPresentation(110)).toEqual({
      score: 100,
      label: "Ready",
      tone: "success",
    });
  });

  it("treats an invalid score as needing work", () => {
    expect(getReadinessPresentation(Number.NaN)).toEqual({
      score: 0,
      label: "Needs work",
      tone: "danger",
    });
  });
});
