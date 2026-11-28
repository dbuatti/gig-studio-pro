import { describe, expect, it } from "vitest";

import { calculateReadiness } from "./repertoireSync";
import type { SetlistSong } from "@/components/SetlistManager";

/**
 * Every readiness validator must be satisfiable from the wizard's guided steps.
 * A song that passes all wizard checks should score exactly 100%.
 */
const fullyReadySong: Partial<SetlistSong> = {
  pdfUrl: "https://example.com/score.pdf",
  preferred_reader: "fn",
  originalKey: "C",
  targetKey: "D",
  highest_note_original: "A5",
  isKeyConfirmed: true,
  lyrics: "A fully written set of lyrics that is comfortably longer than twenty characters.",
  ug_chords_text: "C  G  Am  F  C  G  F  C",
  notes: "Bridge has a seven beat rest — don't come in early.",
  comfort_level: 5,
  is_ready_to_sing: true,
  readiness_checklist: [
    "reader_ready",
    "key_and_range_confirmed",
    "every_section_checked",
    "structure_marked",
    "final_checks",
  ],
};

describe("calculateReadiness with a checklist", () => {
  it("reaches 100% when every wizard check is satisfied", () => {
    expect(calculateReadiness(fullyReadySong)).toBe(100);
  });

  it("drops below 100% when the confidence rating is not maxed", () => {
    // Confidence contributes fractional credit, so the wizard requires +5.
    expect(calculateReadiness({ ...fullyReadySong, comfort_level: 3 })).toBeLessThan(100);
  });

  it("drops below 100% when any single check is missing", () => {
    expect(calculateReadiness({ ...fullyReadySong, notes: "" })).toBeLessThan(100);
    expect(calculateReadiness({ ...fullyReadySong, is_ready_to_sing: false })).toBeLessThan(100);
    expect(calculateReadiness({ ...fullyReadySong, highest_note_original: "" })).toBeLessThan(100);
    expect(calculateReadiness({ ...fullyReadySong, targetKey: "" })).toBeLessThan(100);
  });
});
