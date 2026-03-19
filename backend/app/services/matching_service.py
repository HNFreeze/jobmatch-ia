# -*- coding: utf-8 -*-
import json

import anthropic


def match_profile_with_offers(profile: dict, offers: list, api_key: str) -> list:
    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""Eres un experto en selección de talento tech en España.

Analiza el perfil de este candidato junior y cada una de las ofertas de trabajo.
Para cada oferta, decide si el candidato debería aplicar.

## Perfil del candidato
- Años de experiencia: {profile["experience"]}
- Stack tecnológico: {", ".join(profile["stack"])}
- Nivel de inglés: {profile["english"]}

## Ofertas de trabajo
{json.dumps(offers, ensure_ascii=False, indent=2)}

## Instrucciones
Para CADA oferta (usa su "id"), devuelve uno de estos resultados:
- "APLICA": el perfil encaja bien con los requisitos.
- "QUIZÁ": encaja parcialmente, podría intentarlo.
- "NO_ENCAJA": los requisitos no se corresponden con el perfil (por experiencia, stack, o requisitos irreales para un junior).

Detecta ofertas con requisitos absurdos para un puesto junior (pedir 5+ años, 10 tecnologías, etc.) y márcalas como NO_ENCAJA explicando por qué.

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni bloques de código:
[
  {{"id": 1, "resultado": "APLICA", "motivo": "Explicación breve"}},
  ...
]"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_response = message.content[0].text
    print(f"DEBUG: Respuesta RAW de Claude:\n{raw_response}")
    print(f"DEBUG: Tipo de respuesta: {type(raw_response)}")
    print(f"DEBUG: Longitud: {len(raw_response)}")

    # Limpiar bloques de código markdown si existen
    cleaned_response = raw_response.strip()
    if cleaned_response.startswith("```"):
        # Extraer JSON del bloque de código markdown
        cleaned_response = cleaned_response.split("```")[1]
        if cleaned_response.startswith("json"):
            cleaned_response = cleaned_response[4:]
        cleaned_response = cleaned_response.strip()

    print(f"DEBUG: Respuesta LIMPIA:\n{cleaned_response}")
    return json.loads(cleaned_response)
