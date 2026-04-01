# -*- coding: utf-8 -*-
"""
Servicio para generación de PDF profesional a partir del texto de CV mejorado.
Usa fpdf2 (pure-Python, sin dependencias de sistema).

Formato esperado del improved_cv_text:
  NAME: ...
  TITLE: ...

  RESUMEN
  ...

  EXPERIENCIA
  Empresa | Cargo | Periodo
  - logro

  EDUCACIÓN
  Título | Centro | Año

  HABILIDADES
  Categoría: skills

  IDIOMAS
  Idioma: Nivel

  PROYECTOS                (opcional, solo si existen en el CV original)
  Nombre | https://...
  - descripción

  CERTIFICACIONES          (opcional, solo si existen en el CV original)
  Certificación (Año)
"""
import io
import re
from typing import Optional

# ── Colores ───────────────────────────────────────────────────────────────────
_PRIMARY = (37, 99, 235)
_DARK    = (15, 23, 42)
_GRAY    = (100, 116, 139)
_LIGHT   = (241, 245, 249)
_WHITE   = (255, 255, 255)
_LINK    = (37, 99, 235)

# ── Marcadores de sección → nombre canónico ───────────────────────────────────
# Soporta español (prioritario) e inglés (retrocompatibilidad).
# Las claves son el texto en MAYÚSCULAS tal como aparece en el CV mejorado.
_SECTION_MAP: dict[str, str] = {
    # Español
    "RESUMEN": "RESUMEN",
    "PERFIL": "RESUMEN",
    "PERFIL PROFESIONAL": "RESUMEN",
    "EXPERIENCIA": "EXPERIENCIA",
    "EXPERIENCIA PROFESIONAL": "EXPERIENCIA",
    "EXPERIENCIA LABORAL": "EXPERIENCIA",
    "EDUCACIÓN": "EDUCACIÓN",
    "EDUCACION": "EDUCACIÓN",
    "FORMACIÓN": "EDUCACIÓN",
    "FORMACION": "EDUCACIÓN",
    "ESTUDIOS": "EDUCACIÓN",
    "HABILIDADES": "HABILIDADES",
    "HABILIDADES TÉCNICAS": "HABILIDADES",
    "HABILIDADES TECNICAS": "HABILIDADES",
    "COMPETENCIAS": "HABILIDADES",
    "TECNOLOGÍAS": "HABILIDADES",
    "TECNOLOGIAS": "HABILIDADES",
    "IDIOMAS": "IDIOMAS",
    "LENGUAS": "IDIOMAS",
    "PROYECTOS": "PROYECTOS",
    "PROYECTOS PERSONALES": "PROYECTOS",
    "PROYECTOS DESTACADOS": "PROYECTOS",
    "CERTIFICACIONES": "CERTIFICACIONES",
    "CERTIFICADOS": "CERTIFICACIONES",
    "CURSOS": "CERTIFICACIONES",
    # Inglés (retrocompatibilidad)
    "SUMMARY": "RESUMEN",
    "PROFILE": "RESUMEN",
    "EXPERIENCE": "EXPERIENCIA",
    "EDUCATION": "EDUCACIÓN",
    "SKILLS": "HABILIDADES",
    "LANGUAGES": "IDIOMAS",
    "PROJECTS": "PROYECTOS",
    "CERTIFICATIONS": "CERTIFICACIONES",
}

_SECTION_DISPLAY: dict[str, str] = {
    "RESUMEN": "PERFIL PROFESIONAL",
    "EXPERIENCIA": "EXPERIENCIA PROFESIONAL",
    "EDUCACIÓN": "EDUCACIÓN",
    "HABILIDADES": "HABILIDADES TÉCNICAS",
    "IDIOMAS": "IDIOMAS",
    "PROYECTOS": "PROYECTOS",
    "CERTIFICACIONES": "CERTIFICACIONES",
}

_URL_RE = re.compile(
    r"https?://[^\s,;\"'<>)]+|"
    r"github\.com/[^\s,;\"'<>)]+|"
    r"gitlab\.com/[^\s,;\"'<>)]+|"
    r"linkedin\.com/[^\s,;\"'<>)]+"
)


