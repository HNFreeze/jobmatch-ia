# -*- coding: utf-8 -*-
import os
import smtplib
from email.message import EmailMessage

import httpx


BREVO_SMTP_API_URL = "https://api.brevo.com/v3/smtp/email"


def _delivery_mode() -> str:
    return os.getenv("EMAIL_DELIVERY_MODE", "smtp").strip().lower()


def _from_email() -> str:
    return os.getenv("SMTP_FROM_EMAIL", "").strip()


def _from_name() -> str:
    return os.getenv("EMAIL_FROM_NAME", "JobMatch IA").strip() or "JobMatch IA"


def _send_via_brevo_api(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    from_email = _from_email()

    if not api_key or not from_email:
        raise RuntimeError("Brevo API no configurada")

    payload = {
        "sender": {
            "name": _from_name(),
            "email": from_email,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text_body,
    }
    if html_body:
        payload["htmlContent"] = html_body

    response = httpx.post(
        BREVO_SMTP_API_URL,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
        json=payload,
        timeout=15.0,
    )
    response.raise_for_status()


def _send_via_smtp(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    from_email = _from_email()
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"

    if not host or not from_email:
        raise RuntimeError("SMTP no configurado")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    if use_tls:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            if username:
                server.login(username, password)
            server.send_message(message)
        return

    with smtplib.SMTP_SSL(host, port) as server:
        if username:
            server.login(username, password)
        server.send_message(message)


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    mode = _delivery_mode()

    if mode == "console":
        print(f"[EMAIL][console] to={to_email} subject={subject}\n{text_body}")
        return

    if mode == "brevo_api":
        _send_via_brevo_api(to_email, subject, text_body, html_body)
        return

    _send_via_smtp(to_email, subject, text_body, html_body)


def build_verification_email(email: str, verification_url: str) -> tuple[str, str, str]:
    subject = "Verifica tu email en JobMatch IA"
    text_body = (
        "Gracias por registrarte en JobMatch IA.\n\n"
        "Para activar tu cuenta, verifica tu correo desde este enlace:\n"
        f"{verification_url}\n\n"
        "Si no has creado esta cuenta, puedes ignorar este mensaje."
    )
    html_body = (
        "<p>Gracias por registrarte en <strong>JobMatch IA</strong>.</p>"
        "<p>Para activar tu cuenta, verifica tu correo desde este enlace:</p>"
        f"<p><a href=\"{verification_url}\">{verification_url}</a></p>"
        "<p>Si no has creado esta cuenta, puedes ignorar este mensaje.</p>"
    )
    return subject, text_body, html_body
