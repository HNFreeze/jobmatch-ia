# JobMatch IA — Context for Claude Code

## Project overview
Full-stack TFM (Trabajo de Fin de Máster) app: AI-powered job matching and CV improvement.

**Deploy**: Render (backend as Web Service, frontend as Static Site). Branch: `master`.
**Repo**: GitHub (auto-deploy on push to master).

---

## Stack

### Backend (`backend/`)
- **FastAPI** + **SQLAlchemy** + **PostgreSQL** (psycopg2-binary)
- **Alembic** for migrations — current head: `e5f6a7b8c9d0`
- **Anthropic SDK** (Claude API) — model: `claude-haiku-4-5-20251001` for most calls
- **fpdf2** for PDF generation (Latin-1 encoding — preserve á,é,í,ó,ú,ñ)
- Dependencies: `requirements.txt` (no pip-tools, no lockfile)
- Entry point: `uvicorn app.main:app`
- Env vars loaded from `backend/.env` (not committed)

### Frontend (`frontend/`)
- **React 19** (Create React App)
- **Inline CSS only** — zero UI libraries (no MUI, no Tailwind, no styled-components)
- **No TypeScript** — plain `.jsx` and `.js`
- Theme constants in `frontend/src/constants/theme.js`
- API calls in `frontend/src/services/api.js`
- Build: `npm run build`

---

## Key conventions

### Models and migrations
- Every new SQLAlchemy model must be imported in `backend/alembic/env.py` with `# noqa: F401`
- Always create a new migration file in `backend/alembic/versions/` with `down_revision` pointing to the current head
- Never use `alembic autogenerate` on prod — write migrations by hand

### CV module (`app/services/cv_service.py`)
- Claude returns `cv_structured_json` (canonical JSON dict), not a text string
- `normalize_cv_structured()` → `validate_cv_structured()` pipeline runs after every Claude response
- `derive_improved_cv_text_from_json()` generates the legacy `improved_cv_text` for backwards compat
- `_truncate_cv_text()` cuts at 12 000 chars, always at a section boundary (never mid-experience)
- PDF uses `generate_cv_pdf_from_json()` — never parse `improved_cv_text` to build a new PDF

### CV edit sessions (`app/models/cv_edit_session.py`)
- One session per `(user_id, improvement_id)` — GET/PUT endpoints do upsert on the most recent
- `action_log_json` feeds `build_edit_context_for_prompt()` for the next Claude call
- Only moves/reorders/marks are logged — not every keystroke

### PDF generation (`app/services/cv_pdf_service.py`)
- Font: Helvetica (built-in fpdf2)
- `_safe_text()`: keep Latin-1 chars (á,é,í,ó,ú,ñ,Ñ), only replace non-Latin-1 (bullets, em-dashes, curly quotes)
- `generate_cv_pdf(text)` — legacy, kept for old records
- `generate_cv_pdf_from_json(cv_json)` — preferred, renders from dict directly

### Quota system (`app/services/ai_quota_service.py`)
- `sergiuswor@gmail.com` is super admin: unlimited quota, `is_super_admin=True`, `is_admin=False` (no admin panel)
- Regular users: `daily_ai_quota` field, enforced per action type

### Matching & Interview
- Motor de matching: `MATCH_ENGINE_VERSION = "v8_synonyms"` — incrementar al modificar la lógica de scoring en `matching_service.py`.
- Módulo de Interview (`app/routers/interview.py`, `app/services/interview_service.py`): gestiona simulaciones.
- ElevenLabs: solo se usa en `interview_service.py` para TTS de la entrevista simulada.

### Agent module (`app/routers/agent.py`, `app/services/agent_service.py`, `app/models/agent_run.py`)
- Agente personal de empleo: interpreta una instrucción en lenguaje natural y ejecuta una máquina de estados persistida (`AgentRun`): CREATED→INTERPRETING→SEARCHING→FILTERING→ANALYZING→RANKING→WAITING_FOR_USER→EXECUTING_APPROVED_ACTION→COMPLETED.
- La IA se usa SOLO en el paso de interpretación (1 llamada Haiku, validada con Pydantic `SearchInstruction`); si falla o devuelve JSON inválido hay un fallback determinista. El resto (buscar/filtrar/puntuar) reutiliza el motor de matching ya cacheado — sin coste extra por oferta.
- Confirmación humana (`POST /runs/{id}/confirm`): guarda las ofertas elegidas como `Favorite`. Todo se consulta filtrando por `user_id` (anti-IDOR). Frontend: `pages/AgentSearch.jsx`, página `agente`.

### Interview module (`app/routers/interview.py`, `app/services/interview_service.py`)
- Simulates a voice interview with Claude as "Alex" (HR interviewer) and ElevenLabs for TTS
- `InterviewSession` model: links to `application_id`, stores conversation history as JSON, status, feedback JSON
- Flow: `POST /api/interview/start` → `POST /api/interview/{id}/message` → `POST /api/interview/{id}/end`
- Claude uses `claude-haiku-4-5-20251001` for conversation + feedback generation
- ElevenLabs `eleven_multilingual_v2` voice model, voice Adam — audio returned as base64 mp3
- Quota: 1 interview per user per day, tracked in `AIDailyUsage` via `interview_count`
- Web Speech API (`SpeechRecognition`) used on frontend for user voice input (Chrome/Edge only)

### Frontend patterns
- Dark mode: `dm` boolean prop passed down from App
- Colors: `#7c3aed` (purple primary), `#2563eb` (blue), `#10b981` (green), `#ef4444` (red)
- Modals: `position: fixed, inset: 0, zIndex: 9999`, scroll container wrapping the card
- No `alert()` for non-critical errors — use `addToast(msg, "error")`
- API errors: `err?.detail || err?.message || fallback`
- **Motor de matching**: `MATCH_ENGINE_VERSION = v8_synonyms` — incrementar al modificar la lógica de scoring
- **ElevenLabs**: solo se usa en `interview_service.py` para TTS de la entrevista simulada; no invocar desde otros servicios

---

## Alembic migration chain (ordered)
```
df5d7554d95f → initial
...
v9w1y3a5c7e9 → cv_module_upgrade
w0x2z4b6d8f0 → cv_structured
x1y3z5a7c9e1 → cv_offer_variants
y2a4c6e8g0i2 → job_offer_source_metadata
z3b5d7f9h1j3 → job_ingestion_runs
a1b2c3d4e5f6 → add_alerts_and_feedback
d4e5f6a7b8c9 → add_follow_up_date
e5f6a7b8c9d0 → add_interview_feature
f6g7h8i9j0k1 → convert_json_fields_to_jsonb
g7h8i9j0k1l2 → add_satisfaction_to_search_history
h8i9j0k1l2m3 → add_agent_runs (CURRENT HEAD)
```
Next migration must set `down_revision = "h8i9j0k1l2m3"`.

---

## Common tasks

### Add a new DB column
1. Add `Column(...)` to the model
2. Create migration in `backend/alembic/versions/`
3. If new model: import it in `backend/alembic/env.py`

### Add a new API endpoint
- Backend: new `@router.xxx` in the relevant router file
- Frontend: add function to `frontend/src/services/api.js`, call from the relevant page/component

### Run migrations (local)
```bash
cd backend
alembic upgrade head
```

### Build frontend
```bash
cd frontend
npm run build
```

### Deploy
Push to `master` — Render auto-deploys backend and frontend separately.
If deploy doesn't trigger: check Render dashboard → Manual Deploy, or verify the path filter isn't excluding the changed files.
