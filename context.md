# JobMatch IA — Context File para continuar el desarrollo

> Generado en Mayo 2026. Úsalo como contexto inicial para cualquier IA.

---

## 1. ¿Qué es este proyecto?

**JobMatch IA** es un TFM (Trabajo de Fin de Máster) — una plataforma web full-stack de búsqueda de empleo con inteligencia artificial. Permite a los usuarios:

- Buscar ofertas de trabajo con **matching IA** basado en su stack tecnológico y perfil
- Subir un **CV en PDF** para análisis automático y matching
- Mejorar su CV con IA (Anthropic Claude)
- Gestionar **candidaturas** (Kanban), **favoritos** y ver un **mapa de ofertas**
- Configurar **alertas de empleo** por email
- Ver un **Dashboard** con análisis de mercado y skill gaps

---

## 2. Stack Técnico

### Backend (`jobmatch-ia/backend/`)
| Tecnología | Detalle |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy + Alembic (migraciones manuales) |
| DB | PostgreSQL (psycopg2-binary) |
| IA | Anthropic SDK — modelo `claude-haiku-4-5-20251001` |
| PDF | fpdf2 — encoding Latin-1 (preservar á,é,ñ...) |
| Scheduler | APScheduler (ingesta de ofertas cada 12h) |
| Auth | JWT (python-jose) + Cloudflare Turnstile (captcha) |
| Email | SMTP (email_service.py) |
| Entrada | `uvicorn app.main:app` |
| Config | `backend/.env` (NO committed) |

### Frontend (`jobmatch-ia/frontend/`)
| Tecnología | Detalle |
|---|---|
| Framework | React 19 (Create React App) |
| CSS | Inline CSS 100% — CERO librerías UI (no MUI, no Tailwind) |
| Tipos | Plain `.jsx` y `.js` — sin TypeScript |
| Tema | `frontend/src/constants/theme.js` |
| API | `frontend/src/services/api.js` |
| Build | `npm run build` / Dev: `npm run dev` |
| Puerto local | 3001 (configurado en `.env`) |

### Despliegue
- **Plataforma**: Render.com
- **Backend**: Web Service — auto-deploy on push to `master`
- **Frontend**: Static Site — auto-deploy on push to `master`
- **Repo**: GitHub → `HNFreeze/jobmatch-ia`

---

## 3. Estructura de archivos clave

```
jobmatch-ia/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, routers, scheduler startup
│   │   ├── database.py          # SQLAlchemy engine + SessionLocal
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py          # User model (principal)
│   │   │   ├── job_offer.py     # JobOffer model
│   │   │   ├── job_alert.py     # JobAlert model (alertas de email)
│   │   │   ├── match_feedback.py # Feedback thumbs up/down
│   │   │   └── ...
│   │   ├── routers/
│   │   │   ├── auth.py          # /api/auth/*
│   │   │   ├── match.py         # /api/match/* (matching + market-analysis)
│   │   │   ├── cv.py            # /api/cv/* (análisis + mejora + PDF)
│   │   │   ├── alerts.py        # /api/alerts/*
│   │   │   ├── application.py   # /api/applications/*
│   │   │   ├── favorites.py     # /api/favorites/*
│   │   │   ├── user.py          # /api/user/*
│   │   │   └── admin.py         # /api/admin/*
│   │   └── services/
│   │       ├── cv_service.py        # Lógica IA para CV
│   │       ├── cv_pdf_service.py    # Generación PDF
│   │       ├── alert_service.py     # Procesamiento de alertas + envío email
│   │       ├── ai_quota_service.py  # Sistema de cuota de IA por usuario
│   │       └── email_service.py     # SMTP wrapper
│   ├── alembic/
│   │   ├── env.py               # IMPORTANTE: importar todos los modelos aquí
│   │   └── versions/            # 29 archivos de migración
│   ├── services/
│   │   ├── interview_service.py # Simulación de entrevista (Claude + ElevenLabs TTS)
│   │   └── ...
│   ├── routers/
│   │   ├── interview.py         # /api/interview/* (sesiones de entrevista)
│   │   └── ...
│   └── .env                     # NO committed — vars locales
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Router principal (hash-based: #buscar, #dashboard, etc.)
    │   ├── constants/theme.js   # Colores, tipografía, transiciones
    │   ├── services/api.js      # Todas las llamadas al backend
    │   ├── pages/
    │   │   ├── Profile.jsx      # Búsqueda por perfil (3172 líneas — el más grande)
    │   │   ├── CVSearch.jsx     # Búsqueda por CV
    │   │   ├── Dashboard.jsx    # Dashboard post-login con métricas y análisis
    │   │   ├── Candidaturas.jsx # Kanban de candidaturas
    │   │   ├── Favoritos.jsx    # Ofertas guardadas
    │   │   ├── UserProfile.jsx  # Configuración de perfil + alertas
    │   │   ├── Landing.jsx      # Landing page pública
    │   │   ├── Auth.jsx         # Login / registro
    │   │   ├── MapaOfertas.jsx  # Mapa geográfico de ofertas
    │   │   └── Admin.jsx        # Panel de administración
    │   └── components/
    │       ├── Onboarding.jsx   # Onboarding 3 pasos (nuevo)
    │       ├── Navbar.jsx       # Navegación principal
    │       ├── CVEditorModal.jsx # Editor de CV inline
    │       ├── OfferTrustSignals.jsx # Indicadores de calidad de oferta
    │       └── Toast.jsx        # Sistema de notificaciones
    └── .env                     # PORT=3001, BROWSER=none, TURNSTILE_KEY
```

