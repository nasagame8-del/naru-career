import { describe, expect, it } from "vitest";
import { MATCH_QUESTIONS, diagnose } from "./matching";

describe("yes/no RPG diagnosis", () => {
  it("has five items per axis, including reverse-worded items", () => {
    for (const axis of ["initiative", "focus", "judgment", "pace"]) {
      const items = MATCH_QUESTIONS.filter(q => q.axis === axis);
      expect(items).toHaveLength(5);
      expect(items.filter(q => q.yesIsPositive)).toHaveLength(3);
    }
  });
  it("makes all 16 classes reachable, without a tied axis", () => {
    const results = new Set<number>();
    for (let profile = 0; profile < 16; profile++) {
      const axes = ["initiative", "focus", "judgment", "pace"];
      const answers = MATCH_QUESTIONS.map(q => {
        const positive = Boolean(profile & (1 << (3 - axes.indexOf(q.axis))));
        return positive === q.yesIsPositive;
      });
      results.add(diagnose(answers));
    }
    expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
  it("rejects incomplete and invalid answers", () => {
    expect(() => diagnose([])).toThrow();
    expect(() => diagnose(Array(19).fill(true))).toThrow();
    expect(() => diagnose(Array(21).fill(true))).toThrow();
    expect(() => diagnose(Array(20).fill(null))).toThrow();
  });
  it("uses a three-of-five majority rather than the last answer", () => {
    const base = MATCH_QUESTIONS.map(q => q.yesIsPositive);
    expect(diagnose(base)).toBe(5);
    const changed = [...base];
    changed[0] = !changed[0]; changed[4] = !changed[4];
    expect(diagnose(changed)).toBe(5);
    changed[8] = !changed[8];
    expect(diagnose(changed)).toBe(3);
  });
});
