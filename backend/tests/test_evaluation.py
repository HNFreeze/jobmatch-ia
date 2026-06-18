# -*- coding: utf-8 -*-
"""Tests for the offline evaluation harness and its metric helpers."""
from app.evaluation import metrics
from app.evaluation.run import (
    _evaluate_extraction,
    _evaluate_interpretation,
    _evaluate_relevance,
    main,
)


def test_precision_at_k():
    assert metrics.precision_at_k([True, True, False, False], 2) == 1.0
    assert metrics.precision_at_k([True, False, True, False], 4) == 0.5
    assert metrics.precision_at_k([], 3) == 0.0


def test_prf_perfect_and_partial():
    assert metrics.prf({"a", "b"}, {"a", "b"}) == (1.0, 1.0, 1.0)
    p, r, f = metrics.prf({"a", "x"}, {"a", "b"})
    assert p == 0.5 and r == 0.5


def test_accuracy():
    assert metrics.accuracy([("a", "a"), ("b", "c")]) == 0.5
    assert metrics.accuracy([]) == 0.0


def test_relevance_eval_runs_and_is_reasonable():
    result = _evaluate_relevance()
    # Sanity bounds — the deterministic scorer should clearly beat random.
    assert 0.0 <= result["precision_at_3"] <= 1.0
    assert result["label_accuracy"] >= 0.6
    assert result["n_offers"] == 8


def test_extraction_and_interpretation_eval_run():
    ext = _evaluate_extraction()
    assert ext["seniority_accuracy"] >= 0.5
    assert 0.0 <= ext["skill_f1"] <= 1.0
    interp = _evaluate_interpretation()
    assert interp["field_accuracy"] >= 0.8


def test_main_returns_zero():
    assert main() == 0