---

## 4. Routing en el Frontend

El router es **hash-based** en `App.jsx`. Las rutas disponibles:

| Hash | Componente | Requiere auth |
|---|---|---|
| `#home` / `#landing` | Landing | No |
| `#auth` | Auth | No |
| `#verify-email` | VerifyEmail | No |
| `#buscar` | Profile | Sí |
| `#cv-buscar` | CVSearch | Sí |
| `#dashboard` | Dashboard | Sí |
| `#mapa` | MapaOfertas | Sí |
| `#favoritos` | Favoritos | Sí |
| `#candidaturas` | Candidaturas | Sí |
| `#user-profile` | UserProfile | Sí |
| `#admin` | Admin | Sí + is_admin |

Navegación mediante `navigateTo(page)` → actualiza `window.location.hash` + estado `page`.

---

## 5. Cadena de migraciones Alembic

```
df5d7554d95f  (initial)
  → b3e1a92cf8d4  (add idiomas)
  → e7a3d15cb092  (add ubicaciones + modalidad)
  → c1d2e3f4a5b6  (add alias/nombre/apellidos)
  → d2e3f4a5b6c7  (add onboarding_completed)
  → k4e6f8a0b2c3  (add is_admin)
  → m7a9c1e3b5d7  (add blocking fields)
  → a8e6c4d2f901  (security + quota tables)
  → f4a8b2c91e7d  (job_offers table)
  → a9c3e5f7b1d2  (favoritos + historial)
  → d1286330359d  (applications table)
  → f7c4b3a1d902  (company_logos)
  → g8d5c4b3a1d9  (rating cols en company_logos)
  → h1b2c3d4e5f6  (merge heads)
  → j2c4d6e8f0a1  (external review links)
  → n8b2d4f6a1c3  (offer_signal_cache)
  → q4f6h8j0k2l4  (ai_api_cost_events)
  → r5g7i9k1m3o5  (analytics_consent en users)
  → s6t8v0x2z4b6  (cv_analyses)
  → u8v0x2z4b6c8  (cv_improve_count)
  → v9w1y3a5c7e9  (cv_module_upgrade)
  → w0x2z4b6d8f0  (cv_structured)
  → x1y3z5a7c9e1  (cv_offer_variants)
  → y2a4c6e8g0i2  (job_offer_source_metadata)
  → z3b5d7f9h1j3  (job_ingestion_runs)
  → a1b2c3d4e5f6  (add_alerts_and_feedback)
  → d4e5f6a7b8c9  (add_follow_up_date)
  → e5f6a7b8c9d0  ← HEAD ACTUAL (add_interview_feature)
```

**Próxima migración** debe tener `down_revision = "e5f6a7b8c9d0"`.

---

## 6. Columnas actuales de la tabla `users`

```sql
id, email, password_hash, anos_experiencia, stack (JSON array),
ingles (boolean), created_at, idiomas (JSON array), ubicaciones (JSON array),
modalidad (string), alias, nombre, apellidos,
onboarding_completed (bool, default false),
email_verified (bool), email_verified_at,
daily_ai_quota (int), is_admin (bool), is_blocked (bool), blocked_at,
is_super_admin (bool, default false), analytics_consent (bool, default true)
```

---

## 7. Endpoints principales del backend

### Auth (`/api/auth/`)
- `POST /login` — devuelve JWT
- `POST /register` — registro con verificación email
- `POST /verify-email` — verifica token
- `POST /resend-verification`

### Match (`/api/match/`)
- `POST /` — matching de ofertas según perfil del usuario
- `GET /market-analysis` — análisis de skill demand + gaps del mercado
- `POST /feedback` — thumbs up/down en una oferta
- `GET /feedback` — historial de feedback del usuario

### CV (`/api/cv/`)
- `POST /analyze` — analiza CV PDF → JSON estructurado
- `POST /improve` — mejora CV con IA (Claude)
- `GET /download-pdf/{improvement_id}` — descarga PDF mejorado
- `POST /cover-letter` — genera carta de presentación

### Alertas (`/api/alerts/`)
- `GET /` — lista alertas del usuario
- `POST /` — crea alerta
- `PUT /{id}` — actualiza alerta
- `DELETE /{id}` — elimina alerta
- `POST /trigger` — dispara envío manual de alertas

### Candidaturas (`/api/applications/`)
- CRUD completo + cambio de estado (Kanban: Aplicada / Entrevista / Oferta / Rechazada)

### Favoritos (`/api/favorites/`)
- `GET /` — lista favoritos
- `POST /` — añade favorito (por adzuna_id)
- `DELETE /{adzuna_id}` — elimina favorito

