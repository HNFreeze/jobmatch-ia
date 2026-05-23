# -*- coding: utf-8 -*-
"""
Tests unitarios ampliados para el motor de matching de JobMatch-IA.

Cubre:
  - Utilidades de normalización de texto y de perfil
  - Sinónimos técnicos (TECH_NAME_SYNONYMS)
  - Filtro is_tech_offer
  - Extracción heurística de señales
  - Evaluación de match (_evaluate_offer_match)
  - Filtros post-evaluación (ghost-QUIZÁ, zero-match, data-domain mismatch)
  - Ranking (_sort_by_fit)
  - Deduplicación de listas
"""

from app.services.matching_service import (
    _normalize_text,
    _normalize_profile_stack,
    _dedupe_keep_order,
    _is_tech_offer,
    _heuristic_offer_signals,
    _evaluate_offer_match,
    _sort_by_fit,
    TECH_NAME_SYNONYMS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de fixtures reutilizables
# ─────────────────────────────────────────────────────────────────────────────

def _make_offer(
    id: int = 1,
    titulo: str = "Software Engineer",
    empresa: str = "Acme",
    ubicacion: str = "Madrid",
    descripcion: str = "",
    salario: str = "40k",
    source_type: str = "official_api",
    source_confidence: float = 0.90,
    freshness_state: str = "verified_recently",
    verified_recently: bool = True,
    url: str = "https://example.com/jobs/1",
) -> dict:
    return {
        "id": id,
        "titulo": titulo,
        "empresa": empresa,
        "ubicacion": ubicacion,
        "descripcion": descripcion,
        "salario": salario,
        "source_type": source_type,
        "source_confidence": source_confidence,
        "freshness_state": freshness_state,
        "verified_recently": verified_recently,
        "url": url,
    }


def _make_signals(
    required_skills: list | None = None,
    preferred_skills: list | None = None,
    normalized_role: str | None = "backend",
    seniority_level: str | None = "mid",
    required_years_min: int | None = None,
    required_languages: list | None = None,
    work_mode: str | None = None,
    location_constraints: list | None = None,
    critical_requirements: list | None = None,
    must_have_requirements: list | None = None,
    hard_constraints: list | None = None,
    required_skill_years: list | None = None,
) -> dict:
    return {
        "required_skills": required_skills or [],
        "preferred_skills": preferred_skills or [],
        "normalized_role": normalized_role,
        "seniority_level": seniority_level,
        "required_years_min": required_years_min,
        "required_languages": required_languages or [],
        "work_mode": work_mode,
        "location_constraints": location_constraints or [],
        "critical_requirements": critical_requirements or [],
        "must_have_requirements": must_have_requirements or [],
        "hard_constraints": hard_constraints or [],
        "required_skill_years": required_skill_years or [],
    }


def _make_profile(
    stack: list | None = None,
    experience: str = "3",
    english: str = "",
    idiomas: list | None = None,
    ubicaciones: list | None = None,
    modalidad: list | None = None,
) -> dict:
    return {
        "stack": stack or [],
        "experience": experience,
        "english": english,
        "idiomas": idiomas or [],
        "ubicaciones": ubicaciones or ["Madrid"],
        "modalidad": modalidad or ["Remoto", "Hibrido"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 1: test_normalize_text
# ─────────────────────────────────────────────────────────────────────────────

def test_normalize_text():
    """Verifica que _normalize_text elimina acentos, pasa a minúsculas y colapsa espacios."""
    assert _normalize_text("Físico Cuántico") == "fisico cuantico"
    assert _normalize_text("  Ángela   García  ") == "angela garcia"
    assert _normalize_text("Ü über") == "u uber"
    assert _normalize_text("Ñoño") == "nono"
    assert _normalize_text(None) == ""
    assert _normalize_text("") == ""
    assert _normalize_text("PYTHON") == "python"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 2: test_tech_name_synonyms
# ─────────────────────────────────────────────────────────────────────────────

def test_tech_name_synonyms():
    """Verifica que 'go' está mapeado a 'golang' en TECH_NAME_SYNONYMS."""
    assert "go" in TECH_NAME_SYNONYMS
    assert TECH_NAME_SYNONYMS["go"] == "golang"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 3: test_is_tech_offer_true
# ─────────────────────────────────────────────────────────────────────────────

def test_is_tech_offer_true():
    """Una oferta con 'Python' en el título debe reconocerse como tech."""
    offer = _make_offer(titulo="Python Developer Backend", descripcion="Desarrollarás APIs con Python y FastAPI.")
    assert _is_tech_offer(offer) is True


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 4: test_is_tech_offer_false
# ─────────────────────────────────────────────────────────────────────────────

def test_is_tech_offer_false():
    """Una oferta de gestión de flotas no debe reconocerse como tech."""
    offer = _make_offer(
        titulo="Coordinador de Flotas",
        descripcion="Gestión de vehículos, rutas y coordinación logística con proveedores de transporte.",
    )
    assert _is_tech_offer(offer) is False


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 5: test_is_tech_offer_false_finance
# ─────────────────────────────────────────────────────────────────────────────

def test_is_tech_offer_false_finance():
    """Una oferta de 'Treasury Analyst' (financiero) no debe reconocerse como tech."""
    offer = _make_offer(
        titulo="Treasury Analyst",
        descripcion="Gestión de tesorería, flujos de caja, reporting financiero y relación con entidades bancarias.",
    )
    assert _is_tech_offer(offer) is False


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 6: test_heuristic_signals_extracts_skills
# ─────────────────────────────────────────────────────────────────────────────

def test_heuristic_signals_extracts_skills():
    """Verifica que _heuristic_offer_signals extrae Python y Docker de la descripción."""
    offer = _make_offer(
        titulo="Backend Engineer",
        descripcion="Buscamos desarrollador con experiencia en Python y Docker. Valorable FastAPI.",
    )
    signals = _heuristic_offer_signals(offer)
    all_skills = signals["required_skills"] + signals["preferred_skills"]
    skill_names_lower = [s.lower() for s in all_skills]
    assert "python" in skill_names_lower
    assert "docker" in skill_names_lower


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 7: test_heuristic_signals_work_mode_remote
# ─────────────────────────────────────────────────────────────────────────────

def test_heuristic_signals_work_mode_remote():
    """Verifica que la heurística detecta modalidad remoto."""
    offer = _make_offer(
        titulo="Backend Python",
        descripcion="Posición 100% remoto. Teletrabajo completo desde cualquier lugar de España.",
    )
    signals = _heuristic_offer_signals(offer)
    assert signals["work_mode"] == "remote"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 8: test_heuristic_signals_work_mode_hybrid
# ─────────────────────────────────────────────────────────────────────────────

def test_heuristic_signals_work_mode_hybrid():
    """Verifica que la heurística detecta modalidad híbrido."""
    offer = _make_offer(
        titulo="Backend Python",
        descripcion="Modalidad híbrida: 2 días en oficina y 3 días de teletrabajo por semana.",
    )
    signals = _heuristic_offer_signals(offer)
    assert signals["work_mode"] == "hybrid"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 9: test_heuristic_signals_english_required
# ─────────────────────────────────────────────────────────────────────────────

def test_heuristic_signals_english_required():
    """Verifica que la heurística detecta inglés como idioma requerido."""
    offer = _make_offer(
        titulo="Backend Developer",
        descripcion="Se requiere inglés B2 para comunicarse con el equipo internacional. English required.",
    )
    signals = _heuristic_offer_signals(offer)
    required_langs_lower = [lang.lower() for lang in signals["required_languages"]]
    assert "ingles" in required_langs_lower


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 10: test_evaluate_match_aplica_full_match
# ─────────────────────────────────────────────────────────────────────────────

def test_evaluate_match_aplica_full_match():
    """Un perfil Python+FastAPI frente a oferta Python+FastAPI debe obtener APLICA o QUIZÁ con score>=50."""
    profile = _make_profile(stack=["Python", "FastAPI", "SQL"], experience="4")
    offer = _make_offer(
        titulo="Backend Python FastAPI Engineer",
        descripcion="Python, FastAPI, SQL, Docker.",
    )
    signals = _make_signals(
        required_skills=["Python", "FastAPI"],
        preferred_skills=["Docker"],
        normalized_role="backend",
        seniority_level="mid",
        required_years_min=3,
        work_mode="hybrid",
    )
    result = _evaluate_offer_match(profile, offer, signals)
    assert result["resultado"] in ("APLICA", "QUIZÁ")
    assert result["puntuacion"] >= 50


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 11: test_evaluate_match_no_encaja_zero_skills
# ─────────────────────────────────────────────────────────────────────────────

def test_evaluate_match_no_encaja_zero_skills():
    """Perfil sólo con React frente a oferta que requiere Python+ML debe ser NO_ENCAJA."""
    profile = _make_profile(stack=["React", "TypeScript"], experience="3")
    offer = _make_offer(
        titulo="Data Scientist Python ML",
        descripcion="Machine learning, Python, Pandas, scikit-learn, modelos predictivos.",
    )
    signals = _make_signals(
        required_skills=["Python", "machine learning"],
        preferred_skills=["Pandas", "scikit-learn"],
        normalized_role="data",
        seniority_level="mid",
    )
    result = _evaluate_offer_match(profile, offer, signals)
    assert result["resultado"] == "NO_ENCAJA"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 12: test_evaluate_match_ghost_quiza_degraded
# ─────────────────────────────────────────────────────────────────────────────

def test_evaluate_match_ghost_quiza_degraded():
    """Oferta sin skills (required=[],preferred=[]) que alcanza umbral QUIZÁ debe degradarse a NO_ENCAJA."""
    profile = _make_profile(
        stack=["Python", "FastAPI"],
        experience="3",
        english="c1",
        idiomas=[{"idioma": "Ingles", "nivel": "C1"}],
    )
    # Oferta fantasma: sin skills, pero con idioma/seniority/ubicacion que pueden inflar el score
    offer = _make_offer(
        titulo="Consultor de Negocio Digital",
        descripcion="Consultoría de transformación digital para empresas del sector financiero.",
        source_type="aggregator",
        source_confidence=0.51,
        freshness_state="stale_listing",
        verified_recently=False,
    )
    signals = _make_signals(
        required_skills=[],
        preferred_skills=[],
        normalized_role=None,
        seniority_level="mid",
        required_languages=["Ingles B2"],
        work_mode="hybrid",
    )
    result = _evaluate_offer_match(profile, offer, signals)
    # El filtro ghost-QUIZÁ debe degradar el resultado a NO_ENCAJA
    assert result["resultado"] == "NO_ENCAJA"


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 13: test_sort_by_fit_prioritizes_reliable_verified_offer
#  (Test original mantenido)
# ─────────────────────────────────────────────────────────────────────────────

def test_sort_by_fit_prioritizes_reliable_verified_offer():
    profile = {
        "stack": ["Python", "FastAPI", "SQL"],
        "experience": "3",
        "english": "c1",
        "idiomas": [{"idioma": "Ingles", "nivel": "C1"}],
        "ubicaciones": ["Madrid"],
        "modalidad": ["Remoto", "Hibrido"],
    }
    signals = {
        "required_skills": ["python"],
        "preferred_skills": ["fastapi"],
        "normalized_role": "backend",
        "seniority_level": "mid",
        "required_years_min": 2,
        "language_requirements": [],
        "work_mode": "hybrid",
    }

    reliable_offer = {
        "id": 1,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme",
        "ubicacion": "Madrid",
        "descripcion": "Python FastAPI SQL",
        "salario": "40k-45k",
        "source_type": "official_api",
        "source_confidence": 0.96,
        "freshness_state": "verified_recently",
        "verified_recently": True,
        "url": "https://example.com/jobs/1",
    }
    weak_offer = {
        "id": 2,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme Mirror",
        "ubicacion": "Madrid",
        "descripcion": "Python FastAPI SQL",
        "salario": "Salario no especificado",
        "source_type": "aggregator",
        "source_confidence": 0.51,
        "freshness_state": "stale_listing",
        "verified_recently": False,
        "url": "https://example.com/jobs/2",
    }

    reliable_result = _evaluate_offer_match(profile, reliable_offer, signals)
    weak_result = _evaluate_offer_match(profile, weak_offer, signals)

    ranked = _sort_by_fit([weak_result, reliable_result])

    assert reliable_result["ranking_score"] > weak_result["ranking_score"]
    assert ranked[0]["id"] == 1
    assert "fuente oficial" in reliable_result["quality_notes"]


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 14: test_heuristic_offer_signals_extracts_skill_years_and_constraints
#  (Test original mantenido)
# ─────────────────────────────────────────────────────────────────────────────

def test_heuristic_offer_signals_extracts_skill_years_and_constraints():
    offer = {
        "id": 1,
        "titulo": "Backend Python Engineer",
        "descripcion": (
            "Imprescindible experiencia con Python y FastAPI. "
            "Buscamos 3+ anos con Python y 2 anos con Docker. "
            "Posicion presencial en Madrid con guardias rotativas."
        ),
        "ubicacion": "Madrid",
        "salario": "40k-50k",
    }

    signals = _heuristic_offer_signals(offer)

    assert "Python" in signals["required_skills"]
    assert signals["required_years_min"] == 3
    assert any(item["skill"] == "Python" and item["years"] == 3 for item in signals["required_skill_years"])
    assert any("presencial" in item.lower() for item in signals["hard_constraints"])
    assert any("imprescindible" in item.lower() for item in signals["must_have_requirements"])


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 15: test_evaluate_offer_match_uses_skill_depth_requirements_as_blocker
#  (Test original mantenido)
# ─────────────────────────────────────────────────────────────────────────────

def test_evaluate_offer_match_uses_skill_depth_requirements_as_blocker():
    profile = {
        "stack": ["Python", "Docker"],
        "experience": "1",
        "english": "",
        "idiomas": [],
        "ubicaciones": ["Madrid"],
        "modalidad": ["Presencial"],
    }
    offer = {
        "id": 9,
        "titulo": "Backend Python Engineer",
        "empresa": "Acme",
        "ubicacion": "Madrid",
        "descripcion": "Python y Docker",
        "salario": "45k",
        "source_type": "official_api",
        "source_confidence": 0.91,
        "freshness_state": "verified_recently",
        "verified_recently": True,
        "url": "https://example.com/jobs/9",
    }
    signals = {
        "required_skills": ["Python", "Docker"],
        "preferred_skills": [],
        "critical_requirements": ["Python", "Docker"],
        "must_have_requirements": ["Experiencia fuerte en APIs"],
        "hard_constraints": ["Presencial en Madrid"],
        "required_skill_years": [{"skill": "Python", "years": 3, "required": True}],
        "normalized_role": "backend",
        "seniority_level": "mid",
        "required_years_min": 2,
        "required_languages": [],
        "work_mode": "onsite",
        "location_constraints": ["Madrid"],
    }

    result = _evaluate_offer_match(profile, offer, signals)

    assert result["resultado"] == "NO_ENCAJA"
    assert any("3+ anos con Python" in item for item in result["blockers"])
    assert result["offer_requirements"]["required_skill_years"][0]["years"] == 3


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 16: test_data_domain_mismatch_cybersec_demoted
# ─────────────────────────────────────────────────────────────────────────────

def test_data_domain_mismatch_cybersec_demoted():
    """
    Perfil de Cybersecurity (Python + SQL, sin herramientas data) frente a oferta
    de Data Scientist: debe degradarse de APLICA a QUIZÁ por el filtro data-domain mismatch.
    """
    profile = _make_profile(
        stack=["Python", "SQL", "Linux", "Nmap", "Wireshark"],
        experience="5",
        english="b2",
        idiomas=[{"idioma": "Ingles", "nivel": "B2"}],
    )
    offer = _make_offer(
        titulo="Data Scientist Senior",
        descripcion="Machine learning, modelado predictivo, Python, SQL, análisis de datos avanzado.",
        source_type="official_api",
        source_confidence=0.95,
        freshness_state="verified_recently",
    )
    signals = _make_signals(
        required_skills=["Python", "SQL"],
        preferred_skills=["machine learning"],
        normalized_role="data",
        seniority_level="senior",
        required_years_min=4,
    )
    result = _evaluate_offer_match(profile, offer, signals)
    # El filtro data-domain mismatch debe degradar APLICA → QUIZÁ
    assert result["resultado"] == "QUIZÁ"
    assert result["puntuacion"] <= 69


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 17: test_normalize_profile_stack_expands_go_synonym
# ─────────────────────────────────────────────────────────────────────────────

def test_normalize_profile_stack_expands_go_synonym():
    """El stack ['Go', 'Rust'] debe expandir 'go' → 'golang' en el set normalizado."""
    profile = _make_profile(stack=["Go", "Rust"])
    _, stack_norm = _normalize_profile_stack(profile)
    assert "golang" in stack_norm
    assert "rust" in stack_norm


# ─────────────────────────────────────────────────────────────────────────────
# TAREA A3 — Test 18: test_dedupe_keep_order
# ─────────────────────────────────────────────────────────────────────────────

def test_dedupe_keep_order():
    """La lista ['Python', 'python', 'PYTHON'] debe deduplicarse a un solo elemento."""
    result = _dedupe_keep_order(["Python", "python", "PYTHON"])
    # Solo debe quedar un elemento
    assert len(result) == 1
    # El elemento conservado debe ser la primera aparición
    assert result[0] == "Python"
