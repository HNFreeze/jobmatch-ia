# -*- coding: utf-8 -*-
import json

import anthropic


def _get_cached_analyses(db, profile_hash: str, adzuna_ids: list[str]) -> dict:
    """
    Busca en search_cache (incluyendo entradas expiradas) análisis previos
    de las ofertas indicadas para el mismo perfil_hash.

    Devuelve {adzuna_id: {"resultado": ..., "puntuacion": ..., "motivo": ...,
                          "skills_match": [...], "skills_missing": [...]}}.
    """
    from app.models.cache import SearchCache
    row = db.query(SearchCache).filter(
        SearchCache.perfil_hash == profile_hash
    ).first()
    if not row:
        return {}
    try:
        raw = json.loads(row.ofertas_json)
        cached_items = raw if isinstance(raw, list) else raw.get("offers", [])
        target_ids = set(adzuna_ids)
        return {
            item["adzuna_id"]: {
                "resultado":      item["resultado"],
                "puntuacion":     item.get("puntuacion"),
                "motivo":         item["motivo"],
                "skills_match":   item.get("skills_match", []),
                "skills_missing": item.get("skills_missing", []),
            }
            for item in cached_items
            if item.get("adzuna_id") in target_ids
        }
    except Exception:
        return {}


def _build_idiomas_str(profile: dict) -> str:
    """Construye string legible de idiomas del perfil."""
    idiomas = profile.get("idiomas") or []
    if idiomas:
        parts = []
        for lang in idiomas:
            idioma = lang.get("idioma", "").strip()
            nivel = lang.get("nivel", "").strip()
            if idioma:
                parts.append(f"{idioma} ({nivel})" if nivel else idioma)
        if parts:
            return ", ".join(parts)
    english = (profile.get("english") or "").strip()
    return f"Inglés ({english})" if english else "No especificado"


def _prepare_offers_for_analysis(offers: list) -> list:
    """
    Prepara las ofertas para el prompt de Claude.
    Solo incluye campos relevantes para el análisis y acota la descripción
    a 700 caracteres para controlar el tamaño del contexto.
    """
    result = []
    for o in offers:
        desc = (o.get("descripcion") or "").strip()
        if len(desc) > 700:
            desc = desc[:700] + "..."
        result.append({
            "id":        o["id"],
            "titulo":    o.get("titulo", ""),
            "empresa":   o.get("empresa", ""),
            "ubicacion": o.get("ubicacion", ""),
            "salario":   o.get("salario", "") if o.get("salario") != "Salario no especificado" else "",
            "descripcion": desc,
        })
    return result


def _sort_by_fit(results: list) -> list:
    """Ordena: APLICA > QUIZÁ > NO_ENCAJA, con sub-orden por puntuación descendente."""
    ORDER = {"APLICA": 0, "QUIZÁ": 1, "NO_ENCAJA": 2}
    return sorted(
        results,
        key=lambda r: (ORDER.get(r.get("resultado", "NO_ENCAJA"), 2), -(r.get("puntuacion") or 0))
    )


