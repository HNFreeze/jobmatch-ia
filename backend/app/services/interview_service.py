# -*- coding: utf-8 -*-
"""
Servicio de simulación de entrevista.
- Claude actúa como entrevistador "Alex".
- ElevenLabs genera el audio de cada respuesta.
"""
import base64
import json
import os

import anthropic
import httpx

from app.services.claude_client import call_claude, system_with_cache

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # Adam
ELEVENLABS_MODEL = "eleven_multilingual_v2"
# La voz del entrevistador la pone por defecto el navegador (Web Speech API, coste 0).
# ElevenLabs queda como opción de pago opt-in: solo se usa si se activa explícitamente.
ELEVENLABS_ENABLED = os.getenv("INTERVIEW_ELEVENLABS_ENABLED", "false").strip().lower() == "true"

INTERVIEW_DAILY_LIMIT = 1
END_SIGNAL = "ENTREVISTA_FINALIZADA"

_claude = anthropic.Anthropic(api_key=CLAUDE_API_KEY)

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_TEMPLATE = """Eres Alex, un entrevistador de RRHH senior con más de 10 años de experiencia en el sector tecnológico. Estás entrevistando a un candidato para el puesto de {job_title}{company_part}.

REGLAS ESTRICTAS:
- Haz SOLO UNA pregunta a la vez. Espera siempre la respuesta.
- Estructura de la entrevista (en orden):
  1. Bienvenida breve + pregunta de presentación ("Cuéntame sobre ti y tu trayectoria").
  2. 3-4 preguntas técnicas o de experiencia relevantes para {job_title}.
  3. 1-2 preguntas situacionales ("¿Cómo manejarías...?", "Describe una situación en que...").
  4. Cierre amable.
- Para cerrar la entrevista di EXACTAMENTE esta frase al final de tu último mensaje: {end_signal}
- Mantén tono profesional pero cercano. SIEMPRE responde en español.
- Máximo 3-4 frases por respuesta. Sé conciso.
- No menciones que eres una IA. Actúa como un humano real."""


def _system_prompt(job_title: str, company: str) -> str:
    company_part = f" en {company}" if company else ""
    return SYSTEM_TEMPLATE.format(
        job_title=job_title,
        company_part=company_part,
        end_signal=END_SIGNAL,
    )


# ── ElevenLabs TTS ────────────────────────────────────────────────────────────

def tts(text: str) -> str | None:
    """Devuelve audio base64 (mp3) vía ElevenLabs SOLO si está activado explícitamente.
    Por defecto devuelve None y el navegador lee el texto con la Web Speech API (coste 0)."""
    if not ELEVENLABS_ENABLED or not ELEVENLABS_API_KEY:
        return None
    # Eliminar la señal de fin del texto que se lee en voz alta
    clean = text.replace(END_SIGNAL, "").strip()
    if not clean:
        return None
    try:
        r = httpx.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": clean,
                "model_id": ELEVENLABS_MODEL,
                "voice_settings": {
                    "stability": 0.48,
                    "similarity_boost": 0.78,
                    "style": 0.15,
                    "use_speaker_boost": True,
                },
            },
            timeout=20.0,
        )
        if r.status_code == 200:
            return base64.b64encode(r.content).decode("utf-8")
        print(f"[ElevenLabs] HTTP {r.status_code}: {r.text[:200]}")
    except Exception as exc:
        print(f"[ElevenLabs] TTS error: {exc}")
    return None


# ── Claude conversation ───────────────────────────────────────────────────────

def chat(messages: list[dict], job_title: str, company: str) -> str:
    """Envía la conversación a Claude y devuelve el texto de respuesta."""
    resp = call_claude(lambda: _claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=450,
        system=system_with_cache(_system_prompt(job_title, company)),
        messages=messages,
    ))
    return resp.content[0].text.strip()


def first_message(job_title: str, company: str) -> str:
    """Genera el primer mensaje del entrevistador (no necesita historial)."""
    return chat(
        messages=[{"role": "user", "content": "Hola, estoy listo para la entrevista."}],
        job_title=job_title,
        company=company,
    )


def generate_feedback(messages: list[dict], job_title: str) -> dict:
    """Genera el feedback estructurado al terminar la entrevista."""
    transcript = "\n".join(
        f"{'Entrevistador' if m['role'] == 'assistant' else 'Candidato'}: {m['content']}"
        for m in messages
    )
    resp = call_claude(lambda: _claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=700,
        messages=[{
            "role": "user",
            "content": (
                f"Basándote en esta transcripción de entrevista para el puesto de {job_title}, "
                "proporciona feedback constructivo en JSON con esta estructura exacta:\n"
                '{"puntuacion_general": <1-10>, "resumen": "<2 frases>", '
                '"puntos_fuertes": ["<p1>","<p2>","<p3>"], '
                '"areas_mejora": ["<a1>","<a2>"], '
                '"consejos": ["<c1>","<c2>","<c3>"]}\n\n'
                f"Transcripción:\n{transcript}\n\n"
                "Devuelve SOLO el JSON, sin texto adicional."
            ),
        }],
    ))
    raw = resp.content[0].text.strip()
    # Extraer el JSON aunque venga con markdown code block
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except Exception:
        return {
            "puntuacion_general": 0,
            "resumen": "No se pudo generar el feedback.",
            "puntos_fuertes": [],
            "areas_mejora": [],
            "consejos": [],
        }
