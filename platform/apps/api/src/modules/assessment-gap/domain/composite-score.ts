/**
 * Port của công thức trong `validate_and_calculate_assessment_submission()`
 * (docs/spec/production_constraints_and_indexes.sql dòng 376-441):
 *
 *   composite_score = round(
 *     100 * Σ((score - min_score) / (max_score - min_score) * weight) / Σ(weight),
 *     4
 *   )
 *
 * Tính weighted-average đã chuẩn hoá về thang 0-100. Viết lại thuần TypeScript để unit
 * test được mà không cần Postgres thật — đúng ghi chú Phase 4 mới trong CLAUDE.md (viết
 * test cho hàm này TRƯỚC khi viết endpoint gọi tới) và CLAUDE.md rule "client không
 * quyết định composite score" (UC-ASM-01) — hàm này luôn chạy phía server.
 */
export interface WeightedScore {
  score: number;
  minScore: number;
  maxScore: number;
  weight: number;
}

/** `maxScore === minScore` cho 1 criterion (không nên xảy ra — `chk_assessment_
 * criterion_score_range` đã chặn `max_score > min_score` ở DB) được bỏ qua an toàn
 * (không cộng vào tử số) thay vì chia cho 0 — mirror hành vi `nullif(...,0)` trong SQL
 * mẫu (SUM bỏ qua NULL). */
export function calculateCompositeScore(scores: readonly WeightedScore[]): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const s of scores) {
    const range = s.maxScore - s.minScore;
    if (range !== 0) {
      weightedSum += ((s.score - s.minScore) / range) * s.weight;
    }
    weightTotal += s.weight;
  }

  if (weightTotal === 0) return 0;

  const raw = (100 * weightedSum) / weightTotal;
  return Math.round(raw * 10000) / 10000;
}
