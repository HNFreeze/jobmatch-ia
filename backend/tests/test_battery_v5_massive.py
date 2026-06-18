# -*- coding: utf-8 -*-
import pytest
pytestmark = pytest.mark.battery

"""
Match engine — batería masiva de 100 perfiles.
Objetivo: calibrar el motor v6_zero_match con cobertura amplia de stacks,
seniority y casos extremos para identificar patrones de falsos positivos/negativos.

Categorías:
  - Frontend (15): React, Angular, Vue, Next.js, React Native
  - Backend Python (15): Django, FastAPI, Flask, microservices
  - Backend Java (10): Spring Boot, Kotlin, Azure
  - Node.js (8): Express, NestJS, GraphQL
  - Fullstack (10): React+Node, React+Python, Angular+Java
  - PHP (5): Laravel, Symfony
  - Data/ML/AI (12): DS, ML, Data Engineering, Analytics
  - DevOps/Cloud (8): K8s, Terraform, SRE, Platform
  - Nicho/Mobile/.NET (10): Go, Rust, .NET, Android, iOS, Flutter
  - Edge cases (7): SQL/BI, SAP, Cybersec, QA, Tech Lead, junior stack grande

Coste estimado: ~$0.55 Claude Haiku | Tiempo: ~35 min
"""
import sys, json, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
import jwt as pyjwt
from datetime import datetime, timedelta

JWT_SECRET = "a8f4c2e61d9b3f7e2a5c8d1b4e7f0a3c"
BASE_URL   = "http://localhost:8000"
USER_ID    = 6

NON_TECH_PATTERNS = [
    "coordinator", "coordinador", "treasury", "finance", "rider", "fleet",
    "brand", "sales", "revenue", "pricing", "diversity", "logistics",
    "legal", "hr ", "recursos humanos", "marketing", "growth analyst",
    "demand analyst", "business analyst",
]