def _safe_text(text: str) -> str:
    """
    Preserva ñ, tildes y todos los caracteres Latin-1 válidos.
    Solo sustituye los caracteres genuinamente fuera de Latin-1
    (bullets Unicode, comillas tipográficas, em-dashes, etc.).
    """
    replacements = {
        "\u2022": "-",    # bullet •
        "\u2023": "-",    # triangular bullet
        "\u25cf": "-",    # black circle ●
        "\u25aa": "-",    # small black square ▪
        "\u2013": "-",    # en dash –
        "\u2014": "-",    # em dash —
        "\u2018": "'",    "\u2019": "'",   # comillas curvas simples
        "\u201c": '"',    "\u201d": '"',   # comillas curvas dobles
        "\u2026": "...",  # ellipsis …
        "\u00b7": "-",    # middle dot ·
        "\u2192": "->",   # flecha →
        "\u2713": "v",    "\u2714": "v",   # check marks
        "\u200b": "",     # zero-width space
        "\u00a0": " ",    # non-breaking space
        "\u00ad": "",     # soft hyphen
    }
    for char, repl in replacements.items():
        text = text.replace(char, repl)
    # Codifica en Latin-1, reemplazando lo que quede fuera del rango
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _extract_url(text: str) -> tuple[str, Optional[str]]:
    """Extrae la primera URL del texto. Devuelve (texto_sin_url, url|None)."""
    m = _URL_RE.search(text)
    if not m:
        return text, None
    url = m.group(0).rstrip(".,;)")
    before = text[:m.start()].strip(" |·-")
    after  = text[m.end():].strip(" |·-")
    clean  = (before + (" " if before and after else "") + after).strip()
    return clean, url


def _parse_cv_text(text: str) -> dict:
    """Parsea el texto estructurado del CV en secciones."""
    lines = [l.rstrip() for l in text.splitlines()]
    result: dict = {"name": "", "title": "", "sections": []}

    current_section: Optional[str] = None
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        upper = stripped.upper()

        if upper.startswith("NAME:"):
            result["name"] = stripped[5:].strip()
            continue
        if upper.startswith("TITLE:"):
            result["title"] = stripped[6:].strip()
            continue

        canonical = _SECTION_MAP.get(upper)
        if canonical:
            if current_section is not None:
                result["sections"].append((current_section, current_lines))
            current_section = canonical
            current_lines = []
            continue

        if current_section is not None and stripped:
            current_lines.append(stripped)

    if current_section is not None:
        result["sections"].append((current_section, current_lines))

    return result


