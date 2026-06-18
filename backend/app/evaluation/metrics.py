# -*- coding: utf-8 -*-
"""Pure metric helpers used by the evaluation harness. No external deps."""


def precision_at_k(ranked_relevance: list[bool], k: int) -> float:
    """Fraction of the top-k ranked items that are actually relevant."""
    top = ranked_relevance[:k]
    if not top:
        return 0.0
    return sum(1 for r in top if r) / len(top)


def recall_at_k(ranked_relevance: list[bool], k: int, total_relevant: int) -> float:
    if total_relevant <= 0:
        return 0.0
    hits = sum(1 for r in ranked_relevance[:k] if r)
    return hits / total_relevant


def accuracy(pairs: list[tuple]) -> float:
    """Share of (predicted, expected) pairs that match exactly."""
    if not pairs:
        return 0.0
    return sum(1 for predicted, expected in pairs if predicted == expected) / len(pairs)


def prf(predicted: set, expected: set) -> tuple[float, float, float]:
    """Precision, recall, F1 between two sets (e.g. extracted vs gold skills)."""
    if not predicted and not expected:
        return 1.0, 1.0, 1.0
    tp = len(predicted & expected)
    precision = tp / len(predicted) if predicted else 0.0
    recall = tp / len(expected) if expected else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return precision, recall, f1


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0
