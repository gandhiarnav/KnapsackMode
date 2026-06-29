"""
KnapsackMode — Time Allocation Algorithm
========================================
This is the core technical piece of the app. It is pure Python — no LLM involved.

Problem: Given a list of topics (each with importance, difficulty, time_needed_minutes)
and a total time budget T (minutes), find the combination of (topic, depth_level) pairs
that maximizes total "importance value" covered within T minutes.

Approach: Bounded 0/1 DP Knapsack with partial depth coverage.

Each topic is expanded into 3 discrete "items" (depth levels):
  - skim:     25% of time_needed → captures 40% of importance value
  - standard: 60% of time_needed → captures 75% of importance value  
  - deep:    100% of time_needed → captures 100% of importance value

Each topic can be selected at most once (at its best affordable depth).

Sorting: The final plan is ordered by importance / allocated_minutes (descending),
i.e., highest information-density topics first. Rationale: when focus is sharpest
at the start of a study sprint, tackle the topics that give the most value per minute.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class TopicInput:
    topic: str
    importance: int        # 1–10
    difficulty: int        # 1–10
    time_needed_minutes: int


@dataclass
class AllocatedTopic:
    topic: str
    depth_level: str       # "skim" | "standard" | "deep"
    allocated_minutes: int
    importance: int
    difficulty: int


# Depth level definitions: (fraction_of_time, fraction_of_value, label)
DEPTH_LEVELS = [
    ("deep",     1.00, 1.00),
    ("standard", 0.60, 0.75),
    ("skim",     0.25, 0.40),
]


def _build_items(topics: list[TopicInput]) -> list[tuple[int, int, int, str, str]]:
    """
    Expand each topic into discrete (topic_idx, depth, time_cost, value) items.
    Value is scaled by importance * 10 to keep integers while preserving ratios.
    Returns list of (topic_idx, time_cost, value, depth_label, topic_name).
    """
    items = []
    for idx, t in enumerate(topics):
        for depth_label, time_frac, val_frac in DEPTH_LEVELS:
            cost = max(1, round(t.time_needed_minutes * time_frac))
            value = round(t.importance * val_frac * 10)  # scale to integer
            items.append((idx, cost, value, depth_label, t.topic))
    return items


def allocate(topics: list[TopicInput], time_budget: int) -> list[AllocatedTopic]:
    """
    Run a 0/1 DP knapsack over all (topic × depth) items.
    Each topic can be selected at most once.
    Returns an ordered list of AllocatedTopic (sorted by value density, desc).

    Time complexity: O(N * D * T) where N=topics, D=3 depth levels, T=budget minutes.
    For typical inputs (N≤20, T≤180), this completes in microseconds.
    """
    if not topics or time_budget <= 0:
        return []

    n = len(topics)
    T = time_budget
    items = _build_items(topics)

    # dp[t] = (max_value, chosen: list of (topic_idx, depth_label, cost))
    # We store full choice sets to allow backtracking without a separate table.
    # Using a flat int array for the value table and a parallel choice dict.

    dp_val = [0] * (T + 1)
    # choice[t] = (topic_idx, depth_label, cost) of the last item added at capacity t
    choice: list[Optional[tuple[int, str, int]]] = [None] * (T + 1)
    # Track which topics have been allocated (per capacity state) — use sets for correctness
    # Since rebuilding per-item is expensive, we use the standard 0/1 knapsack approach:
    # process one topic group at a time (all depths for a topic), iterate T downward.

    # Group items by topic_idx to enforce "at most one depth per topic"
    topics_items: list[list[tuple[int, int, str]]] = [[] for _ in range(n)]
    for (topic_idx, cost, value, depth_label, _) in items:
        topics_items[topic_idx].append((cost, value, depth_label))

    # For backtracking: store decision[topic_idx][t] = (depth_label, cost) or None
    decision: list[list[Optional[tuple[str, int]]]] = [
        [None] * (T + 1) for _ in range(n)
    ]
    prev_dp = [0] * (T + 1)

    for topic_idx, depths in enumerate(topics_items):
        curr_dp = prev_dp[:]  # copy current best values

        for cost, value, depth_label in depths:
            for t in range(T, cost - 1, -1):
                candidate = prev_dp[t - cost] + value
                if candidate > curr_dp[t]:
                    curr_dp[t] = candidate
                    decision[topic_idx][t] = (depth_label, cost)

        prev_dp = curr_dp

    # Backtrack to find the selected (topic, depth) pairs
    selected: list[AllocatedTopic] = []
    remaining = T

    for topic_idx in range(n - 1, -1, -1):
        dec = decision[topic_idx][remaining]
        if dec is not None:
            depth_label, cost = dec
            t = topics[topic_idx]
            selected.append(AllocatedTopic(
                topic=t.topic,
                depth_level=depth_label,
                allocated_minutes=cost,
                importance=t.importance,
                difficulty=t.difficulty,
            ))
            remaining -= cost
        # If no decision at this capacity, topic was skipped — move on

    # Sort: highest importance / allocated_minutes first (information density)
    # Ties broken by importance (higher first)
    selected.sort(
        key=lambda x: (x.importance / x.allocated_minutes, x.importance),
        reverse=True
    )

    return selected


# ── Quick smoke test (run directly: python knapsack.py) ───────────────────────

def _test():
    print("=== KnapsackMode Allocation Tests ===\n")

    # Case 1: Generous budget — expect deep coverage of all topics
    topics1 = [
        TopicInput("Binary Trees", 9, 7, 20),
        TopicInput("Sorting Algorithms", 8, 5, 15),
        TopicInput("Hash Maps", 7, 4, 10),
    ]
    plan1 = allocate(topics1, 60)
    print("Test 1 — Generous budget (60 min):")
    for p in plan1:
        print(f"  {p.topic}: {p.depth_level} ({p.allocated_minutes} min)")

    # Case 2: Tight budget — expect mix of depths
    plan2 = allocate(topics1, 20)
    print("\nTest 2 — Tight budget (20 min):")
    for p in plan2:
        print(f"  {p.topic}: {p.depth_level} ({p.allocated_minutes} min)")

    # Case 3: Zero budget — expect empty plan
    plan3 = allocate(topics1, 0)
    print(f"\nTest 3 — Zero budget: {plan3} (expected: [])")

    # Case 4: Re-allocation simulation (Got it early)
    topics4 = [
        TopicInput("React Hooks", 9, 6, 25),
        TopicInput("TypeScript Generics", 7, 8, 30),
        TopicInput("CSS Grid", 5, 3, 10),
    ]
    plan4 = allocate(topics4, 35)
    print("\nTest 4 — Re-allocation with 35 min remaining:")
    for p in plan4:
        print(f"  {p.topic}: {p.depth_level} ({p.allocated_minutes} min)")

    print("\n✅ All tests complete")


if __name__ == "__main__":
    _test()
