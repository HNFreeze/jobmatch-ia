# -*- coding: utf-8 -*-
"""Offline evaluation runner.  Usage:  python -m app.evaluation.run

Prints objective, reproducible metrics for the matching scorer, the skill /
seniority extractor and the natural-language interpreter, against the versioned
fixture dataset. No database or Claude API calls are made.
"""
import sys
import time

from app.evaluation import metrics
from app.evaluation.dataset import (
    DATASET_VERSION,
    EXTRACTION_CASES,
    INTERPRETATION_CASES,
    RELEVANCE_CASES,
)
from app.services.agent_service import fallback_interpretation
from app.services.matching_service import (
    _evaluate_offer_match,
    _heuristic_offer_signals,
    _infer_seniority,
    _sort_by_fit,
)

RELEVANT_LABELS = {"APLICA", "QUIZÁ"}


def _evaluate_relevance() -> dict:
    p_at_3, p_at_5, label_pairs = [], [], []
    latencies_ms = []
    for case in RELEVANCE_CASES:
        profile = case["profile"]
        gold_by_id = {o["id"]: o["gold_label"] for o in case["offers"]}
        relevant_by_id = {o["id"]: o["gold_label"] in RELEVANT_LABELS for o in case["offers"]}

        start = time.perf_counter()
        results = [_evaluate_offer_match(profile, o, o["signals"]) for o in case["offers"]]
        ranked = _sort_by_fit(results)
        latencies_ms.append((time.perf_counter() - start) * 1000)

        ranked_relevance = [relevant_by_id.get(r["id"], False) for r in ranked]
        p_at_3.append(metrics.precision_at_k(ranked_relevance, 3))
        p_at_5.append(metrics.precision_at_k(ranked_relevance, 5))
        for r in results:
            label_pairs.append((r["resultado"], gold_by_id.get(r["id"])))

    return {
        "precision_at_3": metrics.mean(p_at_3),
        "precision_at_5": metrics.mean(p_at_5),
        "label_accuracy": metrics.accuracy(label_pairs),
        "n_offers": len(label_pairs),
        "avg_latency_ms": metrics.mean(latencies_ms),
    }


def _evaluate_extraction() -> dict:
    f1s, sen_pairs = [], []
    for case in EXTRACTION_CASES:
        offer = {"titulo": case["titulo"], "descripcion": case["descripcion"], "ubicacion": ""}
        signals = _heuristic_offer_signals(offer)
        extracted = {s.lower() for s in signals.get("required_skills", [])}
        _, _, f1 = metrics.prf(extracted, {s.lower() for s in case["gold_skills"]})
        f1s.append(f1)
        sen_pairs.append((_infer_seniority(f"{case['titulo']} {case['descripcion']}"), case["gold_seniority"]))
    return {
        "skill_f1": metrics.mean(f1s),
        "seniority_accuracy": metrics.accuracy(sen_pairs),
        "n_cases": len(EXTRACTION_CASES),
    }


def _evaluate_interpretation() -> dict:
    field_pairs = []
    for case in INTERPRETATION_CASES:
        instr = fallback_interpretation(case["instruction"], case["profile"])
        exp = case["expected"]
        got_skills = {s.lower() for s in instr.skills}
        field_pairs.append((exp["skills_subset"] <= got_skills, True))
        if exp["remote_allowed"] is not None:
            field_pairs.append((instr.remote_allowed, exp["remote_allowed"]))
        field_pairs.append((set(instr.seniority) == exp["seniority"], True))
        if exp["salary_min"] is not None:
            field_pairs.append((instr.salary_min, exp["salary_min"]))
        if exp["max_age_days"] is not None:
            field_pairs.append((instr.max_age_days, exp["max_age_days"]))
    return {"field_accuracy": metrics.accuracy(field_pairs), "n_checks": len(field_pairs)}


def main() -> int:
    rel = _evaluate_relevance()
    ext = _evaluate_extraction()
    interp = _evaluate_interpretation()

    print("=" * 64)
    print(f" JobMatch IA — Evaluación offline  ({DATASET_VERSION})")
    print("=" * 64)
    print("\n[Matching / relevancia]  (scorer determinista, señales pre-extraídas)")
    print(f"  Precision@3:       {rel['precision_at_3']:.2f}")
    print(f"  Precision@5:       {rel['precision_at_5']:.2f}")
    print(f"  Exactitud etiqueta:{rel['label_accuracy']:.2f}  (APLICA/QUIZÁ/NO_ENCAJA, n={rel['n_offers']})")
    print(f"  Latencia media:    {rel['avg_latency_ms']:.2f} ms / búsqueda")

    print("\n[Extracción de skills / seniority]  (heurística determinista)")
    print(f"  F1 skills:         {ext['skill_f1']:.2f}  (n={ext['n_cases']})")
    print(f"  Exactitud seniority:{ext['seniority_accuracy']:.2f}")

    print("\n[Interpretación de instrucciones]  (fallback determinista, sin IA)")
    print(f"  Exactitud campos:  {interp['field_accuracy']:.2f}  (n={interp['n_checks']})")

    print("\n[Coste / latencia de IA]")
    print("  N/A offline: el scorer y la extracción heurística no llaman a la IA.")
    print("  El coste real (tokens, USD, % caché) se registra por petición en")
    print("  ai_api_cost_events y se agrega en /api/admin/ai-usage.")
    print("=" * 64)

    # No falla el pipeline por umbrales (evaluación informativa); sí si hay excepción.
    return 0


if __name__ == "__main__":
    sys.exit(main())
