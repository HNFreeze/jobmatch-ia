# -*- coding: utf-8 -*-
"""
Match quality battery v2 — post-filter validation.
Runs 14 test cases varying stack, years, seniority and specialization
to measure relevance%, ghost-QUIZA survival, false positives/negatives.
"""
import sys
import json
import time
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding="utf-8")

import jwt as pyjwt
from datetime import datetime, timedelta

JWT_SECRET = "a8f4c2e61d9b3f7e2a5c8d1b4e7f0a3c"
BASE_URL = "http://localhost:8000"
USER_ID = 6

# Tech keywords used to flag obviously irrelevant offers
TECH_WORDS = {
    "python", "django", "react", "angular", "vue", "javascript", "typescript",
    "node", "java", "spring", "php", "laravel", "golang", "rust", "swift",
    "kotlin", "docker", "kubernetes", "aws", "azure", "gcp", "sql", "mongodb",
    "redis", "graphql", "devops", "frontend", "backend", "fullstack", "software",
    "developer", "engineer", "engineering", "data scientist", "machine learning",
    "ml", "ai engineer", "programador", "desarrollador", "ingeniero",
    "devops", "spark", "airflow", "etl", "postgresql", "terraform", "git",
}

NON_TECH_PATTERNS = [
    "coordinator", "coordinador", "treasury", "finance", "rider", "fleet",
    "brand", "sales", "revenue", "pricing", "diversity", "vinilado",
    "logistics", "legal", "hr ", "recursos humanos", "marketing",
    "business analyst", "growth analyst", "demand analyst",
]


def make_token():
    payload = {
        "sub": str(USER_ID),
        "exp": datetime.utcnow() + timedelta(hours=2),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def post_json(path, body, token, timeout=90):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body_err[:200]}")
    except Exception as e:
        raise RuntimeError(str(e))


def is_tech_relevant(titulo, descripcion=""):
    combined = f"{titulo} {descripcion[:300]}".lower()
    for w in TECH_WORDS:
        if w in combined:
            return True
    return False


def is_suspicious(offer):
    """QUIZA/APLICA with all skill arrays empty."""
    resultado = offer.get("resultado", "")
    if resultado not in ("QUIZÁ", "APLICA"):
        return False
    sm = offer.get("skills_match") or []
    miss = offer.get("skills_missing") or []
    bl = offer.get("blockers") or []
    return not sm and not miss and not bl


