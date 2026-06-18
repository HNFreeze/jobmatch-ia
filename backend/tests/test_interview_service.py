# -*- coding: utf-8 -*-
"""Unit tests for the interview service (no network, no ElevenLabs)."""
from types import SimpleNamespace

from app.services import interview_service as svc


class _FakeMessages:
    def __init__(self, text):
        self._text = text

    def create(self, **kwargs):
        return SimpleNamespace(content=[SimpleNamespace(text=self._text)])


def test_tts_disabled_by_default_returns_none():
    # Web Speech API del navegador por defecto → backend no genera audio (coste 0).
    assert svc.tts("Hola, bienvenido a la entrevista") is None


def test_first_message_uses_claude(monkeypatch):
    monkeypatch.setattr(svc, "_claude", SimpleNamespace(messages=_FakeMessages("Cuéntame sobre ti.")))
    out = svc.first_message("Backend Developer", "ACME")
    assert "Cuéntame" in out


def test_generate_feedback_parses_json(monkeypatch):
    payload = '{"puntuacion_general": 8, "resumen": "Bien", "puntos_fuertes": ["a"], "areas_mejora": ["b"], "consejos": ["c"]}'
    monkeypatch.setattr(svc, "_claude", SimpleNamespace(messages=_FakeMessages(payload)))
    fb = svc.generate_feedback([{"role": "assistant", "content": "P"}, {"role": "user", "content": "R"}], "Backend Developer")
    assert fb["puntuacion_general"] == 8
    assert fb["puntos_fuertes"] == ["a"]


def test_generate_feedback_handles_bad_json(monkeypatch):
    monkeypatch.setattr(svc, "_claude", SimpleNamespace(messages=_FakeMessages("lo siento, no JSON")))
    fb = svc.generate_feedback([], "Dev")
    assert fb["puntuacion_general"] == 0
