# -*- coding: utf-8 -*-
import pytest
pytestmark = pytest.mark.battery

"""Quick 4-profile validation for v5_calibration engine."""
import sys, json, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
import jwt as pyjwt
from datetime import datetime, timedelta

JWT_SECRET = "a8f4c2e61d9b3f7e2a5c8d1b4e7f0a3c"
BASE_URL = "http://localhost:8000"

def make_token():
    return pyjwt.encode(
        {"sub": "6", "exp": datetime.utcnow() + timedelta(hours=2)},
        JWT_SECRET, algorithm="HS256"
    )

def post_json(path, body, token, timeout=120):
    data = json.dumps(body, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:200]}")

PROFILES = [
    # Was getting 80% APLICA for "Senior Product Designer" due to "go" matching
    {"label": "Go+Rust 3yr", "experience": "3",
     "stack": ["Go", "Rust", "gRPC", "Kafka", "Kubernetes"], "english": "avanzado",
     "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},
    # Should see APLICA now (was always QUIZA at 70-75%)
    {"label": "Java+Spring 5yr", "experience": "5",
     "stack": ["Java", "Spring Boot", "Microservices", "Kubernetes", "AWS"], "english": "avanzado",
     "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},
    # React should see at least some matches
    {"label": "React+TS 2yr", "experience": "2",
     "stack": ["React", "TypeScript", "JavaScript", "CSS", "Node.js"], "english": "avanzado",
     "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},
    # Senior fullstack should get APLICA
    {"label": "React+Python 6yr", "experience": "6",
     "stack": ["React", "Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "TypeScript"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},
]

def run_quick():
    token = make_token()
    for p in PROFILES:
        label = p.pop("label")
        body = p
        print(f"\n{'='*55}\nTest: {label}")
        t0 = time.time()
        try:
            r = post_json("/api/match", body, token)
        except RuntimeError as e:
            print(f"  ERROR: {e}"); continue
        offers = r.get("offers") or []
        print(f"  {len(offers)} offers ({time.time()-t0:.1f}s)")
        ap, qz, no = [], [], []
        for o in offers:
            res = o.get("resultado",""); pct = o.get("puntuacion",0)
            sm = len(o.get("skills_match") or []); miss = len(o.get("skills_missing") or [])
            bl = len(o.get("blockers") or []); t = o.get("titulo","")
            ghost = "GHOST" if res in ("APLICA","QUIZÁ") and not sm and not miss and not bl else ""
            row = f"  [{res:<10}] {pct:3}% sm={sm} miss={miss} bl={bl}  {ghost:<6} {t[:52]}"
            if res == "APLICA": ap.append(row)
            elif res == "QUIZÁ": qz.append(row)
            else: no.append(row)
        for rows in [ap, qz, no[:5]]:
            for row in rows: print(row)
        if len(no) > 5: print(f"  ... +{len(no)-5} more NO_ENCAJA")
        print(f"\n  >> APLICA={len(ap)} QUIZA={len(qz)} NO={len(no)}")
        print(f"  >> Ghosts: {sum(1 for o in offers if o.get('resultado') in ('APLICA','QUIZÁ') and not (o.get('skills_match') or o.get('skills_missing') or o.get('blockers')))}")


if __name__ == "__main__":
    run_quick()
