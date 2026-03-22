# -*- coding: utf-8 -*-
import os

import httpx


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def validate_turnstile_token(token: str, remote_ip: str | None = None) -> bool:
    secret = os.getenv("TURNSTILE_SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("TURNSTILE_SECRET_KEY no configurada")

    if not token:
        return False

    payload = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    response = httpx.post(TURNSTILE_VERIFY_URL, data=payload, timeout=8.0)
    response.raise_for_status()
    data = response.json()
    return bool(data.get("success"))
