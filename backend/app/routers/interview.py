# -*- coding: utf-8 -*-
from datetime import datetime
from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.user import get_current_user_id, get_current_user_record
from app.models.interview_session import InterviewSession
from app.services import interview_service as svc
from app.services.ai_quota_service import consume_ai_quota

router = APIRouter()

END_SIGNAL = svc.END_SIGNAL


# ── Schemas ───────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    job_title: str
    company: Optional[str] = ""
    job_description: Optional[str] = None
    application_id: Optional[int] = None


class MessageRequest(BaseModel):
    content: str


class InterviewResponse(BaseModel):
    session_id: int
    text: str
    audio_b64: Optional[str] = None
    is_final: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_conv(session: InterviewSession) -> list[dict]:
    try:
        return json.loads(session.conversation_json or "[]")
    except Exception:
        return []


def _save_conv(session: InterviewSession, messages: list[dict], db: Session):
    session.conversation_json = json.dumps(messages, ensure_ascii=False)
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/interview/start", response_model=InterviewResponse)
def start_interview(
    body: StartRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
    user=Depends(get_current_user_record),
):
    # Cuota 1 entrevista/día (independiente de cuota general)
    consume_ai_quota(db, user, "interview")

    # Crear sesión
    session = InterviewSession(
        user_id=user_id,
        application_id=body.application_id,
        job_title=body.job_title.strip(),
        company=(body.company or "").strip(),
        job_description=body.job_description,
        conversation_json="[]",
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Primer mensaje de Alex
    try:
        text = svc.first_message(session.job_title, session.company)
    except Exception as exc:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=502, detail=f"Error generando entrevista: {exc}")

    is_final = END_SIGNAL in text
    messages = [
        {"role": "user", "content": "Hola, estoy listo para la entrevista."},
        {"role": "assistant", "content": text},
    ]
    _save_conv(session, messages, db)

    audio = svc.tts(text)

    if is_final:
        session.status = "completed"
        db.commit()

    return InterviewResponse(
        session_id=session.id,
        text=text.replace(END_SIGNAL, "").strip(),
        audio_b64=audio,
        is_final=is_final,
    )


@router.post("/api/interview/{session_id}/message", response_model=InterviewResponse)
def send_message(
    session_id: int,
    body: MessageRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="La entrevista ya ha terminado")

    messages = _load_conv(session)
    messages.append({"role": "user", "content": body.content.strip()})

    try:
        reply = svc.chat(messages, session.job_title, session.company)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error en la IA: {exc}")

    messages.append({"role": "assistant", "content": reply})
    _save_conv(session, messages, db)

    is_final = END_SIGNAL in reply
    audio = svc.tts(reply)

    return InterviewResponse(
        session_id=session.id,
        text=reply.replace(END_SIGNAL, "").strip(),
        audio_b64=audio,
        is_final=is_final,
    )


@router.post("/api/interview/{session_id}/end")
def end_interview(
    session_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    messages = _load_conv(session)

    try:
        feedback = svc.generate_feedback(messages, session.job_title)
    except Exception as exc:
        feedback = {"error": str(exc)}

    session.feedback_json = json.dumps(feedback, ensure_ascii=False)
    session.status = "completed"
    session.updated_at = datetime.utcnow()
    db.commit()

    return {"session_id": session_id, "feedback": feedback}


@router.get("/api/interview/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user_id)
        .order_by(InterviewSession.created_at.desc())
        .limit(20)
        .all()
    )
    result = []
    for s in sessions:
        feedback = None
        if s.feedback_json:
            try:
                feedback = json.loads(s.feedback_json)
            except Exception:
                pass
        result.append({
            "id": s.id,
            "job_title": s.job_title,
            "company": s.company,
            "status": s.status,
            "feedback": feedback,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return result
