# JobMatch IA

Plataforma inteligente de matching entre candidatos y ofertas de empleo tecnológicas, potenciada por Claude AI (Anthropic). Proyecto de Trabajo de Fin de Máster (Máster de Desarrollo con IA).

## 🌐 Demo en producción

- **Aplicación**: https://jobmatch-ia-alpha.vercel.app/
- **Usuario de prueba**: se facilita en el formulario de entrega.
- **Presentación (slides)**: [docs/JobMatch_IA_BigSchool.pptx](docs/JobMatch_IA_BigSchool.pptx)
- **Vídeo de presentación**: _(pendiente de añadir)_

> El backend usa el plan gratuito de Render: tras un rato de inactividad, la primera petición puede tardar ~30-60 s en "despertar". Si ves un error puntual al entrar, recarga pasados unos segundos.

## ¿Qué hace? (funcionalidades principales)

- **Agente de empleo con IA**: describe en lenguaje natural lo que buscas y un agente supervisado interpreta la instrucción, busca, filtra, puntúa y **explica** cada oferta — con confirmación humana antes de guardar resultados.
- **Matching explicable**: sube tu CV en PDF (o usa tu perfil) y obtén ofertas ordenadas por encaje real, con motivos (fortalezas, carencias y bloqueantes) por oferta.
- **Mejora de CV con IA**: sugerencias ATS y descarga del CV mejorado en PDF.
- **Cartas de presentación** personalizadas para cada oferta.
- **Simulación de entrevista con IA**: conversación con Claude y voz en el navegador (Web Speech API).
- **Gestión de candidaturas**: favoritos, pipeline de estados e historial de búsquedas.
- **Panel de administración**: gestión de usuarios, métricas de uso de IA y monitorización.
- **RGPD**: exportación y borrado de los datos del usuario.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend API | FastAPI 0.136 + Python 3.11 |
| Base de datos | PostgreSQL + SQLAlchemy 2.0 + Alembic |
| IA | Claude Haiku / Sonnet (Anthropic SDK) |
| Frontend | React 19 (Create React App, estilos inline + primitivos headless Radix) |
| PDF | fpdf2 |
| Auth | JWT (HS256) + bcrypt + verificación por email |
| Email | Brevo (SMTP) |
| Bot protection | Cloudflare Turnstile |
| Voz (entrevista) | Web Speech API del navegador (ElevenLabs TTS opcional) |
| Deploy | Vercel (frontend) + Render (backend Web Service) |

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

Despliegue automático al hacer push a la rama `master`:

- **Frontend** → [Vercel](https://vercel.com): build `react-scripts build`. URL pública: https://jobmatch-ia-alpha.vercel.app/
- **Backend** → [Render](https://render.com) (Web Service): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Las migraciones Alembic se ejecutan automáticamente en el startup del backend.

### Usuario de prueba

Hay un script idempotente que crea un usuario de prueba verificado con un perfil de ejemplo ya relleno (las credenciales se definen dentro del script / por entorno):

```bash
cd backend
python -m app.create_demo_user   # usa la DATABASE_URL del entorno
```

## Motor de matching

Versión actual: **v8_synonyms** (`MATCH_ENGINE_VERSION` en `matching_service.py`).

El motor analiza el CV del candidato contra las ofertas de empleo usando señales heurísticas + extracción por IA. Incluye:
- Normalización de roles (backend/frontend/fullstack/data/devops/mobile/qa)
- Diccionario de sinónimos tecnológicos (104 entradas)
- Umbrales: APLICA ≥ 73, QUIZÁ ≥ 52
- Extracción batch de señales vía Claude Haiku con prompt caching
