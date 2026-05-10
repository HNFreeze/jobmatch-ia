# -*- coding: utf-8 -*-
"""
alert_service.py — Lógica de procesamiento de alertas de empleo.

Para cada usuario con alertas activas:
1. Obtiene las ofertas indexadas en las últimas 24h (usando señales ya cacheadas).
2. Evalúa compatibilidad con las señales del perfil guardado.
3. Si hay ofertas con score >= umbral configurado, envía email.
"""
import json
import os
from datetime import datetime, timedelta

from app.database import get_session_local
from app.models.job_alert import JobAlert
from app.models.job_offer import JobOffer
from app.models.user import User
from app.services.email_service import send_email


# ── Email builder ─────────────────────────────────────────────────────────────

def _build_alert_email(user_email: str, offers: list[dict], threshold: int) -> tuple[str, str, str]:
    """Build subject, text and HTML body for a job alert email."""
    count = len(offers)
    subject = f"🎯 {count} {'nueva oferta' if count == 1 else 'nuevas ofertas'} que encajan con tu perfil"

    # Plain text
    lines = [
        f"Hola,",
        f"",
        f"Hemos encontrado {count} oferta{'s' if count != 1 else ''} con una compatibilidad ≥ {threshold}% con tu perfil:",
        "",
    ]
    for offer in offers[:10]:
        score = offer.get("score") or 0
        lines.append(f"• {offer.get('titulo', 'Oferta')} — {offer.get('empresa', '')} ({offer.get('ubicacion', '')})")
        lines.append(f"  Compatibilidad: {score}%  |  {offer.get('url', '')}")
        lines.append("")

    lines += [
        "Accede a JobMatch IA para ver el análisis completo y adaptar tu CV:",
        f"{os.getenv('FRONTEND_URL', 'https://jobmatch-ia.onrender.com')}",
        "",
        "— El equipo de JobMatch IA",
    ]
    text_body = "\n".join(lines)

    # HTML body
    offer_cards_html = ""
    for offer in offers[:10]:
        score = offer.get("score") or 0
        resultado = offer.get("resultado", "QUIZÁ")
        color_map = {"APLICA": "#10b981", "QUIZÁ": "#64748b", "NO_ENCAJA": "#ef4444"}
        badge_color = color_map.get(resultado, "#64748b")
        label_map = {"APLICA": "✓ Aplica", "QUIZÁ": "? Quizá", "NO_ENCAJA": "✗ No encaja"}
        badge_label = label_map.get(resultado, resultado)

        offer_cards_html += f"""
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:12px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px;">{offer.get('titulo', 'Oferta')}</div>
              <div style="font-size:13px;color:#6b7280;">{offer.get('empresa', '')} · {offer.get('ubicacion', '')}</div>
            </div>
            <span style="background:{badge_color}20;color:{badge_color};font-weight:700;font-size:11px;
                         border-radius:20px;padding:3px 10px;white-space:nowrap;border:1px solid {badge_color}40;">
              {badge_label}
            </span>
          </div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
            <div style="flex:1;height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;">
              <div style="width:{score}%;height:100%;background:{badge_color};border-radius:3px;"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:{badge_color};">{score}%</span>
          </div>
          <a href="{offer.get('url', '#')}" style="display:inline-block;margin-top:12px;font-size:12px;
             color:#2563eb;text-decoration:none;font-weight:600;">Ver oferta completa →</a>
        </div>
        """

    frontend_url = os.getenv("FRONTEND_URL", "https://jobmatch-ia.onrender.com")
    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#f8fafc;padding:0 16px 32px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#00758A,#2563eb);border-radius:16px;padding:28px 32px;
                margin-bottom:24px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">🎯</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">
        {count} {'oferta' if count == 1 else 'ofertas'} que encajan con tu perfil
      </h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
        Compatibilidad ≥ {threshold}% con tu stack y preferencias
      </p>
    </div>

    <!-- Cards -->
    <div style="margin-bottom:24px;">
      {offer_cards_html}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="{frontend_url}" style="display:inline-block;background:linear-gradient(135deg,#00758A,#2563eb);
         color:#fff;font-weight:700;font-size:15px;text-decoration:none;
         padding:14px 32px;border-radius:50px;box-shadow:0 4px 14px rgba(37,99,235,0.3);">
        Analizar ofertas y adaptar mi CV →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:0;">
      Recibes este email porque tienes alertas de empleo activas en JobMatch IA.<br>
      <a href="{frontend_url}/#perfil" style="color:#94a3b8;">Gestionar mis alertas</a>
    </p>
  </div>
