# -*- coding: utf-8 -*-
import os
from typing import List, Optional

import anthropic
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.user import get_current_user_record
from app.services.ai_cost_service import record_ai_api_cost
from app.services.ai_quota_service import consume_ai_quota
from app.services.claude_client import call_claude
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import get_client_ip

router = APIRouter()


class OfertaInput(BaseModel):
    titulo: str
    empresa: str
    descripcion: Optional[str] = ""


class PerfilInput(BaseModel):
    stack: List[str] = []
    anos_experiencia: Optional[str] = None
    email: Optional[str] = None


class CoverLetterRequest(BaseModel):
    oferta: OfertaInput
    perfil: PerfilInput


@router.post("/api/cover-letter")
def generate_cover_letter(
    body: CoverLetterRequest,
    request: Request,
    user=Depends(get_current_user_record),
    db: Session = Depends(get_db),
):
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "CLAUDE_API_KEY no configurada"},
            media_type="application/json; charset=utf-8",
        )

    client_ip = get_client_ip(request)
    try:
        enforce_rate_limits(db, [
            RateLimitRule(
                action="cover_letter_ip",
                bucket_key=f"ip:{client_ip}",
                limit=25,
                window_seconds=3600,
                detail="Has generado demasiadas cartas desde esta IP. Inténtalo más tarde.",
            ),
            RateLimitRule(
                action="cover_letter_user",
                bucket_key=f"user:{user.id}",
                limit=12,
                window_seconds=3600,
                detail="Has generado demasiadas cartas en poco tiempo. Espera un poco antes de volver a intentarlo.",
            ),
        ])

        consume_ai_quota(db, user, "cover_letter")

        stack_str = ", ".join(body.perfil.stack) if body.perfil.stack else "tecnologías variadas"
        experiencia_str = (
            f"{body.perfil.anos_experiencia} años de experiencia"
            if body.perfil.anos_experiencia
            else "experiencia relevante en el sector"
        )
        nombre = body.perfil.email.split("@")[0] if body.perfil.email else None

        prompt = f"""Eres un experto en redacción de cartas de presentación para el sector tecnológico.

Escribe una carta de presentación en español para este candidato y oferta:

**CANDIDATO**
{"- Nombre/usuario: " + nombre if nombre else ""}
- Stack tecnológico: {stack_str}
- Experiencia: {experiencia_str}

**OFERTA**
- Puesto: {body.oferta.titulo}
- Empresa: {body.oferta.empresa}
- Descripción: {body.oferta.descripcion or "No especificada"}

**REQUISITOS DE LA CARTA**
Exactamente 4 párrafos, sin títulos ni separadores entre ellos:
1. Presentación y por qué le atrae específicamente esta empresa/puesto (menciona "{body.oferta.empresa}" por nombre, sé concreto con algo de la oferta)
2. Experiencia y tecnologías del candidato relevantes para esta oferta concreta (conecta el stack con lo que pide la oferta)
3. Qué puede aportar a la empresa y motivación genuina
4. Cierre profesional con llamada a la acción

**TONO**: Profesional pero humano y cercano. Evita frases corporativas vacías como "me complace presentarme" o "soy una persona proactiva y orientada a resultados". Empieza directamente con el contenido. Nada de "Estimados señores/as" ni saludos formales al inicio.

Responde ÚNICAMENTE con los 4 párrafos de la carta, sin encabezado, sin firma, sin comentarios adicionales."""

        client = anthropic.Anthropic(api_key=api_key)
        message = call_claude(lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        ))
        record_ai_api_cost(
            user_id=user.id,
            feature="cover_letter",
            model="claude-sonnet-4-6",
            usage=getattr(message, "usage", None),
            request_id=getattr(message, "id", None),
            metadata={"job_title": body.oferta.titulo, "company": body.oferta.empresa},
        )
        carta = message.content[0].text
        return JSONResponse(
            content={"carta": carta},
            media_type="application/json; charset=utf-8",
        )
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate" in error_msg.lower():
            return JSONResponse(
                status_code=429,
                content={"detail": "Cuota de Claude API agotada. Espera unos minutos."},
                media_type="application/json; charset=utf-8",
            )
        if isinstance(e, Exception) and getattr(e, "status_code", None) == 429:
            return JSONResponse(
                status_code=429,
                content={"detail": str(getattr(e, "detail", error_msg))},
                media_type="application/json; charset=utf-8",
            )
        return JSONResponse(
            status_code=502 if "anthropic" in error_msg.lower() else 500,
            content={"detail": f"Error al generar la carta: {error_msg}"},
            media_type="application/json; charset=utf-8",
        )
    finally:
        db.close()
