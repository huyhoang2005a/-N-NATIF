/**
 * Generic finite-state transition table. Domain services call `assertTransition` instead of
 * writing `status` columns directly (mandatory rule: state transitions only via domain
 * service — see CLAUDE.md rule #2 and architecture plan §8.1).
 */
export class TransitionTable<TState extends string> {
  private readonly allowed: Map<TState, Set<TState>>;

  constructor(edges: Record<TState, readonly TState[]>) {
    this.allowed = new Map(
      Object.entries(edges).map(([from, tos]) => [from as TState, new Set(tos as TState[])]),
    );
  }

  canTransition(from: TState, to: TState): boolean {
    return this.allowed.get(from)?.has(to) ?? false;
  }
}
