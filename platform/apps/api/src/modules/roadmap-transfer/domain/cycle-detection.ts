/**
 * Port của thuật toán `prevent_milestone_dependency_cycle()` trong
 * docs/spec/production_constraints_and_indexes.sql (dòng 506-549) — SQL dùng `WITH
 * RECURSIVE reachable` để kiểm tra "từ successor có đi được tới predecessor không"
 * trước khi cho thêm edge mới; nếu có nghĩa là thêm edge sẽ khép thành 1 chu trình.
 * Viết lại thuần TypeScript (BFS) để unit test được mà không cần Postgres thật — đúng
 * khuyến nghị §4.8 01_workflow_theo_phase.md ("không lồng chung với logic tạo
 * milestone") và ghi chú Phase 4 mới trong CLAUDE.md (viết test cho hàm này TRƯỚC khi
 * viết endpoint gọi tới).
 *
 * Chỉ kiểm tra graph reachability thuần — KHÔNG kiểm tra 2 milestone có cùng roadmap
 * hay không (đó là check riêng ở service, tương ứng
 * `MILESTONE_DEPENDENCIES_MUST_BE_IN_SAME_ROADMAP`).
 */
export interface DependencyEdge {
  predecessorMilestoneId: string;
  successorMilestoneId: string;
}

/** Trả `true` nếu thêm edge `newPredecessorId -> newSuccessorId` vào tập `existingEdges`
 * sẽ tạo thành chu trình (bao gồm cả trường hợp tự trỏ, `newPredecessorId ===
 * newSuccessorId`, dù service nên chặn riêng bằng thông báo `chk_dependency_not_self`
 * rõ ràng hơn trước khi gọi tới đây). */
export function wouldCreateCycle(
  existingEdges: readonly DependencyEdge[],
  newPredecessorId: string,
  newSuccessorId: string,
): boolean {
  const visited = new Set<string>();
  const queue: string[] = [newSuccessorId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === newPredecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of existingEdges) {
      if (edge.predecessorMilestoneId === current) {
        queue.push(edge.successorMilestoneId);
      }
    }
  }

  return false;
}