### Usuario (`/api/user/`)
- `GET /profile` — perfil completo
- `PUT /profile` — actualiza perfil + stack
- `GET /ai-quota` — cuota IA restante
- `PUT /consent` — actualiza analytics_consent

---

## 8. Estado actual del proyecto (mayo 2026)

### ✅ Implementado y funcionando
- **Onboarding de 3 pasos** (`Onboarding.jsx`)
- **Análisis de mercado** (`Dashboard.jsx` + `GET /api/match/market-analysis`)
- **Dashboard** completo: métricas, progreso, acciones, tip contextual
- **Vista compacta de tarjetas**: toggle que oculta MatchInsightSummary y TrustSignals
- **Alertas de email**: modelo `JobAlert`, scheduler, `alert_service.py`
- **Feedback de matching**: thumbs up/down en tarjetas
- **Sistema de cuota IA**: `daily_ai_quota` por usuario
- **Kanban de candidaturas** (`Candidaturas.jsx`) con badges de urgencia
- **Mapa de ofertas** (`MapaOfertas.jsx`)
- **Análisis y mejora de CV** con Claude + descarga PDF
- **Editor de CV inline** (`CVEditorModal.jsx`)
- **Landing page** con hero animado, stats, "Cómo funciona"
- **Build limpio**: `react-scripts build` compila sin errores (154.69 kB gzip)
- **Simulación de entrevista con voz**: Claude como entrevistador "Alex", ElevenLabs TTS, Web Speech API, avatar SVG animado, feedback estructurado.
- **Módulo de notificaciones** (`/api/notifications`): tabla `notifications`, endpoints de lectura, campana en Navbar
- **Fechas de seguimiento (follow_up_date)** en candidaturas: campo en tabla `applications` con recordatorios visuales en Dashboard y Kanban
- **Motor de matching v8_synonyms** (`MATCH_ENGINE_VERSION = v8_synonyms`): cadena de filtros robusta, sinónimos para golang/node.js

### ⚠️ Pendiente / próximos pasos sugeridos
1. **Git push a GitHub** — pendiente de aprobación del usuario
2. **Tests automatizados** — falta cobertura (Añadiendo en A3)
3. **Refactorización Profile.jsx** — muy grande, necesita dividirse (B2)
4. **ThemeContext** — eliminar prop drilling de darkMode (B1)
5. **Métricas de calidad de matching** en el panel de admin (B3) en prod

---

## 9. Convenciones críticas

### Backend
- **Modelos nuevos**: importar en `backend/alembic/env.py` con `# noqa: F401`
- **Migraciones**: siempre manuales, nunca `alembic autogenerate` en prod
- **PDF**: siempre usar `generate_cv_pdf_from_json()` — nunca parsear `improved_cv_text`
- **Caracteres**: `_safe_text()` en cv_pdf_service — solo reemplazar non-Latin-1, preservar á/é/ñ
- **Errores HTTP**: lanzar `HTTPException(status_code=..., detail="mensaje")` — el frontend lee `.detail`

### Frontend
- **Dark mode**: prop `darkMode` / variable `dm` pasada desde `App.jsx` hacia abajo
- **Colores principales**: teal `#007A8A`, púrpura `#7c3aed`, azul `#2563eb`
- **Toasts**: `addToast("mensaje", "error"|"success"|"info")` — nunca `alert()`
- **Errores de API**: `err?.detail || err?.message || "Fallback"` 
- **Modales**: `position: fixed, inset: 0, zIndex: 9999`
- **CSS**: 100% inline styles — no crear clases CSS salvo en bloques `<style>` inyectados via `document.head`

---

## 10. Entorno local

```bash
# Backend (desde jobmatch-ia/backend/)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend (desde jobmatch-ia/frontend/)
npm run dev
# → http://localhost:3001

# La variable de entorno local apunta al backend correcto:
# frontend/.env.local → REACT_APP_API_URL=http://localhost:8000
```

**DB local**: PostgreSQL en `localhost:5432/jobmatch_ia`  
**Nota**: La DB local puede estar desincronizada con producción si hay migraciones pendientes. Usar el script `fix_db_columns.py` (o `alembic upgrade head`) para sincronizar.

---

## 11. Variables de entorno (backend/.env — no committed)

```env
DATABASE_URL=postgresql://postgres:...@localhost:5432/jobmatch_ia
SECRET_KEY=...
ANTHROPIC_API_KEY=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
ADZUNA_APP_ID=...
ADZUNA_API_KEY=...
TURNSTILE_SECRET_KEY=...
SUPER_ADMIN_EMAIL=sergiuswor@gmail.com
```

---

## 12. Contexto del TFM

- Es un proyecto académico (Máster en Desarrollo IA)
- Hay tiempo para iterar — no está en producción comercial
- El objetivo de escalado es que **más gente pueda usarlo para buscar trabajo**
- LinkedIn se considera mala experiencia → JobMatch IA como alternativa real
- Prioridad: **simplicidad de uso** sobre cantidad de features

---

*Fin del context.md — generado automáticamente para handoff a otra IA.*