def match_profile_with_offers(
    profile: dict,
    offers: list,
    api_key: str,
    db=None,
    profile_hash: str = None,
) -> list:
    # ── Caché por oferta: reutilizar análisis previos del mismo perfil ────────
    cached_analyses: dict = {}
    if db and profile_hash:
        adzuna_ids = [o.get("adzuna_id", "") for o in offers if o.get("adzuna_id")]
        cached_analyses = _get_cached_analyses(db, profile_hash, adzuna_ids)
        if cached_analyses:
            print(f"[MATCH_CACHE] {len(cached_analyses)} ofertas con análisis previo reutilizadas")

    uncached_offers = [o for o in offers if o.get("adzuna_id", "") not in cached_analyses]
    print(f"[MATCH] {len(uncached_offers)} ofertas a analizar por Claude (de {len(offers)} total)")

    # ── Llamada a Claude solo para las ofertas sin análisis previo ────────────
    new_results_by_id: dict = {}
    if uncached_offers:
        client = anthropic.Anthropic(api_key=api_key)

        idiomas_str   = _build_idiomas_str(profile)
        ubicaciones   = profile.get("ubicaciones") or []
        modalidad     = profile.get("modalidad") or []
        ubicaciones_str = ", ".join(ubicaciones) if ubicaciones else "Sin preferencia (toda España)"
        modalidad_str   = ", ".join(modalidad)   if modalidad   else "Sin preferencia"

        offers_for_prompt = _prepare_offers_for_analysis(uncached_offers)

        prompt = f"""Eres un experto en selección de talento tech en España.

Analiza el perfil del candidato y cada oferta de trabajo. Usa la descripción completa de cada oferta para extraer señales reales: no te quedes solo con el título.

## Perfil del candidato
- Años de experiencia: {profile.get("experience", "No indicado")}
- Stack tecnológico: {", ".join(profile.get("stack", []))}
- Idiomas: {idiomas_str}
- Ubicaciones preferidas: {ubicaciones_str}
- Modalidad preferida: {modalidad_str}

## Ofertas a analizar
{json.dumps(offers_for_prompt, ensure_ascii=False, indent=2)}

## Cómo analizar cada oferta
1. Lee la descripción para identificar:
   - Skills REQUERIDAS (señales: "imprescindible", "required", "must", "necesario", "obligatorio", "experience with", "se requiere")
   - Skills DESEABLES (señales: "valorable", "nice to have", "plus", "deseable", "se valorará")
   - Seniority esperado: junior / mid / senior y años de experiencia pedidos si se mencionan
   - Idioma requerido explícitamente (solo penaliza si la oferta lo exige claramente)
   - Modalidad real (remoto/híbrido/presencial si se menciona)

2. Compara con el perfil del candidato:
   - ¿Tiene las skills requeridas? (prioridad alta)
   - ¿Su experiencia es coherente con el seniority pedido?
   - ¿Cumple el idioma si es un requisito explícito?
   - ¿Encaja su modalidad preferida con lo que ofrece la empresa?

3. Decide el resultado:
   - "APLICA": encaje real — skills principales cubiertas, seniority compatible, sin gaps críticos
   - "QUIZÁ": encaje parcial — cubre lo esencial pero faltan skills relevantes, o la descripción es vaga y no permite confirmar fit
   - "NO_ENCAJA": encaje débil — faltan skills obligatorias, seniority muy diferente, o hay un requisito crítico no cumplido

## Criterios de puntuación (0-100)
La puntuación debe reflejar el fit real considerando TODOS los factores:
- 80-100 → APLICA: alta cobertura de skills requeridas + seniority compatible
- 50-79  → QUIZÁ: cobertura parcial o incertidumbre razonable
- 0-49   → NO_ENCAJA: gap crítico en skills obligatorias o experiencia incompatible

REGLAS IMPORTANTES:
- No puntúes alto por coincidir en 1-2 keywords si faltan skills centrales de la oferta
- Penaliza si la oferta pide claramente más años de experiencia de los que tiene el candidato
- Si la descripción es muy escasa o genérica, usa QUIZÁ en lugar de APLICA (no asumas fit por el título)
- Considera idioma y modalidad solo si la oferta los exige explícitamente
- El motivo debe mencionar skills o criterios concretos, nunca frases genéricas como "buen encaje"
- La puntuación debe ser coherente con el resultado: APLICA ≥ 80, QUIZÁ entre 50-79, NO_ENCAJA ≤ 49

## Formato de salida
Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni bloques de código:
[
  {{
    "id": 1,
    "resultado": "APLICA",
    "puntuacion": 87,
    "motivo": "Cumple el stack principal (Python, Django). Experiencia compatible con el seniority pedido. Docker es deseable pero no bloqueante.",
    "skills_match": ["Python", "Django", "PostgreSQL"],
    "skills_missing": ["Docker"]
  }},
  ...
]

Reglas para skills_match y skills_missing:
- skills_match: skills del candidato que la oferta requiere o valora (máximo 5, las más relevantes)
- skills_missing: skills que la oferta requiere/valora y el candidato NO tiene declaradas (máximo 3)
- Solo incluye tecnologías, frameworks, lenguajes, herramientas concretas (no "experiencia" o "comunicación")
- Si la descripción no menciona skills específicas, deja ambas listas vacías: []"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_response = message.content[0].text
        print(f"DEBUG: Respuesta RAW de Claude:\n{raw_response}")

        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response.split("```")[1]
            if cleaned_response.startswith("json"):
                cleaned_response = cleaned_response[4:]
            cleaned_response = cleaned_response.strip()

        print(f"DEBUG: Respuesta LIMPIA:\n{cleaned_response}")
        new_results_by_id = {r["id"]: r for r in json.loads(cleaned_response)}

    # ── Combinar: análisis cacheados + nuevos de Claude ───────────────────────
    final_results = []
    for offer in offers:
        aid = offer.get("adzuna_id", "")
        if aid in cached_analyses:
            analysis = cached_analyses[aid]
            entry = {
                "id":             offer["id"],
                "resultado":      analysis["resultado"],
                "motivo":         analysis["motivo"],
                "skills_match":   analysis.get("skills_match", []),
                "skills_missing": analysis.get("skills_missing", []),
            }
            if analysis.get("puntuacion") is not None:
                entry["puntuacion"] = analysis["puntuacion"]
            final_results.append(entry)
        elif offer["id"] in new_results_by_id:
            raw = new_results_by_id[offer["id"]]
            final_results.append({
                "id":             raw["id"],
                "resultado":      raw.get("resultado", "NO_ENCAJA"),
                "puntuacion":     raw.get("puntuacion", 0),
                "motivo":         raw.get("motivo", ""),
                "skills_match":   raw.get("skills_match", []) if isinstance(raw.get("skills_match"), list) else [],
                "skills_missing": raw.get("skills_missing", []) if isinstance(raw.get("skills_missing"), list) else [],
            })
        else:
            final_results.append({
                "id":             offer["id"],
                "resultado":      "NO_ENCAJA",
                "puntuacion":     0,
                "motivo":         "Sin análisis disponible",
                "skills_match":   [],
                "skills_missing": [],
            })

    return final_results


def generate_skills_gap(
    profile: dict,
    offers: list,
    results: list,
    api_key: str,
) -> dict | None:
    """
    Analiza las ofertas con bajo encaje (NO_ENCAJA / QUIZÁ) para detectar
    qué skills le faltan al usuario. Devuelve un dict con title, summary
    y recommended_skills, o None si no hay datos suficientes.
    """
    # ── Reunir ofertas con bajo encaje ────────────────────────────────────────
    result_by_id = {r["id"]: r for r in results}
    low_match: list[dict] = []
    for offer in offers:
        r = result_by_id.get(offer.get("id") or offer.get("adzuna_id"))
        if r and r.get("resultado") in ("NO_ENCAJA", "QUIZÁ"):
            low_match.append({
                "titulo":    offer.get("titulo", ""),
                "descripcion": (offer.get("descripcion") or "")[:600],
                "resultado": r["resultado"],
                "motivo":    r.get("motivo", ""),
                "skills_missing": r.get("skills_missing", []),
            })

    if len(low_match) < 1:
        print(f"[SKILLS_GAP] Solo {len(low_match)} ofertas de bajo encaje — insuficiente (min 1)")
        return None

    print(f"[SKILLS_GAP] Analizando {len(low_match)} ofertas de bajo encaje")

    # ── Prompt para Claude ───────────────────────────────────────────────────
    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""Eres un orientador de carrera tech en España.

A continuación tienes el perfil de un desarrollador y un listado de ofertas que NO encajaban bien con su perfil (clasificadas como NO_ENCAJA o QUIZÁ).

## Perfil del desarrollador
- Años de experiencia: {profile.get("experience", "No indicado")}
- Stack tecnológico: {", ".join(profile.get("stack", []))}
- Idiomas: {_build_idiomas_str(profile)}

## Ofertas con bajo encaje (resumen)
{json.dumps(low_match[:15], ensure_ascii=False, indent=2)}

## Tu tarea
Analiza los patrones comunes en estas ofertas y compáralos con el perfil del candidato.
Identifica de 3 a 5 skills concretas que, si el candidato las adquiriera, mejorarían significativamente su ratio de encaje en futuras búsquedas.

Para cada skill:
- "name": nombre corto y concreto (ej. "TypeScript", "Docker", "Inglés B2/C1")
- "reason": breve justificación (1-2 frases) de POR QUÉ esa skill mejoraría su encaje, mencionando cuántas ofertas la requerían
- "category": una de: "tecnica", "idioma", "experiencia", "modalidad"
- "demand_count": número estimado de ofertas de este lote que pedían esta skill

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni bloques de código:
{{
  "title": "Tu plan de mejora",
  "summary": "Breve párrafo explicativo (2-3 frases) orientado positivamente, sin juzgar al candidato",
  "recommended_skills": [
    {{"name": "...", "reason": "...", "category": "...", "demand_count": 0}}
  ]
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)

        skills = parsed.get("recommended_skills")
        if not isinstance(skills, list) or len(skills) == 0:
            print("[SKILLS_GAP] Claude devolvió estructura inválida")
            return None

        sanitized_skills = []
        for s in skills[:5]:
            sanitized_skills.append({
                "name":         str(s.get("name", "Skill")),
                "reason":       str(s.get("reason", "")),
                "category":     s.get("category", "tecnica") if s.get("category") in ("tecnica", "idioma", "experiencia", "modalidad") else "tecnica",
                "demand_count": int(s.get("demand_count", 0)) if str(s.get("demand_count", "0")).isdigit() else 0,
            })

        result = {
            "title":              str(parsed.get("title", "Tu plan de mejora")),
            "summary":            str(parsed.get("summary", "")),
            "recommended_skills": sanitized_skills,
        }
        print(f"[SKILLS_GAP] Generadas {len(sanitized_skills)} recomendaciones")
        return result

    except json.JSONDecodeError as e:
        print(f"[SKILLS_GAP] Error parseando JSON de Claude: {e}")
        return None
    except Exception as e:
        print(f"[SKILLS_GAP] Error inesperado: {e}")
        return None
