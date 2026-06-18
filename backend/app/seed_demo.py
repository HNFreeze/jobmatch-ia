# -*- coding: utf-8 -*-
"""Idempotent demo seed for local development and live demos.

Usage:  python -m app.seed_demo

Inserts a small set of synthetic, active job offers into the index so the
matching engine and the agent have data to work with without depending on the
external job APIs during a demo. Safe to run repeatedly (keyed by adzuna_id).
Requires DATABASE_URL; exits cleanly with a message if the DB is unavailable.
"""
import json
import sys
from datetime import datetime

from app.database import get_session_local
from app.models.job_offer import JobOffer

DEMO_OFFERS = [
    {
        "adzuna_id": "demo-react-jr",
        "titulo": "Frontend Developer (React)",
        "empresa": "Demo Tech",
        "ubicacion": "Madrid",
        "descripcion": "Buscamos desarrollador/a junior con React, TypeScript y CSS. Trabajo remoto.",
        "salario": "24.000 - 30.000 EUR",
        "skills": ["React", "TypeScript", "CSS"],
    },
    {
        "adzuna_id": "demo-fullstack-js",
        "titulo": "Fullstack JavaScript Engineer",
        "empresa": "Demo Labs",
        "ubicacion": "Remoto",
        "descripcion": "React en el frontend y Node.js en el backend. Modalidad remota.",
        "salario": "35.000 EUR",
        "skills": ["React", "Node.js", "JavaScript"],
    },
    {
        "adzuna_id": "demo-backend-py",
        "titulo": "Senior Backend Python",
        "empresa": "Demo Cloud",
        "ubicacion": "Madrid",
        "descripcion": "Python, FastAPI y PostgreSQL. 5+ años de experiencia. Híbrido.",
        "salario": "45.000 - 55.000 EUR",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    },
    {
        "adzuna_id": "demo-devops",
        "titulo": "DevOps Engineer",
        "empresa": "Demo Ops",
        "ubicacion": "Barcelona",
        "descripcion": "Kubernetes, Terraform y AWS. Despliegue continuo.",
        "salario": "",
        "skills": ["Kubernetes", "Terraform", "AWS"],
    },
    {
        "adzuna_id": "demo-data",
        "titulo": "Data Scientist",
        "empresa": "Demo Data",
        "ubicacion": "Valencia",
        "descripcion": "Python, Pandas y TensorFlow para modelos de ML.",
        "salario": "38.000 EUR",
        "skills": ["Python", "Pandas", "TensorFlow"],
    },
]


def seed() -> int:
    SessionLocal = get_session_local()
    if SessionLocal is None:
        print("DATABASE_URL no configurada — no se puede sembrar. Aborta sin error.")
        return 0

    db = SessionLocal()
    created = 0
    try:
        now = datetime.utcnow()
        for item in DEMO_OFFERS:
            exists = db.query(JobOffer).filter(JobOffer.adzuna_id == item["adzuna_id"]).first()
            if exists:
                continue
            db.add(JobOffer(
                adzuna_id=item["adzuna_id"],
                titulo=item["titulo"],
                empresa=item["empresa"],
                ubicacion=item["ubicacion"],
                descripcion=item["descripcion"],
                salario=item["salario"],
                fecha_publicacion=now.date().isoformat(),
                url=f"https://example.com/{item['adzuna_id']}",
                skills_detectadas=json.dumps(item["skills"], ensure_ascii=False),
                source_name="demo_seed",
                source_type="career_page",
                source_confidence=0.7,
                first_seen_at=now,
                last_seen_at=now,
                is_active=True,
            ))
            created += 1
        db.commit()
        print(f"Seed completado: {created} ofertas nuevas, {len(DEMO_OFFERS) - created} ya existían.")
        return 0
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"Error al sembrar: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(seed())
