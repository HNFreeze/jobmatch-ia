# -*- coding: utf-8 -*-
import logging
import time

import anthropic

logger = logging.getLogger(__name__)

_RETRY_STATUSES = {429, 529}


def system_with_cache(text: str) -> list[dict]:
    """Convierte un system prompt en el formato de lista con prompt caching habilitado."""
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


def call_claude(fn, max_retries: int = 3):
    """
    Ejecuta fn() (callable sin argumentos que llama a client.messages.create).
    Reintenta con backoff exponencial ante errores 429/529 de la API de Anthropic.
    """
    for attempt in range(max_retries):
        try:
            return fn()
        except anthropic.APIStatusError as exc:
            if exc.status_code in _RETRY_STATUSES and attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "Claude API error %d — reintento %d/%d en %ds",
                    exc.status_code,
                    attempt + 1,
                    max_retries - 1,
                    wait,
                )
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("call_claude: bucle de reintentos agotado sin resultado")
