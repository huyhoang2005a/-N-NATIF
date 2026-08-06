import { describe, expect, it } from "vitest";
import { calculateCompositeScore } from "./composite-score";

describe("calculateCompositeScore (UC-ASM-01 — công thức chính thức, port từ validate_and_calculate_assessment_submission)", () => {
  it("returns 100 when a single criterion is scored at its max", () => {
    const result = calculateCompositeScore([{ score: 10, minScore: 0, maxScore: 10, weight: 1 }]);
    expect(result).toBe(100);
  });

  it("returns 0 when a single criterion is scored at its min", () => {
    const result = calculateCompositeScore([{ score: 0, minScore: 0, maxScore: 10, weight: 1 }]);
    expect(result).toBe(0);
  });

  it("returns 50 when a single criterion is scored at its midpoint", () => {
    const result = calculateCompositeScore([{ score: 5, minScore: 0, maxScore: 10, weight: 1 }]);
    expect(result).toBe(50);
  });

  it("averages two equally-weighted criteria at opposite ends", () => {
    const result = calculateCompositeScore([
      { score: 10, minScore: 0, maxScore: 10, weight: 1 },
      { score: 0, minScore: 0, maxScore: 10, weight: 1 },
    ]);
    expect(result).toBe(50);
  });

  it("weights criteria proportionally when weights differ", () => {
    // c1: weight 3, normalized 1.0 ; c2: weight 1, normalized 0.0
    // weighted sum = 3*1 + 1*0 = 3 ; weight total = 4 -> 3/4 * 100 = 75
    const result = calculateCompositeScore([
      { score: 10, minScore: 0, maxScore: 10, weight: 3 },
      { score: 0, minScore: 0, maxScore: 10, weight: 1 },
    ]);
    expect(result).toBe(75);
  });

  it("normalizes correctly when min_score is not 0", () => {
    // range [2,6], score 4 -> normalized (4-2)/(6-2) = 0.5 -> 50
    const result = calculateCompositeScore([{ score: 4, minScore: 2, maxScore: 6, weight: 1 }]);
    expect(result).toBe(50);
  });

  it("matches the seeded TRL_DEFAULT framework's weight set (6 criteria, mixed scores)", () => {
    // Weights from packages/database seed: 1.5, 1.2, 1.0, 1.0, 0.8, 1.0 (sum 6.5), all
    // criteria range [0,10]. All scored at max (10) should still be exactly 100
    // regardless of weight distribution.
    const allMax = calculateCompositeScore(
      [1.5, 1.2, 1.0, 1.0, 0.8, 1.0].map((weight) => ({ score: 10, minScore: 0, maxScore: 10, weight })),
    );
    expect(allMax).toBe(100);

    // All scored at 0 -> composite 0.
    const allMin = calculateCompositeScore(
      [1.5, 1.2, 1.0, 1.0, 0.8, 1.0].map((weight) => ({ score: 0, minScore: 0, maxScore: 10, weight })),
    );
    expect(allMin).toBe(0);
  });

  it("does not divide by zero when a criterion has max_score === min_score (defensive — DB CHECK should already block this)", () => {
    const result = calculateCompositeScore([
      { score: 5, minScore: 5, maxScore: 5, weight: 1 },
      { score: 10, minScore: 0, maxScore: 10, weight: 1 },
    ]);
    // Degenerate criterion contributes 0 to the numerator but still counts its weight
    // in the denominator (mirrors SQL sum() ignoring a NULL term): (0 + 1*1) / 2 * 100 = 50.
    expect(result).toBe(50);
  });

  it("rounds to 4 decimal places", () => {
    const result = calculateCompositeScore([
      { score: 1, minScore: 0, maxScore: 3, weight: 1 },
      { score: 2, minScore: 0, maxScore: 7, weight: 1 },
    ]);
    // c1: 1/3 = 0.333333... ; c2: 2/7 = 0.285714... ; avg * 100, rounded to 4dp.
    expect(result).toBe(30.9524);
  });
});
