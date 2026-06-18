# -*- coding: utf-8 -*-
"""Versioned, anonymised evaluation fixtures.

Bump DATASET_VERSION whenever the gold labels change so results stay comparable
across runs. All data is synthetic — no real candidates or companies.
"""

DATASET_VERSION = "eval_v1_2026_06"

# ── Relevance / scoring cases ────────────────────────────────────────────────
# Each case = a profile + a set of offers with pre-extracted signals and a human
# "gold" label. Pre-baked signals isolate the SCORER from the AI extractor so the
# result is fully deterministic. gold_label ∈ {APLICA, QUIZÁ, NO_ENCAJA}.

_PROFILE_FRONT = {
    "experience": "2",
    "stack": ["React", "TypeScript", "JavaScript", "CSS", "Node.js"],
    "english": "b2",
    "ubicaciones": ["Madrid"],
    "modalidad": ["remoto"],
    "idiomas": [],
}

_PROFILE_BACK = {
    "experience": "6",
    "stack": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    "english": "c1",
    "ubicaciones": ["Madrid"],
    "modalidad": ["remoto", "hibrido"],
    "idiomas": [],
}


def _sig(**kwargs):
    base = {
        "normalized_role": None, "seniority_level": None, "required_skills": [],
        "preferred_skills": [], "required_languages": [], "work_mode": None,
        "location_constraints": [], "salary_signal": None, "critical_requirements": [],
        "must_have_requirements": [], "nice_to_have": [], "hard_constraints": [],
        "required_skill_years": [], "red_flags": [], "requires_explicit_years": False,
        "required_years_min": None,
    }
    base.update(kwargs)
    return base


RELEVANCE_CASES = [
    {
        "label": "Frontend React junior",
        "profile": _PROFILE_FRONT,
        "offers": [
            {"id": 1, "titulo": "Frontend Developer (React)", "empresa": "A", "ubicacion": "Madrid",
             "salario": "", "descripcion": "React y TypeScript en remoto.",
             "signals": _sig(normalized_role="frontend", seniority_level="junior", work_mode="remote",
                             required_skills=["React", "TypeScript"]),
             "gold_label": "APLICA"},
            {"id": 2, "titulo": "Fullstack JavaScript", "empresa": "B", "ubicacion": "Remoto",
             "salario": "", "descripcion": "React y Node.js.",
             "signals": _sig(normalized_role="fullstack", seniority_level="mid", work_mode="remote",
                             required_skills=["React", "Node.js"]),
             "gold_label": "APLICA"},
            {"id": 3, "titulo": "Frontend Engineer (Angular)", "empresa": "C", "ubicacion": "Madrid",
             "salario": "", "descripcion": "Angular y TypeScript.",
             "signals": _sig(normalized_role="frontend", seniority_level="mid",
                             required_skills=["Angular", "TypeScript"]),
             "gold_label": "QUIZÁ"},
            {"id": 4, "titulo": "Senior Java Backend", "empresa": "D", "ubicacion": "Bilbao",
             "salario": "", "descripcion": "Java, Spring, 6+ años.",
             "signals": _sig(normalized_role="backend", seniority_level="senior", required_years_min=6,
                             required_skills=["Java", "Spring"], critical_requirements=["Java"]),
             "gold_label": "NO_ENCAJA"},
            {"id": 5, "titulo": "Data Scientist", "empresa": "E", "ubicacion": "Madrid",
             "salario": "", "descripcion": "Python, Pandas, TensorFlow.",
             "signals": _sig(normalized_role="data", seniority_level="mid",
                             required_skills=["Python", "Pandas", "TensorFlow"]),
             "gold_label": "NO_ENCAJA"},
        ],
    },
    {
        "label": "Backend Python senior",
        "profile": _PROFILE_BACK,
        "offers": [
            {"id": 1, "titulo": "Senior Backend Python", "empresa": "F", "ubicacion": "Madrid",
             "salario": "45.000 EUR", "descripcion": "Python, FastAPI, 5+ años, remoto.",
             "signals": _sig(normalized_role="backend", seniority_level="senior", required_years_min=5,
                             work_mode="remote", required_skills=["Python", "FastAPI"],
                             salary_signal="45.000 EUR"),
             "gold_label": "APLICA"},
            {"id": 2, "titulo": "DevOps Engineer", "empresa": "G", "ubicacion": "Madrid",
             "salario": "", "descripcion": "Kubernetes, Terraform, AWS.",
             "signals": _sig(normalized_role="devops", seniority_level="mid",
                             required_skills=["Kubernetes", "Terraform", "AWS"]),
             "gold_label": "QUIZÁ"},
            {"id": 3, "titulo": "Junior Frontend React", "empresa": "H", "ubicacion": "Valencia",
             "salario": "", "descripcion": "React, junior, presencial.",
             "signals": _sig(normalized_role="frontend", seniority_level="junior", work_mode="onsite",
                             required_skills=["React"], location_constraints=["Valencia"]),
             "gold_label": "NO_ENCAJA"},
        ],
    },
]


# ── Skill / seniority extraction cases ───────────────────────────────────────
# Free-text offers + gold skills/seniority. Exercises the deterministic
# heuristic extractor (no AI). Skills compared case-insensitively.

EXTRACTION_CASES = [
    {"titulo": "Backend Developer",
     "descripcion": "Buscamos desarrollador con experiencia en Python, Django y PostgreSQL. Valorable Docker.",
     "gold_skills": {"python", "django", "postgresql", "docker"}, "gold_seniority": None},
    {"titulo": "Senior React Engineer",
     "descripcion": "Senior con 5+ años en React, TypeScript y Node.js.",
     "gold_skills": {"react", "typescript", "node.js"}, "gold_seniority": "senior"},
    {"titulo": "Data Engineer",
     "descripcion": "Spark, Airflow, SQL y AWS para pipelines de datos.",
     "gold_skills": {"spark", "airflow", "sql", "aws"}, "gold_seniority": None},
    {"titulo": "Junior QA Automation",
     "descripcion": "Junior con Selenium y conocimientos de Java.",
     "gold_skills": {"java"}, "gold_seniority": "junior"},
]


# ── Natural-language interpretation cases ────────────────────────────────────
# Exercises the deterministic fallback interpreter (no AI). Each expected field
# set to None is not checked; "skills" is checked as a case-insensitive subset.

INTERPRETATION_CASES = [
    {"instruction": "Busco ofertas junior de React en remoto",
     "profile": _PROFILE_FRONT,
     "expected": {"skills_subset": {"react"}, "remote_allowed": True,
                  "seniority": {"junior"}, "salary_min": None, "max_age_days": None}},
    {"instruction": "Quiero posiciones senior de Python y FastAPI en remoto con salario superior a 40000 euros",
     "profile": _PROFILE_BACK,
     "expected": {"skills_subset": {"python", "fastapi"}, "remote_allowed": True,
                  "seniority": {"senior"}, "salary_min": 40000, "max_age_days": None}},
    {"instruction": "Ofertas de Django publicadas en los últimos 7 días",
     "profile": _PROFILE_BACK,
     "expected": {"skills_subset": {"django"}, "remote_allowed": None,
                  "seniority": set(), "salary_min": None, "max_age_days": 7}},
]