PROFILES = [
    # ── Frontend ──────────────────────────────────────────────────────────────
    {
        "label": "React junior sin exp",
        "experience": "menos de 1 año",
        "stack": ["React", "JavaScript", "HTML", "CSS"],
        "english": "intermedio",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    {
        "label": "React+TS 1yr",
        "experience": "1",
        "stack": ["React", "TypeScript", "JavaScript", "CSS"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["hibrido"],
    },
    {
        "label": "React+Angular+Vue 3yr",
        "experience": "3",
        "stack": ["React", "Angular", "Vue", "TypeScript", "Node.js"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    # ── Backend ───────────────────────────────────────────────────────────────
    {
        "label": "Python+Django 2yr",
        "experience": "2",
        "stack": ["Python", "Django", "PostgreSQL", "Docker"],
        "english": "intermedio",
        "ubicaciones": ["Madrid"],
        "modalidad": ["hibrido"],
    },
    {
        "label": "Python+FastAPI 4yr",
        "experience": "4",
        "stack": ["Python", "FastAPI", "Docker", "AWS", "PostgreSQL", "Redis"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    {
        "label": "Java+Spring 5yr senior",
        "experience": "5",
        "stack": ["Java", "Spring Boot", "Microservices", "Kubernetes", "AWS"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["hibrido"],
    },
    {
        "label": "Node.js+Express 2yr",
        "experience": "2",
        "stack": ["Node.js", "Express", "MongoDB", "JavaScript"],
        "english": "intermedio",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    # ── Fullstack ─────────────────────────────────────────────────────────────
    {
        "label": "Fullstack React+Node 3yr",
        "experience": "3",
        "stack": ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    {
        "label": "PHP+Laravel 4yr",
        "experience": "4",
        "stack": ["PHP", "Laravel", "MySQL", "Vue.js", "Docker"],
        "english": "basico",
        "ubicaciones": ["Madrid"],
        "modalidad": ["presencial"],
    },
    # ── Data / ML ─────────────────────────────────────────────────────────────
    {
        "label": "Data Science Python 2yr",
        "experience": "2",
        "stack": ["Python", "Pandas", "NumPy", "SQL", "Jupyter"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["hibrido"],
    },
    {
        "label": "ML Engineer 4yr",
        "experience": "4",
        "stack": ["Python", "TensorFlow", "PyTorch", "MLflow", "Docker", "AWS"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    # ── DevOps / Cloud ────────────────────────────────────────────────────────
    {
        "label": "DevOps 3yr",
        "experience": "3",
        "stack": ["Docker", "Kubernetes", "Terraform", "AWS", "CI/CD", "Linux"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    # ── Niche / edge cases ────────────────────────────────────────────────────
    {
        "label": "Go+Rust 3yr (nicho)",
        "experience": "3",
        "stack": ["Go", "Rust", "gRPC", "Kafka", "Kubernetes"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
    {
        "label": "React+Python fullstack 6yr (senior)",
        "experience": "6",
        "stack": ["React", "Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "TypeScript"],
        "english": "avanzado",
        "ubicaciones": ["Madrid"],
        "modalidad": ["remoto"],
    },
]


def run_battery():
    token = make_token()
    print("=" * 70)
    print("BATTERY V2 — post-filter validation")
    print(f"Profiles: {len(PROFILES)}  |  Endpoint: POST /api/match")
    print("=" * 70)

    totals = {
        "tests": 0, "timeout": 0, "error": 0,
        "aplica": 0, "quiza": 0, "no_encaja": 0,
        "suspicious": 0, "irrelevant_quiza": 0,
        "total_offers": 0,
    }
    per_profile = []

    for p in PROFILES:
        label = p["label"]
        body = {k: v for k, v in p.items() if k != "label"}
        print(f"\n{'=' * 60}")
        print(f"Test: {label}")
        print(f"Stack: {', '.join(p['stack'])}  |  Exp: {p['experience']}yr")

        t0 = time.time()
        try:
            result = post_json("/api/match", body, token, timeout=120)
        except RuntimeError as e:
            msg = str(e)
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                print(f"  ERROR: timed out ({time.time()-t0:.0f}s)")
                totals["timeout"] += 1
            else:
                print(f"  ERROR: {msg[:120]}")
                totals["error"] += 1
            totals["tests"] += 1
            per_profile.append({"label": label, "status": "error"})
            continue

        elapsed = time.time() - t0
        offers = result.get("offers") or []
        n = len(offers)
        totals["tests"] += 1
        totals["total_offers"] += n
        print(f"  {n} offers  ({elapsed:.1f}s)")

        aplica_list, quiza_list, no_list = [], [], []
        suspicious_list, irrelevant_quiza = [], []
        tech_kw_lower = {t.lower() for t in p["stack"]}

        for o in offers:
            titulo = o.get("titulo", "")
            res = o.get("resultado", "")
            pct = o.get("puntuacion", 0)
            sm = len(o.get("skills_match") or [])
            miss = len(o.get("skills_missing") or [])
            bl = len(o.get("blockers") or [])
            tag = "OK"

            combined_lower = titulo.lower()
            for pat in NON_TECH_PATTERNS:
                if pat in combined_lower:
                    tag = "IRRELEVANTE"
                    break

            if res == "APLICA":
                aplica_list.append((pct, sm, miss, bl, tag, titulo))
                totals["aplica"] += 1
            elif res == "QUIZÁ":
                quiza_list.append((pct, sm, miss, bl, tag, titulo))
                totals["quiza"] += 1
                if tag == "IRRELEVANTE":
                    irrelevant_quiza.append((pct, titulo))
                    totals["irrelevant_quiza"] += 1
            else:
                no_list.append((pct, sm, miss, bl, tag, titulo))
                totals["no_encaja"] += 1

            if is_suspicious(o):
                suspicious_list.append((pct, titulo))
                totals["suspicious"] += 1

        for label_res, items in [("APLICA", aplica_list), ("QUIZÁ", quiza_list), ("NO_ENCAJA", no_list)]:
            for pct, sm, miss, bl, tag, titulo in items[:8]:
                marker = "GHOST" if (label_res in ("APLICA","QUIZÁ") and sm==0 and miss==0 and bl==0) else tag
                print(f"  [{label_res:<10}] {pct:3}%  sm={sm} miss={miss} bl={bl}  [{marker:<10}]  {titulo[:55]}")
            if len(items) > 8:
                print(f"    ... +{len(items)-8} more {label_res}")

        # Summary line
        rel_pct = round((len(aplica_list) + len(quiza_list)) / max(n, 1) * 100)
        print(f"\n  >> APLICA={len(aplica_list)}  QUIZA={len(quiza_list)}  NO_ENCAJA={len(no_list)}")
        print(f"  >> Positive relevance: {len(aplica_list)+len(quiza_list)}/{n} ({rel_pct}%)")
        if suspicious_list:
            print(f"  >> SOSPECHOSAS (ghost): {len(suspicious_list)}")
            for pct, t in suspicious_list:
                print(f"     {pct}% | {t[:60]}")
        if irrelevant_quiza:
            print(f"  >> QUIZA IRRELEVANTES: {len(irrelevant_quiza)}")
            for pct, t in irrelevant_quiza:
                print(f"     {pct}% | {t[:60]}")

        per_profile.append({
            "label": label,
            "status": "ok",
            "n": n,
            "aplica": len(aplica_list),
            "quiza": len(quiza_list),
            "no_encaja": len(no_list),
            "suspicious": len(suspicious_list),
            "irrel_quiza": len(irrelevant_quiza),
        })

    # ── Global summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("GLOBAL SUMMARY")
    print("=" * 70)
    ok_tests = [p for p in per_profile if p.get("status") == "ok"]
    total_positives = totals["aplica"] + totals["quiza"]
    total_offers = totals["total_offers"]
    print(f"Tests OK: {len(ok_tests)}/{totals['tests']}  (timeout={totals['timeout']}, error={totals['error']})")
    print(f"Total offers analyzed: {total_offers}")
    if total_offers:
        print(f"APLICA: {totals['aplica']} ({totals['aplica']*100//total_offers}%)  "
              f"QUIZA: {totals['quiza']} ({totals['quiza']*100//total_offers}%)  "
              f"NO_ENCAJA: {totals['no_encaja']} ({totals['no_encaja']*100//total_offers}%)")
        print(f"Ghost-QUIZA survivors: {totals['suspicious']}  "
              f"(was {totals['suspicious']}/{total_positives} of positives)")
        print(f"QUIZA irrelevantes: {totals['irrelevant_quiza']}")

    print("\nPer-profile table:")
    print(f"{'Profile':<40} {'n':>3} {'AP':>3} {'QZ':>3} {'NO':>3} {'GHOST':>5} {'IRREL':>5}")
    print("-" * 65)
    for p in per_profile:
        if p.get("status") != "ok":
            print(f"  {p['label']:<38}  TIMEOUT/ERROR")
            continue
        print(f"  {p['label']:<38} {p['n']:>3} {p['aplica']:>3} {p['quiza']:>3} "
              f"{p['no_encaja']:>3} {p['suspicious']:>5} {p['irrel_quiza']:>5}")


if __name__ == "__main__":
    run_battery()