def generate_cv_pdf(improved_cv_text: str, candidate_name: str = "") -> bytes:
    """
    Genera un PDF profesional a partir del texto mejorado del CV.
    Devuelve los bytes del PDF.
    """
    try:
        from fpdf import FPDF
    except ImportError:
        raise RuntimeError("fpdf2 no está instalado. Añade 'fpdf2' a requirements.txt.")

    parsed = _parse_cv_text(improved_cv_text)
    display_name = _safe_text(parsed["name"] or candidate_name or "Candidato")

    class _CV(FPDF):
        def header(self):
            pass

        def footer(self):
            self.set_y(-10)
            self.set_font("Helvetica", "", 8)
            self.set_text_color(*_GRAY)
            self.cell(0, 5, f"Página {self.page_no()}", align="C")

    pdf = _CV(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.set_margins(18, 18, 18)

    w = pdf.w - 36  # ancho útil

    # ── Cabecera: nombre y título ─────────────────────────────────────────────
    pdf.set_fill_color(*_PRIMARY)
    pdf.rect(0, 0, pdf.w, 38, "F")

    pdf.set_xy(18, 10)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_WHITE)
    pdf.cell(w, 10, display_name, ln=True)

    if parsed["title"]:
        pdf.set_x(18)
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(200, 220, 255)
        pdf.cell(w, 7, _safe_text(parsed["title"]), ln=True)

    pdf.ln(12)

    # ── Secciones ─────────────────────────────────────────────────────────────
    for section_name, section_lines in parsed["sections"]:
        if not section_lines:
            continue

        label = _safe_text(_SECTION_DISPLAY.get(section_name, section_name))

        # Cabecera de sección
        pdf.set_fill_color(*_LIGHT)
        pdf.set_x(18)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_PRIMARY)
        pdf.cell(w, 7, label, ln=True, fill=True)
        pdf.set_draw_color(*_PRIMARY)
        pdf.set_line_width(0.5)
        pdf.line(18, pdf.get_y(), 18 + w, pdf.get_y())
        pdf.ln(3)

        pdf.set_text_color(*_DARK)

        for raw_line in section_lines:
            line = _safe_text(raw_line)
            if not line.strip():
                pdf.ln(2)
                continue

            is_bullet = line.startswith(("-", "•", "*", "+"))

            # ── EXPERIENCIA: línea empresa | cargo | periodo ──────────────────
            if section_name == "EXPERIENCIA" and " | " in line and not is_bullet:
                parts = line.split(" | ")
                company = parts[0].strip()
                rest = " | ".join(parts[1:]).strip() if len(parts) > 1 else ""
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(*_DARK)
                cw = min(pdf.get_string_width(company + "  "), w * 0.55)
                pdf.cell(cw, 6, company)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 6, rest, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # ── EDUCACIÓN: título | centro | año ─────────────────────────────
            if section_name == "EDUCACIÓN" and " | " in line and not is_bullet:
                parts = line.split(" | ")
                degree = parts[0].strip()
                rest = " · ".join(p.strip() for p in parts[1:])
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(*_DARK)
                dw = min(pdf.get_string_width(degree + "  "), w * 0.65)
                pdf.cell(dw, 6, degree)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 6, rest, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # ── HABILIDADES: Categoría: lista ────────────────────────────────
            if section_name == "HABILIDADES" and ":" in line and not is_bullet:
                idx = line.index(":")
                category = line[:idx].strip()
                values = line[idx + 1:].strip()
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(*_PRIMARY)
                cw2 = min(pdf.get_string_width(category + ":  "), w * 0.35)
                pdf.cell(cw2, 5.5, f"{category}:")
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_DARK)
                pdf.multi_cell(w - cw2, 5.5, values)
                continue

            # ── IDIOMAS: Idioma: Nivel ────────────────────────────────────────
            if section_name == "IDIOMAS" and ":" in line and not is_bullet:
                idx = line.index(":")
                lang = line[:idx].strip()
                level = line[idx + 1:].strip()
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(*_DARK)
                lw = min(pdf.get_string_width(lang + ":  "), w * 0.35)
                pdf.cell(lw, 5.5, f"{lang}:")
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 5.5, level, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # ── PROYECTOS: nombre | URL, con enlace visible ───────────────────
            if section_name == "PROYECTOS" and not is_bullet:
                clean_line, url = _extract_url(_safe_text(raw_line))
                clean_line = _safe_text(clean_line)
                # Título del proyecto (puede tener | para separar descripción breve)
                if " | " in clean_line:
                    parts = clean_line.split(" | ", 1)
                    proj_name = parts[0].strip()
                else:
                    proj_name = clean_line.strip()

                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(*_DARK)
                pdf.cell(0, 6, proj_name, ln=True)

                if url:
                    url_display = _safe_text(
                        url.replace("https://", "").replace("http://", "").rstrip("/")
                    )
                    pdf.set_x(20)
                    pdf.set_font("Helvetica", "I", 8.5)
                    pdf.set_text_color(*_LINK)
                    pdf.cell(0, 4.5, url_display, ln=True, link=url)
                    pdf.set_text_color(*_DARK)
                continue

            # ── Bullet genérico (todas las secciones) ────────────────────────
            if is_bullet:
                bullet_text = line.lstrip("-•*+ ").strip()
                pdf.set_x(23)
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_DARK)
                pdf.multi_cell(w - 5, 5.5, f"- {bullet_text}")
                continue

            # ── Texto genérico ────────────────────────────────────────────────
            pdf.set_x(18)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w, 5.5, line)

        pdf.ln(4)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def _prep_cv_data(cv_json: dict, candidate_name: str = "") -> dict:
    """Prepara y filtra las secciones del CV, eliminando entradas sin contenido útil.

    Garantiza que las comprobaciones if section: reflejen si hay algo que renderizar.
    """
    personal = cv_json.get("personal") or {}
    hidden_sections = set((cv_json.get("meta") or {}).get("hidden_sections") or [])
    return {
        "name":  _safe_text(personal.get("name") or candidate_name or "Candidato"),
        "title": _safe_text(personal.get("title") or ""),
        "summary": "" if "summary" in hidden_sections else (cv_json.get("summary") or "").strip(),
        "experience": [] if "experience" in hidden_sections else [
            e for e in (cv_json.get("experience") or [])
            if (e.get("company") or "").strip() or (e.get("role") or "").strip()
        ],
        "education": [] if "education" in hidden_sections else [
            e for e in (cv_json.get("education") or [])
            if (e.get("degree") or "").strip() or (e.get("institution") or "").strip()
        ],
        "skills": [] if "skills" in hidden_sections else [
            sg for sg in (cv_json.get("skills") or [])
            if any(str(i or "").strip() for i in (sg.get("items") or []))
        ],
        "languages": [] if "languages" in hidden_sections else [
            l for l in (cv_json.get("languages") or [])
            if (l.get("language") or "").strip()
        ],
        "projects": [] if "projects" in hidden_sections else [
            p for p in (cv_json.get("projects") or [])
            if (p.get("name") or "").strip()
        ],
        "certifications": [] if "certifications" in hidden_sections else [
            c for c in (cv_json.get("certifications") or [])
            if (c.get("name") or "").strip()
        ],
    }


