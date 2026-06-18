# JobMatch IA

Plataforma inteligente de matching entre candidatos y ofertas de empleo tecnológicas, potenciada por Claude AI (Anthropic). Proyecto TFM de Máster en Inteligencia Artificial Aplicada.

## ¿Qué hace?

- Sube tu CV en PDF y obtén ofertas de empleo ordenadas por encaje real con tu perfil
- Mejora tu CV con sugerencias ATS generadas por IA
- Genera cartas de presentación personalizadas por oferta
- Simula entrevistas técnicas con voz usando Claude + ElevenLabs TTS
- Panel de administración para gestión de usuarios y monitorización

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend API | FastAPI 0.136 + Python 3.11 |
| Base de datos | PostgreSQL + SQLAlchemy 2.0 + Alembic |
| IA | Claude Haiku / Sonnet (Anthropic SDK) |
| Frontend | React 19 (Create React App, sin UI libs) |
| Mapas | Leaflet / react-leaflet |
| PDF | fpdf2 |
| Auth | JWT (HS256) + bcrypt + verificación por email |
| Email | Brevo (SMTP) |
| Bot protection | Cloudflare Turnstile |
| TTS | ElevenLabs |
| Deploy | Render.com (backend Web Service + frontend Static Site) |

## Estructura del proyecto

```
jobmatch-ia/
├── backend/
│   ├── app/
│   │   ├── main.py              # Punto de entrada FastAPI
│   │   ├── routers/             # Endpoints por dominio (auth, match, cv, interview...)
│   │   ├── services/            # Lógica de negocio (matching_service, cv_service...)
│   │   ├── models/              # Modelos SQLAlchemy
│   │   └── database.py          # Sesión de base de datos
│   ├── alembic/                 # Migraciones
│   ├── tests/                   # Tests unitarios (pytest)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/               # Páginas principales (Dashboard, CVSearch, Interview...)
    │   ├── components/          # Componentes reutilizables
    │   ├── services/api.js      # Todas las llamadas al backend
    │   └── constants/theme.js   # Tokens de diseño
    └── package.json
```

## Requisitos previos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (local o en Render)
- Clave API de Anthropic (`CLAUDE_API_KEY`)
- Cuentas opcionales: Adzuna, ElevenLabs, Brevo, Cloudflare Turnstile

## Setup local

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copiar y rellenar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL, CLAUDE_API_KEY, JWT_SECRET, etc.

# Ejecutar migraciones
alembic upgrade head

# Arrancar servidor de desarrollo
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install

# Crear .env.local
echo "REACT_APP_API_URL=http://localhost:8001" > .env.local
echo "PORT=3001" >> .env.local

npm start
```

La app estará disponible en `http://localhost:3001`. El backend en `http://localhost:8001/docs` (Swagger UI).

## Variables de entorno principales

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de PostgreSQL (`postgresql://user:pass@host/db`) |
| `CLAUDE_API_KEY` | Clave de la API de Anthropic |
| `JWT_SECRET` | Secreto para firmar tokens JWT (mínimo 32 chars) |
| `APP_FRONTEND_URL` | URL del frontend en producción (para CORS) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Credenciales API de Adzuna |
| `ELEVENLABS_API_KEY` | Para TTS en entrevistas simuladas |
| `BREVO_API_KEY` | Para envío de emails transaccionales |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (bot protection) |
| `DEFAULT_DAILY_AI_QUOTA` | Cuota de IA diaria por usuario (default: 8) |
| `ENVIRONMENT` | `production` activa validaciones extra (JWT_SECRET, etc.) |
| `LOG_LEVEL` | Nivel de logging: `DEBUG`, `INFO`, `WARNING` (default: `INFO`) |

## Arquitectura

```
Request → Router (auth, validation) → Service (business logic) → Model (DB)
                                           ↓
                                   Claude API (Anthropic SDK)
                                   con prompt caching + retry
```

Las capas son:
- **Routers** (`app/routers/`): validación de entrada, autenticación, rate limiting
- **Services** (`app/services/`): lógica de negocio, llamadas a Claude, generación de PDF
- **Models** (`app/models/`): esquema de base de datos (SQLAlchemy)
- **Alembic** (`alembic/versions/`): migraciones incrementales manuales

## Ejecutar tests

```bash
cd backend
pytest tests/ -v
```

## Deploy

El proyecto se despliega automáticamente en [Render.com](https://render.com) al hacer push a la rama `master`:

- **Backend**: Web Service → `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend**: Static Site → `npm run build` → directorio `frontend/build`

Las migraciones Alembic se ejecutan automáticamente en el startup del backend.

## Motor de matching

Versión actual: **v8_synonyms** (`MATCH_ENGINE_VERSION` en `matching_service.py`).

El motor analiza el CV del candidato contra las ofertas de empleo usando señales heurísticas + extracción por IA. Incluye:
- Normalización de roles (backend/frontend/fullstack/data/devops/mobile/qa)
- Diccionario de sinónimos tecnológicos (104 entradas)
- Umbrales: APLICA ≥ 73, QUIZÁ ≥ 52
- Extracción batch de señales vía Claude Haiku con prompt caching
