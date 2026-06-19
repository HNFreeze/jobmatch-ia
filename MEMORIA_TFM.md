# JobMatch IA — Memoria del Trabajo de Fin de Máster

**Autor:** Sergio  
**Fecha:** Mayo 2026  
**Titulación:** Máster en Inteligencia Artificial  

---

## Índice

1. [Introducción y motivación](#1-introducción-y-motivación)
2. [Objetivos del proyecto](#2-objetivos-del-proyecto)
3. [Descripción general de la aplicación](#3-descripción-general-de-la-aplicación)
4. [Arquitectura del sistema](#4-arquitectura-del-sistema)
5. [Stack tecnológico](#5-stack-tecnológico)
6. [Módulo de inteligencia artificial](#6-módulo-de-inteligencia-artificial) *(incluye §6.6 Batería de pruebas de fiabilidad)*
7. [Base de datos y modelos de datos](#7-base-de-datos-y-modelos-de-datos)
8. [API REST — Backend](#8-api-rest--backend)
9. [Interfaz de usuario — Frontend](#9-interfaz-de-usuario--frontend)
10. [Seguridad y autenticación](#10-seguridad-y-autenticación)
11. [Sistema de cuotas de IA](#11-sistema-de-cuotas-de-ia)
12. [Fuentes externas de datos de empleo](#12-fuentes-externas-de-datos-de-empleo)
13. [Despliegue e infraestructura](#13-despliegue-e-infraestructura)
14. [Funcionalidades principales](#14-funcionalidades-principales)
15. [Decisiones técnicas relevantes](#15-decisiones-técnicas-relevantes)
16. [Conclusiones](#16-conclusiones)

---

## 1. Introducción y motivación

El mercado laboral tecnológico es ruidoso. Las bolsas de empleo como InfoJobs, LinkedIn o Indeed ofrecen cientos de ofertas pero ninguna de ellas te dice, de forma honesta, si realmente encajas. El usuario termina leyendo decenas de descripciones, aplicando a empleos donde quizá no llega o ignorando ofertas donde sí habría encajado. El resultado es tiempo perdido, frustraciones y una sensación de desconexión entre lo que uno sabe y lo que el mercado pide.

Este proyecto nació de esa frustración. La idea central es sencilla: si le das a una IA tu perfil real (experiencia, tecnologías, idiomas, preferencias) y le pides que analice las ofertas disponibles, puede decirte con criterio dónde aplica, dónde quizás y dónde claramente no. Y puede explicarte por qué.

**JobMatch IA** es una aplicación web full-stack que automatiza ese proceso. No es un simple buscador con filtros. Es un sistema que extrae ofertas de empleo en tiempo real, las analiza con inteligencia artificial contra el perfil del usuario, asigna una valoración de encaje y presenta los resultados de forma visual y accionable. Además incorpora un módulo de mejora de CV con análisis ATS, generación de cartas de presentación, seguimiento de candidaturas en tablero Kanban, y un panel de administración completo.

---

## 2. Objetivos del proyecto

El TFM se planteó con los siguientes objetivos concretos:

**Objetivo principal:** Construir una aplicación funcional, desplegada en producción, que use LLMs para mejorar la experiencia de búsqueda de empleo en el sector tecnológico español.

**Objetivos específicos:**

- Integrar la API de Claude (Anthropic) para análisis semántico de compatibilidad entre perfil y oferta.
- Construir un sistema de extracción y normalización de ofertas desde múltiples fuentes (Adzuna, JSearch, portales ATS directos).
- Implementar un módulo de análisis y mejora de CVs con detección de problemas ATS y generación de versión mejorada.
- Desarrollar un generador de cartas de presentación personalizadas.
- Crear una interfaz de usuario intuitiva, responsive y sin dependencias de librerías UI externas.
- Implementar autenticación segura con verificación de email, sistema de cuotas por usuario y panel de administración.
- Desplegar el sistema completo en producción con CI/CD automático.

---

## 3. Descripción general de la aplicación

JobMatch IA es una aplicación web accesible por navegador, con arquitectura cliente-servidor. El backend expone una API REST y el frontend es una SPA (Single Page Application) que la consume. Todo el procesamiento de IA ocurre en el servidor; el cliente solo recibe resultados ya procesados.

Las funciones principales que ofrece al usuario final son:

**Búsqueda inteligente de ofertas:** el usuario configura su perfil (tecnologías, años de experiencia, nivel de inglés, ubicaciones preferidas, modalidad de trabajo) y lanza una búsqueda. El sistema extrae ofertas actualizadas de múltiples fuentes, las analiza con Claude y devuelve un ranking categorizado en tres niveles: **APLICA**, **QUIZÁ** y **NO ENCAJA**, con explicaciones en español de puntos fuertes, brechas y razones de la decisión.

**Agente de empleo con IA:** el usuario describe en lenguaje natural lo que busca (p. ej. *"ofertas de React junior en remoto"*) y un agente supervisado ejecuta una máquina de estados persistida que interpreta la instrucción, busca, filtra, puntúa y **explica** cada oferta, solicitando **confirmación humana** antes de guardar los resultados elegidos. La interpretación usa una única llamada a Claude validada con Pydantic, con un *fallback* determinista si la IA falla. Es la funcionalidad diferenciadora del proyecto.

**Análisis y mejora de CV:** el usuario sube su CV en PDF. El sistema extrae el texto, analiza la estructura con Claude, detecta problemas de compatibilidad ATS, genera una versión mejorada con puntuación antes/después, y permite editar el resultado y exportar a PDF con dos plantillas diferentes.

**Generador de carta de presentación:** dado el título, empresa y descripción de una oferta, Claude genera una carta personalizada en español que conecta el perfil del candidato con los requisitos específicos del puesto.

**Simulación de entrevista con IA:** el usuario practica una entrevista conversacional con Claude (que interpreta el rol de entrevistador) sobre una candidatura concreta, con voz en el navegador (Web Speech API) y un *feedback* estructurado al finalizar.

**Gestión de candidaturas:** tablero Kanban donde el usuario registra el estado de sus candidaturas (guardada, en proceso, entrevista, rechazada, etc.), añade notas y establece fechas de seguimiento con indicadores visuales de urgencia.

**Dashboard de actividad:** resumen visual del historial de búsquedas, métricas de encaje, recordatorios de seguimiento próximos, tendencia de resultados y análisis de mercado (tecnologías más demandadas vs. perfil del usuario).

**Panel de administración:** gestión de usuarios, cuotas, actividad, costes de IA, estado del índice de ofertas y ejecución de tareas de ingestión de datos.

---

## 4. Arquitectura del sistema

La arquitectura sigue un modelo de tres capas bien definidas:

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React SPA)                                        │
│  Create React App · Inline CSS · Radix (headless)            │
│  Vercel / Static Hosting                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTP / JSON
┌──────────────────────▼──────────────────────────────────────┐
│  BACKEND (FastAPI)                                           │
│  Python · SQLAlchemy · Alembic · JWT · bcrypt               │
│  Render / Web Service                                        │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Routers      │  │  Services     │  │  Background     │  │
│  │  auth, user   │  │  matching     │  │  Task           │  │
│  │  match, cv    │  │  agent_service│  │  job ingestion  │  │
│  │  agent        │  │  cv_service   │  └─────────────────┘  │
│  │  favorites    │  │  quota        │                       │
│  │  applications │  │  pdf_service  │                       │
│  │  admin        │  └───────────────┘                       │
│  └───────────────┘                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼──────────────────────┐
         │             │                      │
┌────────▼───┐  ┌──────▼──────┐  ┌───────────▼──────────┐
│ PostgreSQL │  │ Claude API  │  │ External Job Sources  │
│ (Supabase) │  │ (Anthropic) │  │ Adzuna, JSearch,      │
│            │  │             │  │ Greenhouse, Ashby,    │
└────────────┘  └─────────────┘  │ Lever, Recruitee      │
                                 └──────────────────────┘
```

**Frontend → Backend:** toda la comunicación es HTTPS con JSON. El frontend envía el JWT en el header `Authorization: Bearer`. No hay cookies de sesión.

**Backend → Claude:** llamadas síncronas con el SDK de Anthropic. El backend actúa como intermediario: nunca expone la API key al cliente, controla el uso mediante el sistema de cuotas y loguea cada llamada con coste estimado.

**Backend → PostgreSQL:** ORM SQLAlchemy con pool de conexiones. La base de datos es PostgreSQL gestionado en Supabase. Las migraciones se aplican automáticamente al arrancar el servidor con Alembic, sin necesidad de intervención manual en producción.

**Tarea en background:** un loop async que se ejecuta en segundo plano desde el arranque del servidor para la ingestión automática de ofertas cada 12 horas.

---

## 5. Stack tecnológico

### Backend

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework web | FastAPI | latest |
| ORM | SQLAlchemy | latest |
| Migraciones | Alembic | latest |
| Base de datos | PostgreSQL | 15 |
| Driver PostgreSQL | psycopg2-binary | latest |
| IA / LLM | Anthropic SDK | latest |
| PDF | fpdf2 | latest |
| HTTP client | httpx | latest |
| Auth tokens | PyJWT | latest |
| Hash contraseñas | bcrypt | latest |
| Parsing PDF | pypdf | latest |
| Variables de entorno | python-dotenv | latest |
| Servidor ASGI | uvicorn | latest |

### Frontend

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework UI | React | 19 |
| Build tool | Create React App | 5.0.1 |
| Primitivos accesibles | Radix UI (headless) | latest |
| Estilos | Inline CSS + tokens de tema | — |
| Lenguaje | JavaScript (JSX) | ES2022 |

La decisión de no usar ninguna librería de componentes con estilos propios (ni MUI, ni Tailwind, ni styled-components) fue deliberada: el objetivo era tener control total sobre el aspecto visual y construir los componentes desde cero. La única excepción son los **primitivos headless de Radix UI** (diálogo, select), adoptados únicamente por accesibilidad (gestión de foco, roles ARIA, navegación por teclado), ya que no imponen estilos visuales.

### Servicios externos

| Servicio | Propósito |
|----------|-----------|
| Anthropic Claude API | Agente, matching de ofertas, análisis de CV, generación de carta, entrevista |
| Adzuna API | Fuente principal de ofertas de empleo |
| JSearch API (RapidAPI) | Agregador secundario de ofertas |
| Greenhouse / Ashby / Lever / Recruitee | ATSs con APIs públicas de oferta |
| Cloudflare Turnstile | CAPTCHA anti-bot en registro |
| Brevo / SMTP | Envío de emails (verificación de cuenta) |
| ElevenLabs (opcional) | TTS de voz para la entrevista (desactivable) |
| Vercel | Hosting del frontend |
| Render | Hosting del backend (Web Service) |
| Supabase | PostgreSQL gestionado |

---

## 6. Módulo de inteligencia artificial

Esta es la pieza central del proyecto. Todo el análisis inteligente pasa por Claude, el modelo de lenguaje de Anthropic.

### 6.1 Matching de ofertas — el núcleo del sistema

Cuando un usuario lanza una búsqueda, el sistema hace lo siguiente:

1. **Extrae ofertas frescas** de las fuentes configuradas (Adzuna principalmente), filtrando por las ubicaciones y modalidades del perfil del usuario.
2. **Construye un hash del perfil** (tecnologías + experiencia + preferencias). Si existe un resultado en caché de las últimas 24 horas para ese hash, lo devuelve directamente sin invocar la API de IA.
3. **Prepara el prompt** para Claude con el perfil completo del candidato y el detalle de cada oferta (título, empresa, descripción, salario si está disponible).
4. **Invoca claude-haiku-4-5-20251001** — se eligió Haiku por su velocidad y coste reducido, ideal para procesar lotes de hasta 20 ofertas en una sola llamada.
5. **Parsea la respuesta estructurada** de Claude, que para cada oferta incluye:
   - `resultado`: APLICA / QUIZÁ / NO_ENCAJA
   - `puntuacion`: 0-100
   - `ranking_score`: para ordenar con mayor granularidad
   - `strengths`: puntos a favor del candidato para esa oferta
   - `gaps`: habilidades que le faltan al candidato
   - `decision_reason`: explicación en prosa del veredicto
6. **Guarda en caché** y devuelve los resultados ordenados.

El sistema distingue tres niveles de encaje:
- **APLICA**: el candidato cumple los requisitos principales, los tecnologías coinciden, la experiencia es suficiente. Se recomienda aplicar directamente.
- **QUIZÁ**: cumplimiento parcial. Puede que falte una tecnología secundaria o que la experiencia esté en el límite. Merece consideración.
- **NO ENCAJA**: brechas significativas entre perfil y requisitos. El sistema explica qué falta concretamente.

### 6.2 Agente de empleo con IA — orquestación supervisada

El agente es la funcionalidad diferenciadora del proyecto: convierte una instrucción en lenguaje natural en una búsqueda completa, ejecutada paso a paso y con el usuario en control.

**Máquina de estados persistida.** Cada ejecución se modela como un `AgentRun` en base de datos que avanza por estados explícitos: `CREATED → INTERPRETING → SEARCHING → FILTERING → ANALYZING → RANKING → WAITING_FOR_USER → EXECUTING_APPROVED_ACTION → COMPLETED` (con `FAILED` y `CANCELLED` como estados terminales de error). Esto hace el proceso trazable y auditable, frente a una "caja negra".

**La IA solo interpreta.** Se realiza **una única** llamada a Claude (Haiku) en el paso de interpretación, cuyo resultado se valida con un esquema **Pydantic** (`SearchInstruction`: rol, tecnologías, ubicación, modalidad, seniority…). Si la IA falla o devuelve un JSON inválido, un **fallback determinista** extrae la intención por heurística. El resto de pasos (buscar, filtrar, puntuar, explicar) **reutiliza el motor de matching ya cacheado**, por lo que el agente no añade coste de IA por oferta.

**Confirmación humana (*human-in-the-loop*).** Al llegar a `WAITING_FOR_USER`, el agente presenta los resultados puntuados y explicados, pero **no actúa solo**: el usuario revisa y confirma qué ofertas guardar. La acción (guardar como favoritos) solo se ejecuta tras la aprobación explícita.

**Seguridad.** Todas las consultas se filtran por `user_id` (prevención de IDOR) y la instrucción del usuario se trata como dato no confiable (defensa frente a inyección de prompts en el paso de interpretación).

### 6.3 Análisis y mejora de CV (módulo ATS)

El flujo de mejora de CV es uno de los más complejos del sistema:

1. El usuario sube su CV en PDF.
2. `pypdf` extrae el texto del documento.
3. Claude analiza el texto y construye un `cv_structured_json`: un diccionario normalizado con secciones (contacto, resumen profesional, experiencia laboral, formación, idiomas, habilidades técnicas, certificaciones).
4. La respuesta pasa por un pipeline de validación: `normalize_cv_structured()` → `validate_cv_structured()`.
5. El sistema calcula una puntuación ATS del CV original, identifica problemas (ausencia de palabras clave, formato inadecuado para parsers automáticos, secciones mal estructuradas) y genera un `improved_cv_text` optimizado.
6. El usuario puede editar el resultado en un modal interactivo y exportarlo a PDF en dos plantillas: `professional_modern` (diseño clásico con secciones bien diferenciadas) y `ats_minimal` (texto limpio sin elementos gráficos que confunden a los sistemas ATS).

La generación de PDF usa `fpdf2` con Helvetica como fuente nativa, con una función `_safe_text()` que convierte caracteres no-Latin-1 (bullets Unicode, em-dashes, comillas tipográficas) a equivalentes imprimibles, preservando la acentuación española.

**Variantes por oferta:** el usuario puede crear versiones del CV optimizadas específicamente para cada oferta concreta. El sistema guarda un snapshot de la oferta junto con la variante del CV, de modo que el usuario puede mantener múltiples versiones del mismo CV, cada una orientada a un rol o empresa diferente.

### 6.4 Generación de cartas de presentación

Para este módulo se usa **claude-sonnet-4-6** en lugar de Haiku, porque la carta requiere un tono más natural, creatividad en la redacción y capacidad de conectar con detalle el perfil del candidato con la oferta específica.

El prompt incluye: título del puesto, empresa, descripción completa, stack tecnológico del candidato y años de experiencia. Claude genera una carta de cuatro párrafos en español, profesional pero humana, que menciona la empresa por su nombre y conecta las tecnologías del candidato con los requisitos concretos del puesto.

### 6.5 Simulación de entrevista con IA y voz

El módulo de simulación de entrevistas combina a Claude como cerebro conversacional con las APIs de voz del navegador (Web Speech API) para la síntesis y el reconocimiento de voz. La síntesis con ElevenLabs es opcional y está **desactivada por defecto**, de modo que el módulo funciona con coste de voz cero.

**Flujo de la entrevista:**

1. El usuario mueve una candidatura a la columna "Entrevista" en el Kanban y pulsa el botón "Simular entrevista" que aparece en la tarjeta.
2. Se crea una sesión en base de datos (`InterviewSession`) vinculada a la candidatura.
3. Claude actúa como "Alex", un entrevistador de RRHH, con un system prompt que conoce el puesto y la empresa. La entrevista sigue una estructura: presentación → preguntas técnicas → preguntas situacionales → cierre.
4. Cada respuesta de Claude se locuta con la síntesis de voz del navegador (Web Speech API, `SpeechSynthesis`, en español). Opcionalmente, si se habilita `INTERVIEW_ELEVENLABS_ENABLED`, se usa ElevenLabs (`eleven_multilingual_v2`) y el audio mp3 se devuelve en base64.
5. Durante la locución, el avatar de "Alex" muestra animaciones CSS: anillos pulsantes, barras de onda y la boca del avatar se abre/cierra con `scaleY`.
6. El usuario puede responder escribiendo (textarea + Enter) o por voz (Web Speech API, `SpeechRecognition`, español).
7. Cuando Claude termina la entrevista (emite la señal interna `ENTREVISTA_FINALIZADA`), el sistema genera un feedback estructurado en JSON: puntuación 1-10, resumen, puntos fuertes, áreas de mejora y 3 consejos específicos.

**Cuota:** 1 entrevista por usuario al día (contador `interview_count` en `AIDailyUsage`, independiente de la cuota general).

**Avatar "Alex":** SVG puro con ojos, cejas y boca animada mediante CSS keyframes. Sin ninguna librería 3D. Estados visuales: `isSpeaking` (rings + wave bars + mouthTalk animation), `isListening` (punto rojo pulsante), idle.

**Stack tecnológico del módulo:**
- Claude Haiku: conversación de entrevista + generación de feedback
- Web Speech API (`SpeechSynthesis`): locución del entrevistador en el navegador (coste cero)
- Web Speech API (`SpeechRecognition`): reconocimiento de voz del candidato (Chrome/Edge)
- ElevenLabs `eleven_multilingual_v2` (opcional): TTS de mayor calidad si se habilita por configuración

### 6.6 Validación de fiabilidad del motor de matching — Batería de pruebas

El motor de matching fue sometido a una batería de pruebas sistemática para evaluar su fiabilidad antes del cierre del TFM. El objetivo era detectar falsos positivos (ofertas irrelevantes que el sistema clasificara como APLICA/QUIZÁ), falsos negativos (ofertas relevantes descartadas como NO ENCAJA) y comportamientos anómalos del pipeline de puntuación.

#### Metodología

Se diseñaron dos baterías de pruebas automatizadas (`battery_v1.py` y `battery_v2.py`) que ejecutan la llamada real a la API de matching con 14 perfiles distintos y analizan programáticamente los 20 resultados de cada uno:

- **Perfiles probados:** React junior sin experiencia, React+TS 1yr, React+Angular+Vue 3yr, Python+Django 2yr, Python+FastAPI 4yr, Java+Spring 5yr, Node.js+Express 2yr, Fullstack React+Node 3yr, PHP+Laravel 4yr, Data Science Python 2yr, ML Engineer 4yr, DevOps 3yr, Go+Rust 3yr (nicho), React+Python fullstack 6yr senior.
- **Total de ofertas analizadas:** 277 (con filtros activos) / 160 (sin filtros).
- **Métricas recogidas:** distribución APLICA/QUIZÁ/NO ENCAJA, resultados ghost (score ≥50% pero todos los arrays vacíos), relevancia tecnológica de los QUIZÁ, tiempos de respuesta.

#### Problemas detectados

**1. Resultados ghost-QUIZÁ.** Ofertas completamente no técnicas (coordinador de flotas, becario de tesorería, analista de revenue) obtenían puntuaciones de 56-59% clasificadas como QUIZÁ porque el motor acumulaba puntos parciales en dimensiones no-técnicas (seniority junior → +15 pts, idioma inglés → +8 pts, modalidad remota → +8 pts, ubicación Madrid → +3 pts) incluso cuando no había ninguna skill reconocida. Estos resultados tenían `skills_match=[]`, `skills_missing=[]`, `blockers=[]`.

**2. Contaminación por fuentes de empleo no técnicas.** El board de Greenhouse de Cabify (`cabify` en `GREENHOUSE_BOARD_TOKENS`) publica tanto ofertas tech como roles de operaciones, finanzas, flota y ventas. Al no existir pre-filtrado, ofertas como "Coordinador Ads InCar | Vinilado de Flotas" aparecían en todos los perfiles.

**3. Ambigüedad de la keyword `"go"`.** El lenguaje de programación Go estaba registrado con la clave `"go"` en `TECH_KEYWORDS`. La regex de extracción de señales (`(?<!\w)go(?!\w)`) coincidía con la palabra inglesa "go" en frases como "go to market" o "go ahead". Para el perfil Go+Rust, esto causaba que "ES — Go to Market Analyst" alcanzara un 77% y "Senior Product Designer" (con "go" en el cuerpo de la oferta) se clasificara como **APLICA al 80%**, un falso positivo grave.

**4. Umbral APLICA demasiado alto.** El umbral de APLICA estaba fijado en 78 puntos. Los mejores matchs legítimos rondaban el 70-75% (por ejemplo, "AI Engineer Full Remote" para React+Python 6yr, "Backend Software Engineer" para Java+Spring). APLICA nunca se alcanzaba en condiciones normales.

#### Soluciones implementadas (engine v4→v5)

| Capa | Mecanismo | Efecto |
|------|-----------|--------|
| **Pre-filtro tech** | `_is_tech_offer()`: descarta ofertas con cero indicadores técnicos en título + 600 chars de descripción. Usa `TECH_JOB_INDICATORS` (93 términos: keywords tech + roles tipo "engineer", "developer", "fullstack", etc.) | Coordinador de Flotas, Treasury Trainee, Finance Internship → eliminados antes de llegar a Claude |
| **Post-filtro ghost-QUIZÁ** | En `_evaluate_offer_match()`: si resultado es QUIZÁ y `skills_match=[]`, `skills_missing=[]`, `required_skills=[]`, `preferred_skills=[]` → degradar a NO ENCAJA (score ≤49) | Segunda línea de defensa para ofertas que pasen el pre-filtro pero no tengan evidencia de skills |
| **Fix "go" → "golang"** | `"go"` eliminado de `TECH_KEYWORDS`, sustituido por `"golang"`. Se añade `TECH_NAME_SYNONYMS = {"go": "golang", "node": "node.js", ...}` y se aplica en `_normalize_profile_stack()` para que el perfil "Go" siga coincidiendo con ofertas que usen "Golang" | Falsos positivos de "go to market" eliminados; Go+Rust 3yr baja de 80% APLICA (falso) a resultados correctos |
| **Calibración umbral APLICA** | Umbral reducido de 78 → 73 | Java+Spring 5yr obtiene correctamente 95% APLICA en "Backend Software Engineer" |
| **Bypass rate limit super admin** | El usuario con `is_super_admin=True` no aplica rate limit en `/api/match` | Permite ejecutar baterías de pruebas sin colisionar con los límites de producción |

#### Resultados tras las correcciones

| Métrica | Antes (v3) | Después (v5) |
|---------|-----------|-------------|
| Ghost-QUIZÁ por perfil | 1-4 por test | **0 en todos los perfiles** |
| Coordinador de Flotas visible | Sí (100% de tests) | **No (pre-filtrado)** |
| APLICA en batch 14 perfiles | 1 (falso positivo) | **1 (legítimo: Backend SE para Java 5yr)** |
| QUIZÁ irrelevantes | 33/68 (49%) | **2/50 (4%)** |
| Go+Rust falso positivo 80% | Presente | **Eliminado** |

#### Conclusiones de la primera batería (v5)

- **Frontend junior (React 0-1yr):** 0% de relevancia positiva. No indica fallo del motor sino escasez de ofertas junior en las fuentes configuradas. El motor clasifica correctamente como NO ENCAJA las ofertas existentes (todas con blockers por experiencia).
- **Backend senior (Java 5yr, Python 4yr, ML 4yr):** 25-40% de relevancia positiva, APLICA alcanzable. El motor funciona correctamente para perfiles con experiencia y stack alineado.
- **Nicho (Go+Rust):** muy pocas ofertas relevantes en el mercado español. El motor lo refleja: 2 QUIZÁ reales sobre 13 resultados (el resto filtrado).
- **El motor es defensivo por diseño:** prefiere mostrar NO ENCAJA antes que generar falsas esperanzas. Esto es una decisión pedagógica deliberada para un servicio de orientación laboral.

---

#### Segunda iteración de mejoras (engine v6_zero_match)

Tras la primera batería se identificaron dos patrones residuales que justificaron una segunda ronda de mejoras:

**Problema 5: QUIZÁ "zero-match" por acumulación de scores secundarios.** Algunas ofertas con 2 o más `required_skills` extraídas por Claude —completamente fuera del stack del candidato— alcanzaban el umbral QUIZÁ (52 pts) porque los componentes no-skill del scoring se sumaban: seniority compatible (+14-15 pts), idioma inglés cubierto (+10 pts), modalidad remota (+8 pts), ubicación Madrid (+8 pts). Con `skills_score=0` pero un total de ~52-56 pts, ofertas de Data Science aparecían como QUIZÁ para perfiles de Go/Rust o Node.js que no tienen ninguna skill relevante para esos puestos.

**Problema 6: Scoring plano para perfiles senior en ofertas sin requisitos explícitos.** Cuando una oferta no especifica años de experiencia ni nivel de seniority, un perfil de 1 año y uno de 6 años recibían el mismo score de seniority (8 pts) por el path por defecto. Esto penalizaba relativamente a los perfiles sénior frente a ofertas con requisitos ambiguos.

#### Soluciones implementadas (engine v5→v6)

| Capa | Mecanismo | Efecto |
|------|-----------|--------|
| **Post-filtro zero-match** | En `_evaluate_offer_match()`: si resultado es QUIZÁ, `skills_match=[]`, `len(missing_skills)≥2` y hay `required_skills` reales extraídas por Claude → degradar a NO ENCAJA (score ≤49). El guard `signals.get("required_skills")` evita dispararlo cuando no hay skills requeridas (path de preferred-only), previniendo falsos negativos en roles genéricos. | Ofertas de DS/ML dejan de aparecer como QUIZÁ para perfiles Go, Node o React que no tienen skills de datos. |
| **Boost seniority ambigua** | En `_score_seniority()`: cuando la oferta no explicita años ni nivel, si `profile_years ≥ 4` → 11 pts en lugar de 8 pts. | Perfiles con 4+ años reciben una ventaja proporcional a su experiencia en ofertas sin requisitos explícitos. |

#### Resultados de la segunda batería (v6) — 14 perfiles, 259 ofertas

| Perfil | n | APLICA | QUIZÁ | NO ENCAJA | Ghost | IRREL |
|--------|---|--------|-------|-----------|-------|-------|
| React junior sin exp | 20 | 0 | 0 | 20 | 0 | 0 |
| React+TS 1yr | 20 | 0 | 0 | 20 | 0 | 0 |
| React+Angular+Vue 3yr | 20 | 0 | 0 | 20 | 0 | 0 |
| Python+Django 2yr | 20 | 0 | 2 | 18 | 0 | 0 |
| Python+FastAPI 4yr | 20 | 0 | 5 | 15 | 0 | 0 |
| Java+Spring 5yr senior | 20 | **1** | 3 | 16 | 0 | 0 |
| Node.js+Express 2yr | 20 | 0 | 0 | 20 | 0 | 0 |
| Fullstack React+Node 3yr | 20 | 0 | 2 | 18 | 0 | 0 |
| PHP+Laravel 4yr | 13 | 0 | 1 | 12 | 0 | 0 |
| Data Science Python 2yr | 20 | **1** | 5 | 14 | 0 | 1 |
| ML Engineer 4yr | 20 | 0 | 5 | 15 | 0 | 0 |
| DevOps 3yr | 13 | 0 | 4 | 9 | 0 | 0 |
| Go+Rust 3yr (nicho) | 13 | 0 | 2 | 11 | 0 | 0 |
| React+Python fullstack 6yr | 20 | 0 | 6 | 14 | 0 | 0 |
| **TOTAL** | **259** | **2** | **35** | **222** | **0** | **1** |

#### Comparativa evolutiva del motor

| Métrica | v3 (sin filtros) | v5 (primera batería) | v6 (segunda batería) |
|---------|-----------------|---------------------|---------------------|
| Ghost-QUIZÁ por perfil | 1–4 | 0 | **0** |
| Ofertas no-tech visibles | Todas | Eliminadas por pre-filtro | **Eliminadas** |
| QUIZÁ irrelevantes (total) | ~33/68 (49%) | 2/50 (4%) | **1/37 (3%)** |
| APLICA legítimas | 0 (1 falso positivo) | 2 | **2** |
| "Data Scientist" para Go/Rust | QUIZÁ ~55% | QUIZÁ ~55% (residual) | **NO ENCAJA (49%)** |
| Boost seniority senior/ambiguo | No | No | **+3 pts para ≥4yr** |

#### Conclusiones de la segunda batería (v6)

- **0 ghost-QUIZÁ en los 14 perfiles** (tercer test consecutivo): la combinación de pre-filtro + ghost post-filtro + zero-match post-filtro forma una cadena robusta que elimina prácticamente todos los falsos positivos observables.
- **Frontend/Node perfiles siguen con 0% relevancia positiva.** Confirmado como limitación de datos, no del motor: las fuentes configuradas (Adzuna, Greenhouse) en Madrid tienen muy escasa oferta frontend/junior en el momento de la prueba. El motor los clasifica correctamente (blockers por experiencia, skills_missing).
- **Java+Spring 5yr → APLICA 95%** en "Backend Software Engineer" y **Data Science 2yr → APLICA 76%** en "Data Scientist Applied Science": el motor identifica el match real cuando hay alineación fuerte.
- **QUIZÁ de calidad:** los QUIZÁ residuales tienen todos `skills_match≥1` (ningún ghost), scores 52-72%, y representan matches parciales genuinos que el candidato podría explorar.
- **El zero-match filter resuelve el problema de dominio cruzado:** ofertas de Data Science/ML/AI ya no contaminan perfiles de Go, React o Node que no tienen skills de datos.

---

#### Tercera iteración — Batería masiva (100 perfiles, engine v7_domain_filter)

Para validar el motor a mayor escala y detectar patrones sistemáticos no observables con 14 perfiles, se diseñó y ejecutó una batería masiva de 100 perfiles (`battery_v5_massive.py`) con cobertura completa de stacks, niveles de experiencia y casos extremos.

##### Metodología de la batería masiva

Los 100 perfiles se distribuyeron en 10 categorías:

| Categoría | Perfiles | Cobertura |
|-----------|----------|-----------|
| Frontend | 15 | React/Angular/Vue/Next.js × 0-6yr, inglés básico/avanzado |
| Python backend | 15 | Django/FastAPI/Flask × 0-8yr, stack mínimo a completo |
| Java | 10 | Spring Boot × 1-8yr, Kotlin, Azure |
| Node.js | 8 | Express/NestJS/GraphQL × 1-5yr |
| Fullstack | 10 | React+Node, React+Python, Angular+Java × 1-7yr |
| PHP | 5 | Laravel/Symfony × 1-6yr |
| Data/ML/AI | 12 | DS, ML, Data Engineering, Analytics × 1-6yr |
| DevOps/Cloud | 8 | K8s/Terraform/SRE/Platform × 1-6yr |
| Nicho/Mobile/.NET | 10 | Go, Rust, .NET, Android, iOS, Flutter × 1-5yr |
| Edge cases | 7 | SQL/BI puro, SAP, Cybersec, QA, junior con stack grande, Tech Lead 8yr, senior 10yr |

**Total:** 1864 ofertas evaluadas · Tiempo: 4 minutos (señales cacheadas de batería anterior) · Coste estimado: ~$0.30

##### Resultados globales de la batería masiva

| Métrica | Resultado |
|---------|-----------|
| Tests OK | 100/100 (0 errores) |
| Total ofertas evaluadas | 1864 |
| APLICA | 77 (4%) |
| QUIZÁ | 228 (12%) |
| NO ENCAJA | 1559 (83%) |
| Ghost survivors | **0** |
| QUIZÁ/APLICA irrelevantes | 11 (0.6% del total) |
| Perfiles con ≥1 APLICA | 36/100 |
| Relevancia media | 16% |

##### Resultados por categoría

| Categoría | Tests | APLICA | QUIZÁ | Rel% |
|-----------|-------|--------|-------|------|
| Frontend | 15 | 0 | 11 | 3% |
| Python backend | 15 | 11 | 47 | 19% |
| Java | 10 | 9 | 20 | 15% |
| Node.js | 8 | 1 | 11 | 7% |
| Fullstack | 10 | 4 | 28 | 16% |
| PHP | 5 | 1 | 4 | 6% |
| Data/ML/AI | 12 | 25 | 53 | **32%** |
| DevOps/Cloud | 8 | 11 | 23 | **25%** |
| Nicho/Mobile/.NET | 10 | 2 | 8 | 6% |
| Edge cases | 7 | 13 | 23 | 27% |

##### Problema detectado — Desajuste de dominio (cross-domain contamination)

La batería masiva reveló un patrón nuevo que las baterías de 14 perfiles no habían expuesto: perfiles de **Cybersecurity** y **QA** obtenían APLICA (82%) en ofertas de Data Science. Estos perfiles tienen Python + SQL en su stack, que coinciden con los `required_skills` de la oferta DS, pero carecen de cualquier herramienta específica de datos (Pandas, TensorFlow, Jupyter, Spark, etc.). El motor no podía distinguir "Python para scripts de seguridad" de "Python para Machine Learning" porque ambos son el mismo token.

**Ejemplo concreto:** `Cybersecurity 3yr` (stack: Python, Linux, Docker, SQL, Network Security) → APLICA 82% en "Data Scientist Applied Science" por `sm=2` (Python + SQL). Resultado claramente incorrecto.

##### Solución implementada (engine v7_domain_filter)

| Capa | Mecanismo | Efecto |
|------|-----------|--------|
| **Post-filtro domain mismatch** | En `_evaluate_offer_match()`: si `result=APLICA`, `normalized_role=data`, y el perfil no contiene ninguna skill de `DATA_SPECIFIC_SKILLS` (pandas, numpy, TensorFlow, PyTorch, Spark, Airflow, dbt, Tableau, Power BI, Jupyter, etc.) → degradar a QUIZÁ (score ≤69). | Cybersecurity/QA/DevOps con Python genérico dejan de obtener APLICA en ofertas DS. SQL/BI con Power BI+Tableau mantienen APLICA porque tienen skills específicas de datos. |

```python
DATA_SPECIFIC_SKILLS = frozenset({
    "pandas", "numpy", "scipy", "scikit-learn",
    "tensorflow", "pytorch", "keras", "mlflow", "xgboost",
    "spark", "pyspark", "airflow", "dbt",
    "tableau", "power bi", "jupyter",
    "machine learning", "deep learning", "data engineering", ...
})
```

##### Comparativa evolutiva completa del motor

| Métrica | v3 | v5 | v6 | v7 |
|---------|----|----|----|----|
| Ghost-QUIZÁ/perfil | 1-4 | 0 | 0 | **0** |
| Ofertas no-tech visibles | Sí | No | No | **No** |
| QUIZÁ irrelevantes | 49% | 4% | 3% | **<1%** |
| "go"→falso APLICA 80% | Sí | No | No | **No** |
| DS offer para Go/Rust perfil | QUIZÁ 55% | QUIZÁ 55% | NO_ENCAJA | **NO_ENCAJA** |
| Cybersec/QA → DS | No medido | No medido | APLICA 82% | **QUIZÁ ≤69%** |
| Perfiles con APLICA (100 test) | — | — | — | **36/100** |

##### Conclusiones de la batería masiva

- **36/100 perfiles obtienen al menos 1 APLICA.** Los que no lo obtienen pertenecen mayoritariamente a dos grupos: (a) perfiles frontend/junior donde el mercado madrileño no tiene oferta suficiente en las fuentes configuradas, y (b) tecnologías de nicho (iOS, Flutter, .NET) con escasa representación en Adzuna/Greenhouse.
- **Data/ML/AI es la categoría mejor servida** (32% relevancia, 25/12 perfiles con APLICA). Coherente con el estado del mercado tech español en 2025: alta demanda de perfiles de datos.
- **DevOps/Cloud segunda mejor categoría** (25%). SRE 4yr → APLICA 76% en "Site Reliability Engineer"; Cloud Architect 6yr → 3 APLICA.
- **0 ghost survivors en 1864 ofertas**: la cadena de filtros es robusta a escala.
- **El motor escala bien**: 100 perfiles completados en 4 minutos gracias al caching de señales por oferta. El coste incremental de añadir perfiles es casi cero una vez que las señales están cacheadas.

### 6.7 Análisis de mercado y brecha de habilidades

El endpoint de análisis de mercado (`GET /api/match/market-analysis`) no requiere una llamada a Claude sino que opera sobre los datos del índice de ofertas ya almacenado en la base de datos. Analiza las habilidades más frecuentes en las ofertas activas, construye un ranking de demanda y lo cruza con el perfil del usuario para identificar las tecnologías de alta demanda que el candidato no tiene — con el objetivo de priorizar su plan de formación.

### 6.8 Modelos utilizados y consideraciones de coste

| Modelo | Usos | Razón de elección |
|--------|------|-------------------|
| `claude-haiku-4-5-20251001` | Matching, análisis de CV, análisis de mercado | Velocidad y coste ($0.80/$4.00 por millón de tokens) |
| `claude-sonnet-4-6` | Generación de cartas de presentación | Mayor calidad en redacción creativa ($3.00/$15.00 por millón) |

Cada llamada a la API queda registrada en la tabla `AIAPICostEvent` con el número de tokens de entrada y salida, el modelo usado, el coste estimado en USD y el usuario que la generó. El panel de administración muestra el desglose de costes acumulados por feature, por modelo y por usuario.

---

## 7. Base de datos y modelos de datos

Se usa PostgreSQL con SQLAlchemy como ORM y Alembic para gestionar las migraciones. El esquema tiene 20 tablas, agrupadas por dominio:

### Usuarios y autenticación
- **users** — datos del usuario: email, alias, nombre, contraseña (hash bcrypt), perfil profesional (stack JSON, experiencia, idiomas, ubicaciones, modalidad), flags de estado (email verificado, bloqueado, admin), cuota diaria de IA, consentimiento de analítica.
- **email_verification_tokens** — tokens de verificación de email (almacenados como hash SHA256, con fecha de expiración y flag de uso único).

### Ofertas y búsquedas
- **job_offers** — índice local de ofertas: adzuna_id (unique), título, empresa, descripción, salario, fecha de publicación, URL, habilidades detectadas (JSON), metadatos de fuente (nombre, tipo, confianza), señales de modalidad de trabajo.
- **search_cache** — caché de resultados de matching por hash de perfil (TTL 24h). Almacena el JSON completo de resultados para reutilizarlo sin rellamar a Claude.
- **search_history** — historial de las últimas 3 búsquedas por usuario (stack, experiencia, ubicaciones, modalidad, conteos de resultados).

### Favoritos y candidaturas
- **favorites** — lista de ofertas guardadas por el usuario.
- **applications** — registro de candidaturas con estado Kanban (guardada, en_proceso, entrevista, oferta, rechazada, descartada), notas libres y fecha de seguimiento (`follow_up_date`) para recordatorios.
- **match_feedback** — valoraciones up/down del usuario sobre los resultados de matching (para análisis de calidad del modelo).

### CV y mejoras
- **cv_analyses** — análisis de CVs subidos por el usuario (perfil estructurado extraído, tokens consumidos).
- **cv_ats_results** — resultados de análisis ATS (puntuación, feedback JSON, hash del texto del CV para deduplicar).
- **cv_improvements** — versiones mejoradas del CV (texto mejorado, JSON estructurado, puntuaciones antes/después, metadatos).
- **cv_edit_sessions** — sesiones de edición del CV por el usuario (JSON editable, log de acciones para contexto en futuras llamadas a Claude).
- **cv_offer_variants** — variantes del CV optimizadas para ofertas específicas (snapshot de la oferta, JSON del CV editado, log de acciones).

### Notificaciones y agente
- **notifications** — notificaciones en aplicación (título, mensaje, tipo, leída/no leída).
- **agent_runs** — ejecuciones del agente de empleo: instrucción original del usuario, instrucción interpretada, estado de la máquina de estados, resultados puntuados y acción confirmada.
- **match_feedback** — feedback del usuario sobre la utilidad del matching (señal para evaluación).

### Empresas
- **company_logos** — caché de logos y datos de empresa (Glassdoor rating/reviews, Indeed rating, LinkedIn URL). Se enriquece de forma asíncrona y se reutiliza en todas las búsquedas.

### Control de uso y sistema
- **ai_daily_usage** — uso diario de cuota de IA por usuario y tipo de feature.
- **ai_api_cost_events** — log detallado de cada llamada a la API de Claude.
- **rate_limit_buckets** — ventanas de rate limiting por clave (acción:IP o acción:usuario).
- **job_ingestion_runs** — historial de ejecuciones de la tarea de ingestión de ofertas (estado, conteos, tiempos).

### Cadena de migraciones Alembic

Las migraciones están ordenadas cronológicamente y cada una apunta a la anterior como `down_revision`. El sistema aplica automáticamente las pendientes al arrancar el servidor:

```
initial → add_idiomas → add_ubicaciones_modalidad → add_alias_nombre_apellidos
→ add_job_offers → add_favoritos_historial → add_security_and_quota
→ add_company_logos → add_applications → add_rating_cols
→ merge_heads → add_external_review_links → add_is_admin
→ add_blocking_fields → add_offer_signal_cache → add_ai_api_cost_events
→ add_analytics_consent → add_cv_analyses → add_cv_improve_count
→ cv_module_upgrade → cv_structured → cv_offer_variants
→ job_offer_source_metadata → job_ingestion_runs
→ add_alerts_and_feedback → add_stack_years → add_notifications
→ add_follow_up_date_to_applications  ← HEAD actual
```

---

## 8. API REST — Backend

El backend expone una API REST con 60+ endpoints organizados en routers por dominio. Se documenta automáticamente en `/docs` (Swagger UI) gracias a FastAPI.

### Resumen por router

**Autenticación (`/api/auth`):**
- Registro con validación Turnstile anti-bot
- Login con JWT de 30 días de vigencia
- Verificación de email con token de un solo uso
- Reenvío de email de verificación
- Renovación de token

**Usuario (`/api/user`):**
- Lectura y actualización del perfil profesional
- Consulta de cuota de IA (diaria, por feature)
- Cambio de contraseña y eliminación de cuenta
- Gestión de consentimiento de analítica

**Matching (`/api/match`):**
- Búsqueda con análisis de encaje (endpoint principal)
- Guardado y consulta de feedback sobre resultados
- Análisis de mercado laboral

**CV (`/api/cv`):**
- Upload y análisis de CV en PDF
- Generación de mejora completa (ATS + texto mejorado + JSON estructurado)
- Gestión de variantes por oferta
- Sesiones de edición y export a PDF
- Historial de mejoras del usuario

**Carta de presentación (`/api/cover-letter`):**
- Generación de carta personalizada

**Favoritos (`/api/favorites`):**
- Listar, añadir, eliminar favoritos

**Candidaturas (`/api/applications`):**
- CRUD de candidaturas con estado Kanban y fechas de seguimiento

**Historial (`/api/history`):**
- Guardar y consultar historial de búsquedas (máximo 3)

**Notificaciones (`/api/notifications`):**
- Listar, marcar leídas (individual y masivo)

**Agente (`/api/agent`):**
- Crear una ejecución del agente a partir de una instrucción en lenguaje natural
- Consultar el estado y los resultados puntuados de una ejecución
- Confirmar las ofertas seleccionadas (se guardan como favoritos)

**Administración (`/api/admin`):**
- Dashboard de métricas globales
- Gestión completa de usuarios (cuotas, bloqueos, eliminación)
- Seguimiento de costes de IA
- Control del índice de ofertas (salud, ingestión manual, limpieza de caché)

### Convenciones de la API

- Todos los endpoints requieren autenticación JWT salvo los de auth pública.
- Los errores siguen el formato `{"detail": "mensaje"}` de FastAPI.
- Rate limiting implementado a nivel de servidor (no de proxy): IP + usuario, con ventanas deslizantes almacenadas en `rate_limit_buckets`.
- Las respuestas de error 429 incluyen el header `Retry-After` cuando aplica.

---

## 9. Interfaz de usuario — Frontend

El frontend es una SPA construida con React 19 usando Create React App como base. No hay ningún framework de componentes externo: todo el diseño está implementado con CSS inline y constantes de tema definidas en `src/constants/theme.js`.

### Sistema de diseño

Se definieron constantes de diseño centralizadas que se usan en todos los componentes:

- **Colores principales:** `#7c3aed` (purple, acento primario), `#00758A` (teal, acento secundario), `#2563eb` (blue), `#10b981` (green), `#ef4444` (red).
- **Modo oscuro:** el estado `darkMode` se pasa por prop desde `App.jsx` hacia abajo en el árbol. Cada componente tiene variantes de color para modo claro y oscuro.
- **Tipografía:** familia `system-ui, -apple-system, sans-serif` con escala de tamaños definida en el tema.
- **Animaciones:** CSS keyframes para transiciones suaves, skeleton loaders (`sk-pulse`), y efectos hover en tarjetas y botones.

### Páginas principales

**Landing:** página pública con descripción del servicio, características y CTA de registro.

**Auth:** login y registro en la misma página con transición suave entre modos. Integra el widget de Turnstile (anti-bot de Cloudflare).

**Profile (Buscar ofertas):** la pantalla más compleja. Incluye:
- Panel de perfil colapsable con edición inline de stack, experiencia, idiomas, ubicaciones y modalidad.
- Sistema de filtros persistentes (localStorage) con múltiples dimensiones: resultado IA, keyword, ubicación, rango salarial, tipo contrato, modalidad, verificadas/directas/con salario/junior-friendly.
- Tabs de filtrado rápido por categoría (Aplica / Quizá / No encaja / Favoritas).
- Tarjetas de oferta en dos modos: detallada y compacta (toggle).
- Comparador de hasta 3 ofertas lado a lado en modal.
- Paginación progresiva ("Ver más") con `PAGE_SIZE = 15` para no renderizar todas las tarjetas a la vez.
- Botón de **exportar a CSV** que genera un archivo descargable con todas las ofertas filtradas actuales (título, empresa, ubicación, resultado IA, salario, modalidad, URL, fecha).
- Señales de confianza por oferta: fuente directa vs. agregador, salario visible, empresa verificada, oferta junior-friendly.
- Histórico de búsquedas previas con acceso a los resultados.
- Generación de carta de presentación por oferta.

**CVSearch:** upload de CV con drag-and-drop, análisis con resultados, editor de CV en modal, variantes por oferta, descarga PDF.

**Candidaturas:** vista de lista de candidaturas con edición inline de estado y notas. Cada candidatura permite establecer una `follow_up_date`. El sistema muestra badges de urgencia con código de color: rojo (vencida), ámbar (hoy o próximos 3 días), teal (próximos 7 días).

**Favoritos:** lista de ofertas guardadas con logos de empresa.

**Agente de empleo (AgentSearch):** página donde el usuario escribe una instrucción en lenguaje natural y sigue la ejecución del agente mediante una línea de tiempo de estados, revisa los resultados explicados y confirma cuáles guardar.

**Dashboard:** panel central de actividad con:
- **Skeleton loaders** mientras carga (sustituyen el spinner genérico con placeholders de la forma real del contenido).
- Métricas: total de candidaturas, búsquedas, favoritas, quota de IA restante.
- **Recordatorios de seguimiento:** muestra candidaturas con `follow_up_date` en los próximos 7 días o vencidas, con badges de urgencia y navegación directa.
- **Mini gráfico de tendencia:** barras verticales mostrando el porcentaje de resultados "APLICA" en cada búsqueda histórica, con código de color verde/ámbar/rojo.
- Análisis de mercado: skills más demandadas vs. perfil del usuario.

**UserProfile:** cambio de contraseña y eliminación de cuenta.

**Admin:** panel completo de administración con tabs por sección.

### Componentes reutilizables

- **ErrorBoundary:** clase React que captura errores de renderizado en cualquier subárbol, muestra una UI de fallback con opciones de reintentar o volver al inicio. Envuelve todas las páginas en `App.jsx`.
- **Navbar:** barra superior con logo, breadcrumb de navegación, toggle de modo oscuro, menú de usuario y campana de notificaciones.
- **Toast:** sistema de notificaciones efímeras (éxito, error, advertencia) con auto-dismiss.
- **CompanyLogo:** muestra el logo de empresa con fallback al icono genérico, enlaza a Glassdoor/LinkedIn.
- **OfferTrustSignals:** badges visuales de señales de confianza de la oferta.
- **CVEditorModal:** editor complejo de CV en modal, con previsualización, selección de plantilla y descarga PDF.
- **Onboarding:** flujo guiado de configuración del perfil para nuevos usuarios.
- **TurnstileWidget:** wrapper del CAPTCHA de Cloudflare.
- **ConsentBanner:** banner de consentimiento de analítica (GDPR).

### Gestión de errores de API en el cliente

El módulo `services/api.js` centraliza todas las llamadas al backend. Incluye `buildApiError()`, que transforma errores HTTP en objetos de error enriquecidos:

- **HTTP 429 (rate limit):** detecta el header `Retry-After`, construye un mensaje descriptivo en español indicando cuántos segundos esperar, y marca el error con `isRateLimit: true` para que el componente receptor pueda mostrar un feedback diferenciado.
- **HTTP 401/403:** redirige al login.
- **HTTP 502/503:** mensaje de servidor no disponible.

---

## 10. Seguridad y autenticación

### Sistema de autenticación

La autenticación es stateless basada en JWT:

1. **Registro:** el usuario envía email, contraseña y nombre. La contraseña se hashea con bcrypt antes de guardarse. El servidor envía un email de verificación con un token de un solo uso (se almacena solo el hash SHA256 del token, nunca el valor plano). La cuenta queda inactiva hasta que el email se verifique.

2. **Login:** el servidor valida email/contraseña, comprueba que el email esté verificado y que la cuenta no esté bloqueada, y emite un JWT firmado con HS256 (30 días de validez) que incluye el `user_id` en el payload.

3. **Autorización:** cada request protegido incluye el token en el header `Authorization: Bearer <token>`. La dependency `get_current_user_id()` de FastAPI valida la firma, la expiración y la existencia del usuario. Si el usuario está bloqueado, devuelve 403.

4. **Roles:** tres niveles de privilegio:
   - Usuario estándar: acceso a sus propios datos y funciones de IA.
   - Admin (`is_admin=True`): acceso al panel de administración.
   - Super admin (`is_super_admin=True`): cuota de IA ilimitada, sin panel de admin. Cuenta vinculada al email del autor.

### Anti-abuso y rate limiting

- **Registro:** Cloudflare Turnstile valida que el registro proviene de un humano (el token generado en el frontend se verifica en el backend contra la API de Cloudflare).
- **Rate limiting por IP:** límites distintos para registro (20/hora), login (12 intentos en 15min), reenvío de verificación (20/hora), búsquedas (40/hora), generación de cartas (25/hora).
- **Rate limiting por usuario:** para limitar abuso por cuenta: login (8 intentos en 15min), búsquedas (20/hora), cartas (12/hora).
- Las ventanas se almacenan en la base de datos (`rate_limit_buckets`), lo que permite persistir los límites entre reinicios del servidor.

### Otros aspectos de seguridad

- Los tokens de verificación de email se almacenan solo como hash; el valor original nunca queda en la base de datos.
- La eliminación de cuenta requiere confirmación con contraseña y el texto literal "ELIMINAR".
- El cambio de contraseña requiere validar la contraseña actual.
- Las contraseñas tienen un mínimo de 8 caracteres.
- Todos los endpoints del panel de administración requieren el flag `is_admin=True`; además, las operaciones destructivas (eliminar usuario) requieren un código de confirmación.

---

## 11. Sistema de cuotas de IA

Para controlar el coste de la API de Claude y prevenir uso abusivo, se implementó un sistema de cuotas:

**Cuota diaria:** cada usuario tiene una cuota de unidades de IA por día (por defecto 8, configurable individualmente desde el panel de admin). El contador se reinicia a medianoche.

**Consumo por acción:**
- Búsqueda de matching: 1 unidad
- Análisis de CV: 1 unidad
- Generación de carta: 1 unidad
- Mejora completa de CV: máximo 2 al día (contador independiente, no descuenta de la cuota general)

**Bypass para super admin:** el usuario con `is_super_admin=True` no consume cuota en ninguna acción.

**Feedback al usuario:** el frontend consulta el estado de la cuota (`GET /api/user/ai-quota`) y lo muestra en un widget compacto `QuotaCard`. Cuando la cuota se agota, los botones de acciones de IA se deshabilitan con un mensaje explicativo.

**Trazabilidad de costes:** cada llamada a Claude queda registrada en `ai_api_cost_events` con el número de tokens de entrada/salida y el coste estimado en USD. El panel de admin muestra el desglose acumulado total, por día, por feature y por usuario, lo que permite monitorizar el gasto real del servicio.

---

## 12. Fuentes externas de datos de empleo

### Adzuna API

Es la fuente principal. Adzuna es un agregador de ofertas con cobertura en España y API pública (requiere `app_id` y `app_key`). El sistema realiza búsquedas parametrizadas por habilidades y ubicaciones, normaliza los resultados al modelo interno `JobOffer` y los persiste en la base de datos. Las ofertas de más de 7 días se marcan como inactivas; las de más de 30 días se eliminan en la próxima ingestión.

### Portales ATS directos

Para las empresas que publican sus ofertas en plataformas como **Greenhouse**, **Ashby**, **Lever** o **Recruitee**, el sistema puede consultar sus APIs públicas directamente (sin necesidad de API key en muchos casos). Esto produce ofertas de fuente directa, que se distinguen visualmente como más fiables que las de agregadores.

### Ingestión en background

Cada 12 horas, una tarea asyncio realiza una pasada de actualización: busca nuevas ofertas en todas las fuentes configuradas, deduplicadas por `adzuna_id`, actualiza las existentes y marca como inactivas las que ya no aparecen. El historial de cada ejecución queda registrado en `job_ingestion_runs` con estado, conteos y tiempos.

### Señales de confianza de las ofertas

El sistema calcula señales de calidad para cada oferta que se muestran como badges en el frontend:
- **Fuente directa:** la oferta proviene de la web de la empresa (no de un agregador).
- **Verificada:** la URL de la oferta responde correctamente (comprobación HTTP).
- **Salario visible:** la oferta incluye rango salarial explícito.
- **Junior-friendly:** la descripción incluye términos asociados a posiciones de entrada.

---

## 13. Despliegue e infraestructura

### Plataforma

El proyecto se despliega en tres servicios gestionados, con auto-deploy en cada push a `master`:

- **Frontend → Vercel:** build `react-scripts build` (Create React App). URL pública: https://jobmatch-ia-alpha.vercel.app/
- **Backend → Render:** servicio Web (buildpack Python). La URL es pública y las migraciones de Alembic se ejecutan automáticamente al arrancar. El servidor escucha en el puerto que Render asigna (`$PORT`).
- **Base de datos → Supabase:** PostgreSQL gestionado.

### CI/CD

Existe un pipeline de integración continua con **GitHub Actions** que, en cada push y *pull request*, ejecuta para el backend los tests (pytest), el linter (ruff) y la evaluación offline del motor de matching; y para el frontend el linter (ESLint), los tests y el build de producción. Una vez en `master`, Vercel y Render hacen auto-deploy.

### Variables de entorno

Las variables sensibles se gestionan desde los paneles de Render (backend) y Vercel (frontend), nunca en el repositorio. Las más relevantes son:

```
# Backend
CLAUDE_API_KEY          → Clave de la API de Anthropic
ADZUNA_APP_ID           → ID de la app de Adzuna
ADZUNA_APP_KEY          → Clave de la API de Adzuna
DATABASE_URL            → URL de conexión a PostgreSQL (Supabase)
JWT_SECRET              → Secreto para firmar los JWT
TURNSTILE_SECRET_KEY    → Clave de validación de Cloudflare Turnstile
APP_FRONTEND_URL        → URL del frontend (para CORS y emails)
EMAIL_DELIVERY_MODE     → smtp | brevo | console
BOOTSTRAP_ADMIN_EMAIL   → Email del super admin inicial

# Frontend
REACT_APP_API_URL            → URL de la API del backend
REACT_APP_TURNSTILE_SITE_KEY → Site key pública de Turnstile
```

### PWA (Progressive Web App)

El frontend incluye un `manifest.json` con nombre, descripción, color de tema, atajos de navegación y configuración de pantalla completa. Esto permite instalarlo en el escritorio o pantalla de inicio de dispositivos móviles como si fuera una aplicación nativa.

---

## 14. Funcionalidades principales

A modo de resumen exhaustivo, estas son todas las funcionalidades implementadas en el sistema:

### Para el usuario

| Funcionalidad | Descripción |
|--------------|-------------|
| Matching de ofertas con IA | Búsqueda + análisis de encaje (APLICA/QUIZÁ/NO ENCAJA) con explicación |
| Perfil profesional | Stack, experiencia, idiomas, ubicaciones, modalidad |
| Filtros de resultados persistentes | Por resultado IA, keyword, ubicación, salario, contrato, modalidad, calidad |
| Comparador de ofertas | Comparación lado a lado de hasta 3 ofertas en modal |
| Exportar a CSV | Descarga del listado de ofertas filtradas en formato CSV con BOM UTF-8 |
| Paginación progresiva | "Ver más" de 15 en 15, sin recargar la página |
| Vista compacta / detallada | Toggle entre modos de visualización de tarjetas |
| Panel de perfil pre-análisis | Tarjeta visual con chips de stack, experiencia, ubicación y modalidad conectada al botón CTA |
| Análisis de CV | Upload de PDF, extracción con IA, perfil estructurado |
| Mejora de CV (ATS) | Optimización del CV para sistemas ATS con puntuación antes/después |
| Editor de CV | Modal interactivo para editar el CV estructurado |
| Variantes de CV por oferta | Versiones del CV orientadas a ofertas concretas |
| Descarga de CV en PDF | Exportación con plantillas professional_modern y ats_minimal |
| Carta de presentación | Generación automática personalizada por oferta |
| Simulación de entrevista con IA | Avatar animado CSS + voz del navegador (Web Speech) + reconocimiento de voz + feedback estructurado |
| Favoritos | Guardar y gestionar ofertas de interés con logos de empresa |
| Candidaturas (Kanban) | Tablero de seguimiento con estados, notas y fechas de seguimiento |
| Recordatorios de seguimiento | Badges de urgencia en Dashboard (vencida / próxima / futura) |
| Fecha de seguimiento en candidaturas | Campo `follow_up_date` con selector de fecha e indicadores visuales |
| Historial de búsquedas | Últimas 3 búsquedas con posibilidad de relanzarlas |
| Tendencia de encaje | Mini gráfico de barras de % APLICA por búsqueda histórica |
| Análisis de mercado | Skills más demandados vs. perfil del usuario |
| Agente de empleo con IA | Búsqueda en lenguaje natural con máquina de estados persistida y confirmación humana |
| Dashboard | Panel resumen con métricas, recordatorios y actividad reciente |
| Skeleton loaders | Placeholders animados mientras carga el contenido |
| Cuota de IA | Contador de usos diarios con widget visual |
| Modo oscuro | Toggle global con preferencias persistentes |
| Notificaciones in-app | Campana con listado y marcado de leídas |
| Verificación de email | Flujo completo de confirmación de cuenta |
| Cambio de contraseña | Con validación de contraseña actual |
| Eliminación de cuenta | Con confirmación doble y cascada completa de datos |
| Onboarding | Flujo guiado para nuevos usuarios |
| GDPR / consentimiento | Banner de analítica con aceptación/rechazo |
| PWA | Manifest para instalación como app nativa |
| ErrorBoundary | Captura de errores de renderizado con UI de fallback |
| Rate limit visual | Mensajes de espera con contador al recibir error 429 |

### Para el administrador

| Funcionalidad | Descripción |
|--------------|-------------|
| Dashboard de métricas | Usuarios, búsquedas, candidaturas, cuotas |
| Gestión de usuarios | Lista, búsqueda, ajuste de cuota, bloqueo/desbloqueo, eliminación |
| Seguimiento de costes IA | Por feature, modelo, usuario, día |
| Salud del índice de ofertas | Total de ofertas, frescura, fuentes, ubicaciones |
| Ingestión manual | Trigger de tarea de ingestión desde el panel |
| Limpieza de caché | Vaciado del caché de resultados de búsqueda |

---

## 15. Decisiones técnicas relevantes

**¿Por qué FastAPI y no Django?** FastAPI fue elegido por su velocidad de desarrollo, la generación automática de documentación OpenAPI, el soporte nativo para async/await (necesario para las tareas en background y las llamadas concurrentes a IA), y la tipificación con Pydantic que hace el código más seguro.

**¿Por qué React sin librerías de UI?** La decisión de usar solo CSS inline tiene un coste en tiempo pero un beneficio claro: control total del diseño, sin conflictos de versiones, sin sobrecarga de CSS no usado, y aprendizaje profundo de cómo funcionan los componentes bajo el capó.

**¿Por qué Claude Haiku para el matching y Sonnet para las cartas?** El matching requiere procesar lotes de 15-20 ofertas en una sola llamada, con respuesta estructurada en JSON. Haiku es 4x más barato y 2x más rápido que Sonnet. Para las cartas, el formato es más libre y el tono más importante, por lo que se justifica el modelo más capaz.

**¿Por qué caché en base de datos y no Redis?** Para este volumen de tráfico, una tabla PostgreSQL con `expires_at` es suficiente y elimina una dependencia de infraestructura adicional. El índice por `perfil_hash` hace la consulta de caché trivialmente rápida.

**¿Por qué versionar el motor de matching (`MATCH_ENGINE_VERSION`)?** El caché de resultados se genera con el hash del perfil **más el identificador de versión del motor**. Cuando se modifica el algoritmo de puntuación, el umbral de APLICA o la lógica de filtrado, incrementar la versión invalida automáticamente todos los resultados cacheados, forzando re-análisis con el nuevo motor. Esto evita que los usuarios vean resultados generados con criterios obsoletos. El motor pasó de `v3_description_depth` (sin filtros) → `v4_tech_filter` (pre-filtro + ghost-QUIZÁ) → `v5_calibration` (fix Go, umbral APLICA 73, SAP excluido) → `v6_zero_match` (zero-match post-filtro + boost seniority ≥4yr) → `v7_domain_filter` (data-domain mismatch post-filtro, detectado en batería masiva de 100 perfiles).

**¿Por qué almacenar el historial solo de las últimas 3 búsquedas?** El historial es fundamentalmente un elemento de UX (relanzar búsquedas recientes), no de analítica. 3 entradas es suficiente para el flujo habitual sin acumular datos innecesarios.

**¿Por qué migraciones manuales y no autogenerate?** En entornos donde el esquema de producción no siempre está sincronizado con los modelos, el autogenerate puede generar migraciones erróneas. Las migraciones manuales son más verbosas pero más predecibles y fáciles de auditar.

---

## 16. Conclusiones

JobMatch IA es un sistema completo, desplegado en producción, que demuestra la aplicación práctica de los LLMs a un problema real y cotidiano: la búsqueda de empleo en el sector tecnológico.

Los principales aprendizajes del desarrollo son:

- **Los LLMs son buenos en razonamiento contextual, no en extracción exacta.** El pipeline de matching requirió varias iteraciones del prompt para conseguir resultados consistentes y parseables. La combinación de prompt estructurado + validación post-respuesta es imprescindible en cualquier sistema que dependa de salida de IA.

- **El diseño del sistema de cuotas es crítico antes de exponer la API de IA.** Sin control de uso, el coste de la API puede dispararse. El sistema implementado permite dar una experiencia real a los usuarios con un presupuesto controlado.

- **La experiencia de usuario importa tanto como la IA.** Un sistema de matching preciso con una interfaz confusa o lenta no sirve. Gran parte del esfuerzo se dedicó a detalles de UX: skeleton loaders, mensajes de error descriptivos, modo oscuro, filtros persistentes, paginación progresiva.

- **Full-stack en solitario tiene un coste de contexto mental alto.** La gestión simultánea de backend, frontend, base de datos, infraestructura y prompts de IA en un proyecto unipersonal obliga a documentar bien y a mantener convenciones estrictas (el archivo `CLAUDE.md` en la raíz fue clave para mantener coherencia).

El sistema está en producción y es funcional. Puede extenderse con nuevas fuentes de empleo, nuevas features de IA o un sistema de recomendaciones basado en el historial de feedback. La arquitectura modular del backend facilita ese crecimiento sin refactorizaciones grandes.

---

*Memoria generada en mayo de 2026 para la presentación del TFM.*