def _build_pdf_class():
    """Devuelve una subclase de FPDF con header/footer estándar."""
    try:
        from fpdf import FPDF
    except ImportError:
        raise RuntimeError("fpdf2 no está instalado. Añade 'fpdf2' a requirements.txt.")

    class _CV(FPDF):
        def header(self):
            pass

        def footer(self):
            self.set_y(-10)
            self.set_font("Helvetica", "", 8)
            self.set_text_color(*_GRAY)
            self.cell(0, 5, f"Página {self.page_no()}", align="C")

    return _CV


def _pdf_professional_modern(cv_json: dict, candidate_name: str = "") -> bytes:
    """Plantilla 'Professional Modern': cabecera azul, secciones con fondo claro."""
    d = _prep_cv_data(cv_json, candidate_name)
    _CV = _build_pdf_class()

    pdf = _CV(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_margins(16, 16, 16)
    w = pdf.w - 32

    # ── Cabecera azul ─────────────────────────────────────────────────────────
    pdf.set_fill_color(*_PRIMARY)
    pdf.rect(0, 0, pdf.w, 34, "F")
    pdf.set_xy(16, 8)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_WHITE)
    pdf.cell(w, 10, d["name"], ln=True)
    if d["title"]:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(200, 220, 255)
        pdf.cell(w, 6, d["title"], ln=True)
    pdf.ln(9)

    def _section_header(label: str) -> None:
        pdf.set_fill_color(*_LIGHT)
        pdf.set_x(16)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_PRIMARY)
        pdf.cell(w, 6, _safe_text(label), ln=True, fill=True)
        pdf.set_draw_color(*_PRIMARY)
        pdf.set_line_width(0.5)
        pdf.line(16, pdf.get_y(), 16 + w, pdf.get_y())
        pdf.ln(2)
        pdf.set_text_color(*_DARK)

    def _render_bullets(bullets: list) -> None:
        for b in bullets:
            text = _safe_text(str(b).strip())
            if not text:
                continue
            pdf.set_x(23)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w - 5, 5.5, f"- {text}")

    if d["summary"]:
        _section_header("PERFIL PROFESIONAL")
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*_DARK)
        pdf.multi_cell(w, 5.0, _safe_text(d["summary"]))
        pdf.ln(3)

    if d["experience"]:
        _section_header("EXPERIENCIA PROFESIONAL")
        for exp in d["experience"]:
            company  = _safe_text((exp.get("company") or "").strip())
            role     = _safe_text((exp.get("role") or "").strip())
            period   = _safe_text((exp.get("period") or "").strip())
            location = _safe_text((exp.get("location") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_DARK)
            cw = min(pdf.get_string_width(company + "  "), w * 0.6)
            pdf.cell(cw, 6, company)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_GRAY)
            period_loc = " · ".join(p for p in [period, location] if p)
            pdf.cell(0, 6, period_loc, ln=True)
            if role:
                pdf.set_x(18)
                pdf.set_font("Helvetica", "I", 9.5)
                pdf.set_text_color(*_DARK)
                pdf.cell(0, 5.5, role, ln=True)
            _render_bullets(exp.get("bullets") or [])
            pdf.ln(2)
        pdf.ln(2)

    if d["education"]:
        _section_header("EDUCACIÓN")
        for edu in d["education"]:
            degree      = _safe_text((edu.get("degree") or "").strip())
            institution = _safe_text((edu.get("institution") or "").strip())
            year        = _safe_text((edu.get("year") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_DARK)
            dw = min(pdf.get_string_width(degree + "  "), w * 0.65)
            pdf.cell(dw, 6, degree)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_GRAY)
            pdf.cell(0, 6, " · ".join(p for p in [institution, year] if p), ln=True)
            pdf.set_text_color(*_DARK)
            pdf.ln(1)
        pdf.ln(3)

    if d["skills"]:
        _section_header("HABILIDADES TÉCNICAS")
        for sg in d["skills"]:
            category = _safe_text((sg.get("category") or "").strip())
            values   = _safe_text(", ".join(str(i).strip() for i in (sg.get("items") or []) if i))
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_PRIMARY)
            cat_label = f"{category}:" if category else ""
            cw2 = min(pdf.get_string_width(cat_label + "  "), w * 0.35) if cat_label else 0
            if cat_label:
                pdf.cell(cw2, 5.5, cat_label)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w - cw2, 5.5, values)
        pdf.ln(3)

    if d["languages"]:
        _section_header("IDIOMAS")
        for lang_entry in d["languages"]:
            lang  = _safe_text((lang_entry.get("language") or "").strip())
            level = _safe_text((lang_entry.get("level") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_DARK)
            lw = min(pdf.get_string_width(lang + ":  "), w * 0.35)
            pdf.cell(lw, 5.5, f"{lang}:")
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_GRAY)
            pdf.cell(0, 5.5, level, ln=True)
            pdf.set_text_color(*_DARK)
        pdf.ln(3)

    if d["projects"]:
        _section_header("PROYECTOS")
        for proj in d["projects"]:
            name    = _safe_text((proj.get("name") or "").strip())
            url     = (proj.get("url") or "").strip()
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_DARK)
            pdf.cell(0, 6, name, ln=True)
            if url:
                url_display = _safe_text(url.replace("https://", "").replace("http://", "").rstrip("/"))
                pdf.set_x(20)
                pdf.set_font("Helvetica", "I", 8.5)
                pdf.set_text_color(*_LINK)
                pdf.cell(0, 4.5, url_display, ln=True, link=url)
                pdf.set_text_color(*_DARK)
            _render_bullets(proj.get("bullets") or [])
            pdf.ln(2)
        pdf.ln(2)

    if d["certifications"]:
        _section_header("CERTIFICACIONES")
        for cert in d["certifications"]:
            name  = _safe_text((cert.get("name") or "").strip())
            year  = _safe_text((cert.get("year") or "").strip())
            label = f"{name} ({year})" if year else name
            pdf.set_x(18)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.cell(0, 5.5, label, ln=True)
        pdf.ln(3)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def _pdf_ats_minimal(cv_json: dict, candidate_name: str = "") -> bytes:
    """Plantilla 'ATS Minimal': limpia, sin adornos, máxima compatibilidad ATS."""
    d = _prep_cv_data(cv_json, candidate_name)
    _CV = _build_pdf_class()

    pdf = _CV(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_margins(16, 16, 16)
    w = pdf.w - 32

    # ── Cabecera simple (sin colores) ─────────────────────────────────────────
    pdf.set_xy(16, 12)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_DARK)
    pdf.cell(w, 10, d["name"], ln=True)
    if d["title"]:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(*_GRAY)
        pdf.cell(w, 6, d["title"], ln=True)
    # Línea separadora bajo el encabezado
    pdf.set_draw_color(*_DARK)
    pdf.set_line_width(0.6)
    pdf.line(16, pdf.get_y() + 1.5, 16 + w, pdf.get_y() + 1.5)
    pdf.ln(6)

    def _section_header(label: str) -> None:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_DARK)
        pdf.cell(w, 6, _safe_text(label), ln=True)
        pdf.set_draw_color(*_GRAY)
        pdf.set_line_width(0.3)
        pdf.line(16, pdf.get_y(), 16 + w, pdf.get_y())
        pdf.ln(2)
        pdf.set_text_color(*_DARK)

    def _render_bullets(bullets: list) -> None:
        for b in bullets:
            text = _safe_text(str(b).strip())
            if not text:
                continue
            pdf.set_x(23)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w - 5, 5.5, f"- {text}")

    if d["summary"]:
        _section_header("PERFIL PROFESIONAL")
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*_DARK)
        pdf.multi_cell(w, 5.0, _safe_text(d["summary"]))
        pdf.ln(3)

    if d["experience"]:
        _section_header("EXPERIENCIA PROFESIONAL")
        for exp in d["experience"]:
            company  = _safe_text((exp.get("company") or "").strip())
            role     = _safe_text((exp.get("role") or "").strip())
            period   = _safe_text((exp.get("period") or "").strip())
            location = _safe_text((exp.get("location") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_DARK)
            cw = min(pdf.get_string_width(company + "  "), w * 0.65)
            pdf.cell(cw, 6, company)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_GRAY)
            period_loc = " · ".join(p for p in [period, location] if p)
            pdf.cell(0, 6, period_loc, ln=True)
            if role:
                pdf.set_x(18)
                pdf.set_font("Helvetica", "I", 9.5)
                pdf.set_text_color(*_DARK)
                pdf.cell(0, 5.5, role, ln=True)
            _render_bullets(exp.get("bullets") or [])
            pdf.ln(2)
        pdf.ln(2)

    if d["education"]:
        _section_header("EDUCACIÓN")
        for edu in d["education"]:
            degree      = _safe_text((edu.get("degree") or "").strip())
            institution = _safe_text((edu.get("institution") or "").strip())
            year        = _safe_text((edu.get("year") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_DARK)
            dw = min(pdf.get_string_width(degree + "  "), w * 0.65)
            pdf.cell(dw, 6, degree)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_GRAY)
            pdf.cell(0, 6, " · ".join(p for p in [institution, year] if p), ln=True)
            pdf.set_text_color(*_DARK)
            pdf.ln(1)
        pdf.ln(3)

    if d["skills"]:
        _section_header("HABILIDADES TÉCNICAS")
        for sg in d["skills"]:
            category = _safe_text((sg.get("category") or "").strip())
            values   = _safe_text(", ".join(str(i).strip() for i in (sg.get("items") or []) if i))
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_DARK)
            cat_label = f"{category}:" if category else ""
            cw2 = min(pdf.get_string_width(cat_label + "  "), w * 0.35) if cat_label else 0
            if cat_label:
                pdf.cell(cw2, 5.5, cat_label)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w - cw2, 5.5, values)
        pdf.ln(3)

    if d["languages"]:
        _section_header("IDIOMAS")
        for lang_entry in d["languages"]:
            lang  = _safe_text((lang_entry.get("language") or "").strip())
            level = _safe_text((lang_entry.get("level") or "").strip())
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*_DARK)
            lw = min(pdf.get_string_width(lang + ":  "), w * 0.35)
            pdf.cell(lw, 5.5, f"{lang}:")
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_GRAY)
            pdf.cell(0, 5.5, level, ln=True)
            pdf.set_text_color(*_DARK)
        pdf.ln(3)

    if d["projects"]:
        _section_header("PROYECTOS")
        for proj in d["projects"]:
            name    = _safe_text((proj.get("name") or "").strip())
            url     = (proj.get("url") or "").strip()
            pdf.set_x(18)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_DARK)
            pdf.cell(0, 6, name, ln=True)
            if url:
                url_display = _safe_text(url.replace("https://", "").replace("http://", "").rstrip("/"))
                pdf.set_x(20)
                pdf.set_font("Helvetica", "I", 8.5)
                pdf.set_text_color(*_DARK)
                pdf.cell(0, 4.5, url_display, ln=True, link=url)
            _render_bullets(proj.get("bullets") or [])
            pdf.ln(2)
        pdf.ln(2)

    if d["certifications"]:
        _section_header("CERTIFICACIONES")
        for cert in d["certifications"]:
            name  = _safe_text((cert.get("name") or "").strip())
            year  = _safe_text((cert.get("year") or "").strip())
            label = f"{name} ({year})" if year else name
            pdf.set_x(18)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.cell(0, 5.5, label, ln=True)
        pdf.ln(3)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def generate_cv_pdf_from_json(
    cv_json: dict,
    candidate_name: str = "",
    template: str = "professional_modern",
) -> bytes:
    """
    Genera un PDF directamente desde el JSON canónico del CV.

    template:
      "professional_modern" (por defecto) — cabecera azul, secciones con fondo
      "ats_minimal"                       — diseño limpio sin adornos, máx. ATS

    No hace parsing de strings — elimina el riesgo de mezcla de experiencias.
    Las secciones vacías (entradas sin nombre/empresa) no se renderizan.
    """
    if template == "ats_minimal":
        return _pdf_ats_minimal(cv_json, candidate_name)
    return _pdf_professional_modern(cv_json, candidate_name)