</body>
</html>
"""
    return subject, text_body, html_body


# ── Core matching logic for alerts (no AI, uses cached signals) ───────────────

def _score_offer_for_alert(offer: JobOffer, user_profile: dict) -> int:
    """
    Fast heuristic scoring using cached signals. No Claude API calls.
    Returns 0-100 score.
    """
    stack = [s.lower() for s in (user_profile.get("stack") or [])]
    if not stack:
        return 0

    titulo = (offer.titulo or "").lower()
    descripcion = (offer.descripcion or "").lower()
    text = titulo + " " + descripcion

    # Skill match score (0-60)
    matched = sum(1 for s in stack if s in text)
    skill_score = min(60, int((matched / max(len(stack), 1)) * 70))

    # Location match (0-20)
    ubicaciones = [u.lower() for u in (user_profile.get("ubicaciones") or [])]
    offer_location = (offer.ubicacion or "").lower()
    location_score = 0
    if not ubicaciones or "toda españa" in ubicaciones:
        location_score = 20
    elif any(u in offer_location or offer_location in u for u in ubicaciones):
        location_score = 20
    elif "remoto" in offer_location or "remote" in offer_location:
        location_score = 15

    # Modality match (0-20)
    modalidades = [m.lower() for m in (user_profile.get("modalidad") or [])]
    modality_score = 0
    if not modalidades:
        modality_score = 10
    else:
        signals = offer.signals_summary_json or "{}"
        try:
            signals_dict = json.loads(signals)
        except Exception:
            signals_dict = {}
        work_mode = (signals_dict.get("work_mode") or "").lower()
        mode_map = {"remote": "remoto", "hybrid": "híbrido", "onsite": "presencial"}
        mapped = mode_map.get(work_mode, "")
        if any(m in mapped or mapped in m for m in modalidades):
            modality_score = 20
        elif not work_mode:
            modality_score = 10

    return skill_score + location_score + modality_score


def _get_user_profile_dict(user: User) -> dict:
    """Extract matching-relevant fields from User model."""
    try:
        stack = json.loads(user.stack_json or "[]") if hasattr(user, "stack_json") else []
    except Exception:
        stack = []
    try:
        ubicaciones = json.loads(user.ubicaciones_json or "[]") if hasattr(user, "ubicaciones_json") else []
    except Exception:
        ubicaciones = []
    try:
        modalidad = json.loads(user.modalidad_json or "[]") if hasattr(user, "modalidad_json") else []
    except Exception:
        modalidad = []

    return {
        "stack": stack or (user.stack if hasattr(user, "stack") else []),
        "ubicaciones": ubicaciones or (user.ubicaciones if hasattr(user, "ubicaciones") else []),
        "modalidad": modalidad or (user.modalidad if hasattr(user, "modalidad") else []),
    }


# ── Main trigger function ─────────────────────────────────────────────────────

def process_job_alerts(db=None) -> dict:
    """
    Procesa todas las alertas activas y envía emails donde corresponda.
    Devuelve un resumen del proceso.
    """
    close_db = False
    if db is None:
        SessionLocal = get_session_local()
        if SessionLocal is None:
            return {"error": "DB no disponible", "processed": 0, "sent": 0}
        db = SessionLocal()
        close_db = True

    summary = {"processed": 0, "sent": 0, "skipped": 0, "errors": 0}

    try:
        # Obtener alertas activas
        alerts = (
            db.query(JobAlert)
            .filter(JobAlert.is_active.is_(True))
            .all()
        )

        if not alerts:
            return {**summary, "message": "Sin alertas activas"}

        # Ofertas indexadas en las últimas 24h
        cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_offers = (
            db.query(JobOffer)
            .filter(
                JobOffer.is_active.is_(True),
                JobOffer.created_at >= cutoff,
            )
            .order_by(JobOffer.created_at.desc())
            .limit(500)
            .all()
        )

        if not recent_offers:
            return {**summary, "message": "Sin nuevas ofertas en 24h"}

        for alert in alerts:
            summary["processed"] += 1
            try:
                user = db.query(User).filter(User.id == alert.user_id).first()
                if not user or not user.email or not user.email_verified:
                    summary["skipped"] += 1
                    continue

                profile = _get_user_profile_dict(user)
                if not profile.get("stack"):
                    summary["skipped"] += 1
                    continue

                # Score cada oferta reciente
                matched_offers = []
                for offer in recent_offers:
                    score = _score_offer_for_alert(offer, profile)
                    if score >= alert.min_score_threshold:
                        resultado = "APLICA" if score >= 75 else "QUIZÁ"
                        matched_offers.append({
                            "titulo": offer.titulo or "",
                            "empresa": offer.empresa or "",
                            "ubicacion": offer.ubicacion or "",
                            "url": offer.redirect_url or offer.url or "",
                            "score": score,
                            "resultado": resultado,
                        })

                # Ordenar por score desc
                matched_offers.sort(key=lambda x: x["score"], reverse=True)
                matched_offers = matched_offers[:10]

                if not matched_offers:
                    summary["skipped"] += 1
                    continue

                # Enviar email
                subject, text_body, html_body = _build_alert_email(
                    user.email, matched_offers, alert.min_score_threshold
                )
                send_email(user.email, subject, text_body, html_body)

                # Actualizar last_triggered_at
                alert.last_triggered_at = datetime.utcnow()
                alert.updated_at = datetime.utcnow()
                db.commit()

                summary["sent"] += 1
                print(f"[ALERTS] Email enviado a {user.email}: {len(matched_offers)} ofertas")

            except Exception as exc:
                summary["errors"] += 1
                print(f"[ALERTS] Error procesando alerta {alert.id}: {exc}")
                db.rollback()

        return summary

    finally:
        if close_db:
            db.close()