# ─── 100 perfiles ──────────────────────────────────────────────────────────────
PROFILES = [
    # ── FRONTEND (15) ──────────────────────────────────────────────────────────
    {"cat": "frontend", "label": "React junior 0yr",
     "experience": "menos de 1 año", "stack": ["React","JavaScript","HTML","CSS"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "React+TS 1yr",
     "experience": "1", "stack": ["React","TypeScript","JavaScript","CSS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "frontend", "label": "React+TS 2yr",
     "experience": "2", "stack": ["React","TypeScript","Redux","CSS","Webpack"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "React+TS 3yr",
     "experience": "3", "stack": ["React","TypeScript","Next.js","GraphQL","CSS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "React senior 5yr",
     "experience": "5", "stack": ["React","TypeScript","Next.js","Redux","GraphQL","Node.js","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "Angular+TS 2yr",
     "experience": "2", "stack": ["Angular","TypeScript","RxJS","CSS","JavaScript"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "frontend", "label": "Angular+TS 4yr",
     "experience": "4", "stack": ["Angular","TypeScript","RxJS","NgRx","Jest","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "Vue+TS 2yr",
     "experience": "2", "stack": ["Vue","TypeScript","JavaScript","CSS","Node.js"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "frontend", "label": "Vue+TS 4yr",
     "experience": "4", "stack": ["Vue","TypeScript","Pinia","Webpack","Docker","Node.js"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "Next.js 3yr",
     "experience": "3", "stack": ["Next.js","React","TypeScript","CSS","Node.js"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "Frontend senior 6yr",
     "experience": "6", "stack": ["React","Angular","TypeScript","Next.js","GraphQL","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "React junior ingles basico 1yr",
     "experience": "1", "stack": ["React","JavaScript"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "frontend", "label": "React Native 3yr",
     "experience": "3", "stack": ["React","React Native","TypeScript","JavaScript","Firebase"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "Svelte+TS 2yr",
     "experience": "2", "stack": ["Svelte","TypeScript","JavaScript","CSS","Node.js"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "frontend", "label": "HTML/CSS/JS sin framework 0yr",
     "experience": "menos de 1 año", "stack": ["HTML","CSS","JavaScript"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    # ── BACKEND PYTHON (15) ────────────────────────────────────────────────────
    {"cat": "python", "label": "Python+Django 1yr",
     "experience": "1", "stack": ["Python","Django","PostgreSQL"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "python", "label": "Python+Flask 2yr",
     "experience": "2", "stack": ["Python","Flask","MongoDB","Redis"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "python", "label": "Python+FastAPI 2yr",
     "experience": "2", "stack": ["Python","FastAPI","SQLAlchemy","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python+Django 3yr",
     "experience": "3", "stack": ["Python","Django","DRF","PostgreSQL","Celery","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "python", "label": "Python+FastAPI 4yr",
     "experience": "4", "stack": ["Python","FastAPI","Docker","AWS","PostgreSQL","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python senior 6yr",
     "experience": "6", "stack": ["Python","FastAPI","Django","Docker","Kubernetes","AWS","PostgreSQL","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python+microservices 5yr",
     "experience": "5", "stack": ["Python","FastAPI","Kafka","Docker","Kubernetes","AWS","gRPC"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python+Django+Celery 3yr",
     "experience": "3", "stack": ["Python","Django","Celery","Redis","PostgreSQL","Docker"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "python", "label": "Python junior minimo 1yr",
     "experience": "1", "stack": ["Python","Django","SQL"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "python", "label": "Python senior 8yr full stack cloud",
     "experience": "8", "stack": ["Python","FastAPI","Django","AWS","GCP","Docker","Kubernetes","Terraform","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python+Flask+AWS 4yr",
     "experience": "4", "stack": ["Python","Flask","MongoDB","Redis","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Django senior 5yr",
     "experience": "5", "stack": ["Python","Django","DRF","PostgreSQL","Redis","Celery","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "python", "label": "Python+asyncio 3yr",
     "experience": "3", "stack": ["Python","asyncio","FastAPI","Redis","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "python", "label": "Python junior minimo ingles basico",
     "experience": "menos de 1 año", "stack": ["Python","SQL"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "python", "label": "Python+Spark+Kafka 5yr",
     "experience": "5", "stack": ["Python","Spark","Kafka","Airflow","Docker","AWS","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    # ── BACKEND JAVA (10) ──────────────────────────────────────────────────────
    {"cat": "java", "label": "Java+Spring 2yr",
     "experience": "2", "stack": ["Java","Spring Boot","PostgreSQL","Maven"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "java", "label": "Java+Spring 4yr",
     "experience": "4", "stack": ["Java","Spring Boot","Microservices","Kubernetes","AWS","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "java", "label": "Java+Spring senior 5yr",
     "experience": "5", "stack": ["Java","Spring Boot","Microservices","Kubernetes","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "java", "label": "Java+Spring senior 7yr",
     "experience": "7", "stack": ["Java","Spring Boot","Spring Cloud","Kafka","Kubernetes","AWS","Docker","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "java", "label": "Java+Kotlin 3yr",
     "experience": "3", "stack": ["Java","Kotlin","Spring Boot","Android","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "java", "label": "Java senior 8yr",
     "experience": "8", "stack": ["Java","Spring Boot","Microservices","Kafka","Kubernetes","AWS","Docker","PostgreSQL","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "java", "label": "Java+Spring 3yr REST",
     "experience": "3", "stack": ["Java","Spring Boot","REST API","MySQL","Docker"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "java", "label": "Kotlin+Spring 4yr",
     "experience": "4", "stack": ["Kotlin","Spring Boot","Microservices","AWS","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "java", "label": "Java junior 1yr",
     "experience": "1", "stack": ["Java","Spring Boot","MySQL"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "java", "label": "Java+Spring+Azure 5yr",
     "experience": "5", "stack": ["Java","Spring Boot","Azure","Kubernetes","Docker","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    # ── NODE.JS (8) ────────────────────────────────────────────────────────────
    {"cat": "node", "label": "Node.js 1yr",
     "experience": "1", "stack": ["Node.js","Express","MongoDB","JavaScript"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "node", "label": "Node.js+TS 2yr",
     "experience": "2", "stack": ["Node.js","TypeScript","Express","MongoDB","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "node", "label": "Node.js+NestJS 3yr",
     "experience": "3", "stack": ["Node.js","NestJS","TypeScript","PostgreSQL","Docker","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "node", "label": "Node.js+TS 4yr",
     "experience": "4", "stack": ["Node.js","TypeScript","NestJS","Kubernetes","AWS","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "node", "label": "Node.js senior 5yr",
     "experience": "5", "stack": ["Node.js","TypeScript","NestJS","Kafka","Docker","Kubernetes","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "node", "label": "Node.js ingles basico 2yr",
     "experience": "2", "stack": ["Node.js","Express","MongoDB","JavaScript"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "node", "label": "Node.js+GraphQL 3yr",
     "experience": "3", "stack": ["Node.js","TypeScript","GraphQL","Apollo","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "node", "label": "Node.js junior 1yr minimo",
     "experience": "1", "stack": ["Node.js","Express","JavaScript","MySQL"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    # ── FULLSTACK (10) ─────────────────────────────────────────────────────────
    {"cat": "fullstack", "label": "React+Node 2yr",
     "experience": "2", "stack": ["React","Node.js","TypeScript","MongoDB","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "fullstack", "label": "React+Python 3yr",
     "experience": "3", "stack": ["React","Python","FastAPI","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "fullstack", "label": "React+Node+TS 4yr",
     "experience": "4", "stack": ["React","Node.js","TypeScript","PostgreSQL","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "fullstack", "label": "Vue+Python 3yr",
     "experience": "3", "stack": ["Vue","Python","Django","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "fullstack", "label": "Angular+Java 4yr",
     "experience": "4", "stack": ["Angular","TypeScript","Java","Spring Boot","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "fullstack", "label": "React+Python senior 6yr",
     "experience": "6", "stack": ["React","Python","FastAPI","PostgreSQL","Docker","AWS","TypeScript"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "fullstack", "label": "Next.js+Node+Prisma 3yr",
     "experience": "3", "stack": ["Next.js","Node.js","TypeScript","Prisma","PostgreSQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "fullstack", "label": "React+Django 4yr",
     "experience": "4", "stack": ["React","Python","Django","PostgreSQL","Redis","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "fullstack", "label": "Fullstack junior 1yr",
     "experience": "1", "stack": ["React","Node.js","JavaScript","MySQL"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "fullstack", "label": "Fullstack senior 7yr cloud",
     "experience": "7", "stack": ["React","TypeScript","Python","FastAPI","PostgreSQL","Docker","Kubernetes","AWS","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    # ── PHP (5) ────────────────────────────────────────────────────────────────
    {"cat": "php", "label": "PHP+Laravel 2yr",
     "experience": "2", "stack": ["PHP","Laravel","MySQL","JavaScript"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "php", "label": "PHP+Laravel 4yr",
     "experience": "4", "stack": ["PHP","Laravel","MySQL","Vue.js","Docker"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "php", "label": "PHP+Symfony 3yr",
     "experience": "3", "stack": ["PHP","Symfony","PostgreSQL","Docker","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "php", "label": "PHP senior 6yr",
     "experience": "6", "stack": ["PHP","Laravel","Symfony","MySQL","PostgreSQL","Docker","AWS","Vue.js"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "php", "label": "PHP junior 1yr",
     "experience": "1", "stack": ["PHP","Laravel","MySQL"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    # ── DATA / ML / AI (12) ────────────────────────────────────────────────────
    {"cat": "data", "label": "Data Science 1yr",
     "experience": "1", "stack": ["Python","Pandas","SQL","Jupyter"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "data", "label": "Data Science 2yr",
     "experience": "2", "stack": ["Python","Pandas","NumPy","SQL","Jupyter"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "data", "label": "Data Science 3yr",
     "experience": "3", "stack": ["Python","Pandas","Scikit-learn","SQL","Spark","Tableau"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "data", "label": "ML Engineer 2yr",
     "experience": "2", "stack": ["Python","TensorFlow","Scikit-learn","Pandas","SQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "ML Engineer 4yr",
     "experience": "4", "stack": ["Python","TensorFlow","PyTorch","MLflow","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "ML senior 6yr",
     "experience": "6", "stack": ["Python","PyTorch","TensorFlow","MLflow","Kubernetes","Docker","AWS","Kafka"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "Data Engineer 3yr",
     "experience": "3", "stack": ["Python","Spark","Airflow","Kafka","SQL","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "Data Engineer 5yr",
     "experience": "5", "stack": ["Python","Spark","Airflow","Kafka","dbt","AWS","Kubernetes","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "Analytics Engineer 2yr",
     "experience": "2", "stack": ["SQL","dbt","Python","Tableau","Power BI"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "data", "label": "AI Engineer 4yr",
     "experience": "4", "stack": ["Python","PyTorch","LangChain","Docker","AWS","FastAPI"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "data", "label": "DS stack minimo 2yr",
     "experience": "2", "stack": ["Python","SQL"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "data", "label": "Data Science senior 5yr",
     "experience": "5", "stack": ["Python","Spark","Airflow","TensorFlow","Docker","AWS","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    # ── DEVOPS / CLOUD (8) ─────────────────────────────────────────────────────
    {"cat": "devops", "label": "DevOps junior 1yr",
     "experience": "1", "stack": ["Docker","Linux","Git","CI/CD"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "devops", "label": "DevOps 3yr",
     "experience": "3", "stack": ["Docker","Kubernetes","Terraform","AWS","CI/CD","Linux"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "devops", "label": "DevOps senior 5yr",
     "experience": "5", "stack": ["Docker","Kubernetes","Terraform","AWS","GCP","CI/CD","Linux","Prometheus"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "devops", "label": "SRE 4yr",
     "experience": "4", "stack": ["Python","Kubernetes","Terraform","AWS","Prometheus","Grafana","Linux"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "devops", "label": "Cloud architect 6yr",
     "experience": "6", "stack": ["AWS","GCP","Azure","Kubernetes","Terraform","Docker","Python"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "devops", "label": "Platform engineer 4yr",
     "experience": "4", "stack": ["Kubernetes","Terraform","AWS","Docker","Python","CI/CD"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "devops", "label": "DevOps 2yr basico",
     "experience": "2", "stack": ["Docker","Kubernetes","CI/CD","Linux"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "devops", "label": "AWS specialist 5yr",
     "experience": "5", "stack": ["AWS","Terraform","Kubernetes","Docker","Python","Lambda"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    # ── NICHO / MOBILE / .NET (10) ─────────────────────────────────────────────
    {"cat": "niche", "label": "Go+Rust 3yr",
     "experience": "3", "stack": ["Go","Rust","gRPC","Kafka","Kubernetes"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "niche", "label": "Go senior 5yr",
     "experience": "5", "stack": ["Go","gRPC","Kafka","Kubernetes","Docker","AWS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "niche", "label": "Rust 3yr",
     "experience": "3", "stack": ["Rust","gRPC","Kafka","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "niche", "label": ".NET+C# 3yr",
     "experience": "3", "stack": ["C#",".NET","ASP.NET","Azure","SQL Server","Docker"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "niche", "label": ".NET+C# senior 5yr",
     "experience": "5", "stack": ["C#",".NET","ASP.NET","Azure","Kubernetes","SQL Server","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "niche", "label": "Kotlin+Android 3yr",
     "experience": "3", "stack": ["Kotlin","Android","Jetpack Compose","Java","REST API"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "niche", "label": "Swift+iOS 3yr",
     "experience": "3", "stack": ["Swift","iOS","SwiftUI","Objective-C","REST API"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "niche", "label": "Flutter 2yr",
     "experience": "2", "stack": ["Flutter","Dart","Firebase","Android","iOS"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "niche", "label": "React Native 3yr",
     "experience": "3", "stack": ["React Native","React","TypeScript","Firebase","Node.js"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "niche", "label": ".NET junior 1yr",
     "experience": "1", "stack": ["C#",".NET","SQL Server"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    # ── EDGE CASES (7) ─────────────────────────────────────────────────────────
    {"cat": "edge", "label": "SQL/BI analista 3yr (no-code)",
     "experience": "3", "stack": ["SQL","Power BI","Tableau","Excel"],
     "english": "intermedio", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "edge", "label": "SAP consultant 5yr",
     "experience": "5", "stack": ["SAP","SQL","ABAP","Excel"],
     "english": "basico", "ubicaciones": ["Madrid"], "modalidad": ["presencial"]},

    {"cat": "edge", "label": "Cybersecurity 3yr",
     "experience": "3", "stack": ["Python","Linux","Docker","SQL","Network Security","Nmap"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "edge", "label": "QA Engineer 3yr",
     "experience": "3", "stack": ["Python","Selenium","Pytest","Docker","SQL","Cypress"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["hibrido"]},

    {"cat": "edge", "label": "Tech Lead 8yr",
     "experience": "8", "stack": ["Python","React","TypeScript","AWS","Docker","Kubernetes","PostgreSQL","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "edge", "label": "Junior stack grande 0yr",
     "experience": "menos de 1 año",
     "stack": ["Python","React","Node.js","Docker","AWS","Kubernetes","PostgreSQL"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},

    {"cat": "edge", "label": "React+Python senior 10yr",
     "experience": "10",
     "stack": ["React","Python","TypeScript","FastAPI","PostgreSQL","Docker","AWS","Kubernetes","Kafka","Redis"],
     "english": "avanzado", "ubicaciones": ["Madrid"], "modalidad": ["remoto"]},
]

assert len(PROFILES) == 100, f"Expected 100 profiles, got {len(PROFILES)}"

# ─── Helpers ───────────────────────────────────────────────────────────────────
def make_token():
    return pyjwt.encode(
        {"sub": str(USER_ID), "exp": datetime.utcnow() + timedelta(hours=4)},
        JWT_SECRET, algorithm="HS256"
    )

def post_json(path, body, token, timeout=120):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:200]}")
    except Exception as e:
        raise RuntimeError(str(e))

def is_irrelevant(titulo):
    t = titulo.lower()
    return any(p in t for p in NON_TECH_PATTERNS)

# ─── Main battery ──────────────────────────────────────────────────────────────
def run():
    token = make_token()
    t_start = time.time()
    print("=" * 72)
    print(f"BATTERY MASIVA — 100 perfiles | motor v6_zero_match")
    print(f"Inicio: {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 72)

    by_cat = {}
    per_profile = []
    grand = {"aplica": 0, "quiza": 0, "no": 0, "ghost": 0, "irrel": 0, "offers": 0, "err": 0}

    for idx, p in enumerate(PROFILES, 1):
        label = p["label"]
        cat   = p["cat"]
        body  = {k: v for k, v in p.items() if k not in ("label", "cat")}

        elapsed_total = time.time() - t_start
        eta_min = (elapsed_total / idx) * (100 - idx) / 60 if idx > 1 else 0
        print(f"\n[{idx:>3}/100] {label}  (ETA restante: ~{eta_min:.0f} min)")

        t0 = time.time()
        try:
            result = post_json("/api/match", body, token)
        except RuntimeError as e:
            print(f"  ERROR: {e[:100]}")
            per_profile.append({"cat": cat, "label": label, "err": True})
            grand["err"] += 1
            continue

        offers = result.get("offers") or []
        n = len(offers)
        t_call = time.time() - t0

        ap, qz, no, ghost, irrel = 0, 0, 0, 0, 0
        aplica_rows, quiza_rows = [], []

        for o in offers:
            res  = o.get("resultado", "")
            pct  = o.get("puntuacion", 0)
            sm   = len(o.get("skills_match") or [])
            miss = len(o.get("skills_missing") or [])
            bl   = len(o.get("blockers") or [])
            tit  = o.get("titulo", "")
            irr  = is_irrelevant(tit)

            is_ghost = res in ("APLICA","QUIZÁ") and sm==0 and miss==0 and bl==0

            if res == "APLICA":
                ap += 1
                aplica_rows.append((pct, sm, miss, bl, tit))
            elif res == "QUIZÁ":
                qz += 1
                quiza_rows.append((pct, sm, miss, bl, tit, irr))
            else:
                no += 1

            if is_ghost: ghost += 1
            if irr and res in ("APLICA","QUIZÁ"): irrel += 1

        grand["aplica"] += ap
        grand["quiza"]  += qz
        grand["no"]     += no
        grand["ghost"]  += ghost
        grand["irrel"]  += irrel
        grand["offers"] += n

        # Print APLICA (always) and QUIZÁ (max 3)
        for pct, sm, miss, bl, tit in aplica_rows:
            print(f"  [APLICA    ] {pct:3}% sm={sm} miss={miss} bl={bl}  {tit[:55]}")
        for pct, sm, miss, bl, tit, irr in quiza_rows[:3]:
            tag = "IRREL" if irr else ("GHOST" if sm==0 and miss==0 and bl==0 else "")
            print(f"  [QUIZÁ     ] {pct:3}% sm={sm} miss={miss} bl={bl}  [{tag:<5}]  {tit[:50]}")
        if len(quiza_rows) > 3:
            print(f"  ... +{len(quiza_rows)-3} QUIZÁ más")

        relevance_pct = round((ap + qz) / max(n, 1) * 100)
        warn = " ⚠ GHOST" if ghost else ""
        warn += " ⚠ IRREL" if irrel else ""
        print(f"  >> AP={ap} QZ={qz} NO={no} | relevancia={relevance_pct}% | {n} ofertas | {t_call:.0f}s{warn}")

        rec = {"cat": cat, "label": label, "n": n, "ap": ap, "qz": qz, "no": no,
               "ghost": ghost, "irrel": irrel, "rel_pct": relevance_pct}
        per_profile.append(rec)
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(rec)

    # ── Resumen global ─────────────────────────────────────────────────────────
    total_t = (time.time() - t_start) / 60
    print("\n" + "=" * 72)
    print("RESUMEN GLOBAL")
    print("=" * 72)
    ok = [p for p in per_profile if not p.get("err")]
    total_off = grand["offers"]
    print(f"Tests OK: {len(ok)}/100  |  Errores: {grand['err']}")
    print(f"Total ofertas evaluadas: {total_off}")
    if total_off:
        print(f"APLICA: {grand['aplica']} ({grand['aplica']*100//total_off}%)  "
              f"QUIZÁ: {grand['quiza']} ({grand['quiza']*100//total_off}%)  "
              f"NO: {grand['no']} ({grand['no']*100//total_off}%)")
        positivos = grand['aplica'] + grand['quiza']
        print(f"Ghost survivors: {grand['ghost']}  |  QUIZÁ/APLICA irrelevantes: {grand['irrel']}")
        print(f"Relevancia media: {positivos*100//total_off}%")
    print(f"Tiempo total: {total_t:.1f} min")

    # ── Por categoría ──────────────────────────────────────────────────────────
    print("\n── Resumen por categoría ─────────────────────────────────────────────")
    CAT_NAMES = {
        "frontend": "Frontend", "python": "Python", "java": "Java",
        "node": "Node.js", "fullstack": "Fullstack", "php": "PHP",
        "data": "Data/ML/AI", "devops": "DevOps", "niche": "Nicho/Mobile/.NET",
        "edge": "Edge cases",
    }
    print(f"{'Categoría':<22} {'Tests':>5} {'AP':>4} {'QZ':>4} {'NO':>4} {'Ghost':>5} {'Rel%':>5}")
    print("-" * 55)
    for cat_key, name in CAT_NAMES.items():
        rows = by_cat.get(cat_key, [])
        if not rows: continue
        tot_n  = sum(r["n"] for r in rows)
        tot_ap = sum(r["ap"] for r in rows)
        tot_qz = sum(r["qz"] for r in rows)
        tot_no = sum(r["no"] for r in rows)
        tot_g  = sum(r["ghost"] for r in rows)
        rel    = (tot_ap + tot_qz) * 100 // max(tot_n, 1)
        print(f"  {name:<20} {len(rows):>5} {tot_ap:>4} {tot_qz:>4} {tot_no:>4} {tot_g:>5} {rel:>4}%")

    # ── Tabla por perfil ───────────────────────────────────────────────────────
    print("\n── Tabla completa por perfil ─────────────────────────────────────────")
    print(f"{'Perfil':<45} {'n':>3} {'AP':>3} {'QZ':>3} {'NO':>3} {'G':>2} {'I':>2} {'Rel%':>5}")
    print("-" * 72)
    for r in per_profile:
        if r.get("err"):
            print(f"  {r['label']:<43}  ERROR")
            continue
        g_mark = "!" if r["ghost"] else " "
        i_mark = "!" if r["irrel"] else " "
        print(f"  {r['label']:<43} {r['n']:>3} {r['ap']:>3} {r['qz']:>3} {r['no']:>3} {g_mark:>2} {i_mark:>2} {r['rel_pct']:>4}%")

    # ── Patrones detectados ────────────────────────────────────────────────────
    print("\n── Patrones detectados ───────────────────────────────────────────────")

    # Perfiles con APLICA
    aplica_profiles = [r for r in per_profile if not r.get("err") and r["ap"] > 0]
    print(f"\n✓ Perfiles con APLICA ({len(aplica_profiles)}/100):")
    for r in aplica_profiles:
        print(f"    {r['label']}  →  {r['ap']} APLICA")

    # Perfiles con ghost
    ghost_profiles = [r for r in per_profile if not r.get("err") and r["ghost"] > 0]
    if ghost_profiles:
        print(f"\n⚠ Perfiles con ghost survivors ({len(ghost_profiles)}):")
        for r in ghost_profiles:
            print(f"    {r['label']}  ghost={r['ghost']}")
    else:
        print("\n✓ 0 ghost survivors en los 100 perfiles")

    # Perfiles con QUIZÁ irrelevante
    irrel_profiles = [r for r in per_profile if not r.get("err") and r["irrel"] > 0]
    if irrel_profiles:
        print(f"\n⚠ Perfiles con QUIZÁ/APLICA irrelevante ({len(irrel_profiles)}):")
        for r in irrel_profiles:
            print(f"    {r['label']}  irrel={r['irrel']}")
    else:
        print("\n✓ 0 QUIZÁ/APLICA irrelevantes")

    # Perfiles con 0% relevancia
    zero_profiles = [r for r in per_profile if not r.get("err") and r["rel_pct"] == 0]
    print(f"\n— Perfiles con 0% relevancia positiva ({len(zero_profiles)}/100):")
    for cat_key in CAT_NAMES:
        z = [r for r in zero_profiles if r["cat"] == cat_key]
        if z:
            print(f"    {CAT_NAMES[cat_key]}: {len(z)} perfiles")


if __name__ == "__main__":
    run()
