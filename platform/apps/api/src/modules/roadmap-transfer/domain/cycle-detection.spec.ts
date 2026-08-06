import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "./cycle-detection";

describe("wouldCreateCycle (§4.8 — cycle detection, port từ prevent_milestone_dependency_cycle)", () => {
  it("returns false for an empty dependency graph", () => {
    expect(wouldCreateCycle([], "m1", "m2")).toBe(false);
  });

  it("returns false when the new edge does not close any path", () => {
    const edges = [
      { predecessorMilestoneId: "m1", successorMilestoneId: "m2" },
      { predecessorMilestoneId: "m2", successorMilestoneId: "m3" },
    ];
    // m3 -> m4 is a fresh forward edge, no path back to m3 exists.
    expect(wouldCreateCycle(edges, "m3", "m4")).toBe(false);
  });

  it("detects a direct 2-node cycle (A->B, then proposing B->A)", () => {
    const edges = [{ predecessorMilestoneId: "m1", successorMilestoneId: "m2" }];
    expect(wouldCreateCycle(edges, "m2", "m1")).toBe(true);
  });

  it("detects an indirect cycle through multiple nodes (A->B->C, then proposing C->A)", () => {
    const edges = [
      { predecessorMilestoneId: "m1", successorMilestoneId: "m2" },
      { predecessorMilestoneId: "m2", successorMilestoneId: "m3" },
    ];
    expect(wouldCreateCycle(edges, "m3", "m1")).toBe(true);
  });

  it("detects a longer indirect cycle (A->B->C->D, then proposing D->A)", () => {
    const edges = [
      { predecessorMilestoneId: "m1", successorMilestoneId: "m2" },
      { predecessorMilestoneId: "m2", successorMilestoneId: "m3" },
      { predecessorMilestoneId: "m3", successorMilestoneId: "m4" },
    ];
    expect(wouldCreateCycle(edges, "m4", "m1")).toBe(true);
  });

  it("does not flag unrelated branches of the same graph as a cycle", () => {
    const edges = [
      { predecessorMilestoneId: "m1", successorMilestoneId: "m2" },
      { predecessorMilestoneId: "m3", successorMilestoneId: "m4" },
    ];
    // m2 and m3/m4 are disconnected components — no cycle possible.
    expect(wouldCreateCycle(edges, "m2", "m3")).toBe(false);
  });

  it("detects a self-loop as a cycle (predecessor === successor)", () => {
    expect(wouldCreateCycle([], "m1", "m1")).toBe(true);
  });

  it("does not false-positive when a diamond dependency merges but doesn't cycle", () => {
    // m1 -> m2, m1 -> m3, m2 -> m4, m3 -> m4 (diamond shape) — proposing m4 -> m5 is fine.
    const edges = [
      { predecessorMilestoneId: "m1", successorMilestoneId: "m2" },
      { predecessorMilestoneId: "m1", successorMilestoneId: "m3" },
      { predecessorMilestoneId: "m2", successorMilestoneId: "m4" },
      { predecessorMilestoneId: "m3", successorMilestoneId: "m4" },
    ];
    expect(wouldCreateCycle(edges, "m4", "m5")).toBe(false);
  });
});
