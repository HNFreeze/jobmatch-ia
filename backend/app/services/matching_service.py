# -*- coding: utf-8 -*-
import json

import anthropic


def _get_cached_analyses(db, profile_hash: str, adzuna_ids: list[str]) -> dict:
    """
    Busca en search_cache (incluyendo entradas expiradas) análisis previos
    de las ofertas indicadas para el mismo perfil_hash.

    Devuelve {adzuna_id: {"resultado": ..., "motivo": ...}}.
    """
    from app.models.cache import SearchCache
    row = db.query(SearchCache).filter(
        SearchCache.perfil_hash == profile_hash
    ).first()
    if not row:
        return {}
    try:
        raw = json.loads(row.ofertas_json)
        # Handle both old (array) and new ({offers, skills_gap}) cache formats
        cached_items = raw if isinstance(raw, list) else raw.get("offers", [])
        target_ids = set(adzuna_ids)
        return {
            item["adzuna_id"]: {
                "resultado": item["resultado"],
                "puntuacion": item.get("puntuacion"),
                "motivo": item["motivo"],
            }
            for item in cached_items
            if item.get("adzuna_id") in target_ids
        }
    except Exception:
        return {}


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

        prompt = f"""Eres un experto en selección de talento tech en España.

Analiza el perfil de este desarrollador y cada una de las ofertas de trabajo.
Para cada oferta, decide si el candidato debería aplicar considerando el fit real entre su experiencia y los requisitos de la oferta.

## Perfil del desarrollador
- Años de experiencia: {profile["experience"]}
- Stack tecnológico: {", ".join(profile["stack"])}
- Nivel de inglés: {profile["english"]}

## Ofertas de trabajo
{json.dumps(uncached_offers, ensure_ascii=False, indent=2)}

## Instrucciones
Para CADA oferta (usa su "id"), devuelve uno de estos resultados:
- "APLICA": el perfil encaja bien con los requisitos de la oferta.
- "QUIZÁ": encaja parcialmente, el candidato podría intentarlo y aprender.
- "NO_ENCAJA": los requisitos no se corresponden con el perfil (por experiencia, stack, o requisitos irreales para el nivel de experiencia del candidato).

Evalúa cada oferta de forma realista:
- Considera si el candidato tiene el stack necesario
- Verifica si la experiencia requerida es realista para el nivel de la oferta
- Detecta ofertas con requisitos absurdos (pedir mucha más experiencia de la que tiene sentido, 10+ tecnologías, etc.) y márcalas como NO_ENCAJA

Además, asigna una puntuación de compatibilidad del 0 al 100:
- 80-100: APLICA (buen encaje)
- 50-79: QUIZÁ (encaje parcial)
- 0-49: NO_ENCAJA (no encaja)

La puntuación debe ser coherente con el resultado: si el resultado es APLICA, la puntuación debe ser >= 80; si es QUIZÁ, entre 50-79; si es NO_ENCAJA, <= 49.

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni bloques de código:
[
  {{"id": 1, "resultado": "APLICA", "puntuacion": 87, "motivo": "Explicación breve"}},
  ...
]"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
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
                "id": offer["id"],
                "resultado": analysis["resultado"],
                "motivo": analysis["motivo"],
            }
            if analysis.get("puntuacion") is not None:
                entry["puntuacion"] = analysis["puntuacion"]
            final_results.append(entry)
        elif offer["id"] in new_results_by_id:
            final_results.append(new_results_by_id[offer["id"]])
        else:
            final_results.append({
                "id": offer["id"],
                "resultado": "NO_ENCAJA",
                "puntuacion": 0,
                "motivo": "Sin análisis disponible",
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
                "titulo": offer.get("titulo", ""),
                "descripcion": (offer.get("descripcion") or "")[:600],
                "resultado": r["resultado"],
                "motivo": r.get("motivo", ""),
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
- Nivel de inglés: {profile.get("english", "No indicado")}

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
        # Limpiar posibles fences markdown
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)

        # Validación mínima
        skills = parsed.get("recommended_skills")
        if not isinstance(skills, list) or len(skills) == 0:
            print("[SKILLS_GAP] Claude devolvió estructura inválida")
            return None

        # Sanitizar cada skill
        sanitized_skills = []
        for s in skills[:5]:
            sanitized_skills.append({
                "name": str(s.get("name", "Skill")),
                "reason": str(s.get("reason", "")),
                "category": s.get("category", "tecnica") if s.get("category") in ("tecnica", "idioma", "experiencia", "modalidad") else "tecnica",
                "demand_count": int(s.get("demand_count", 0)) if str(s.get("demand_count", "0")).isdigit() else 0,
            })

        result = {
            "title": str(parsed.get("title", "Tu plan de mejora")),
            "summary": str(parsed.get("summary", "")),
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
