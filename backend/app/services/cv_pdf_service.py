# -*- coding: utf-8 -*-
"""
Servicio para generación de PDF profesional a partir del texto de CV mejorado.
Usa fpdf2 (pure-Python, sin dependencias de sistema).

Formato esperado del improved_cv_text:
  NAME: ...
  TITLE: ...

  SUMMARY
  ...

  EXPERIENCE
  Empresa | Cargo | Periodo
  • logro

  EDUCATION
  Título | Centro | Año

  SKILLS
  Categoría: skills

  LANGUAGES
  Idioma: Nivel

  CERTIFICATIONS
  ...
"""
import io
import re
from typing import Optional

# ── Colores de la paleta ──────────────────────────────────────────────────────
_PRIMARY = (37, 99, 235)    # Azul JobMatch
_DARK    = (15, 23, 42)     # Casi negro
_GRAY    = (100, 116, 139)  # Gris medio
_LIGHT   = (241, 245, 249)  # Fondo secciones
_GREEN   = (16, 185, 129)   # Acento verde
_WHITE   = (255, 255, 255)

# ── Secciones que reconocemos en el texto ────────────────────────────────────
_SECTION_MARKERS = ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES", "CERTIFICATIONS"]


def _parse_cv_text(text: str) -> dict:
    """Parsea el texto estructurado del CV en secciones."""
    lines = [l.rstrip() for l in text.splitlines()]

    result = {
        "name": "",
        "title": "",
        "sections": [],  # [(section_name, [lines])]
    }

    current_section: Optional[str] = None
    current_lines: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.upper().startswith("NAME:"):
            result["name"] = stripped[5:].strip()
            i += 1
            continue

        if stripped.upper().startswith("TITLE:"):
            result["title"] = stripped[6:].strip()
            i += 1
            continue

        if stripped.upper() in _SECTION_MARKERS:
            if current_section is not None:
                result["sections"].append((current_section, current_lines))
            current_section = stripped.upper()
            current_lines = []
            i += 1
            continue

        if current_section is not None and stripped:
            current_lines.append(stripped)
        elif current_section is None and stripped and result["name"]:
            # Texto suelto antes de primera sección
            pass

        i += 1

    if current_section is not None:
        result["sections"].append((current_section, current_lines))

    return result


def _to_latin1(text: str) -> str:
    """Convierte caracteres Unicode no-Latin-1 a equivalentes seguros."""
    replacements = {
        "\u2022": "-",  # bullet •
        "\u2013": "-",  # en dash –
        "\u2014": "-",  # em dash —
        "\u2018": "'",  "\u2019": "'",  # comillas curvas
        "\u201c": '"',  "\u201d": '"',
        "\u2026": "...",  # ellipsis
        "\u00e9": "e", "\u00e1": "a", "\u00ed": "i", "\u00f3": "o", "\u00fa": "u",
        "\u00e0": "a", "\u00e8": "e", "\u00ec": "i", "\u00f2": "o", "\u00f9": "u",
        "\u00fc": "u", "\u00f6": "o", "\u00e4": "a", "\u00eb": "e",
        "\u00c9": "E", "\u00c1": "A", "\u00cd": "I", "\u00d3": "O", "\u00da": "U",
        "\u00f1": "n", "\u00d1": "N",
        "\u00bf": "?", "\u00a1": "!",
    }
    for char, repl in replacements.items():
        text = text.replace(char, repl)
    # Fallback: encode latin-1 ignorando el resto
    return text.encode("latin-1", errors="replace").decode("latin-1")


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
    display_name = _to_latin1(parsed["name"] or candidate_name or "Candidato/a")

    class _CV(FPDF):
        def header(self):
            pass
        def footer(self):
            self.set_y(-12)
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(*_GRAY)
            self.cell(0, 6, f"Generado con JobMatch IA  ·  {display_name}", align="C")

    pdf = _CV(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
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
        pdf.cell(w, 7, _to_latin1(parsed["title"]), ln=True)

    pdf.ln(12)

    # ── Secciones ─────────────────────────────────────────────────────────────
    SECTION_LABELS = {
        "SUMMARY": "RESUMEN PROFESIONAL",
        "EXPERIENCE": "EXPERIENCIA PROFESIONAL",
        "EDUCATION": "EDUCACIÓN",
        "SKILLS": "HABILIDADES TÉCNICAS",
        "LANGUAGES": "IDIOMAS",
        "CERTIFICATIONS": "CERTIFICACIONES",
    }

    for section_name, section_lines in parsed["sections"]:
        if not section_lines:
            continue

        # Título de sección
        pdf.set_fill_color(*_LIGHT)
        pdf.set_x(18)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_PRIMARY)
        label = SECTION_LABELS.get(section_name, section_name)
        pdf.cell(w, 7, label, ln=True, fill=True)
        # Línea de acento
        pdf.set_draw_color(*_PRIMARY)
        pdf.set_line_width(0.6)
        pdf.line(18, pdf.get_y(), 18 + w, pdf.get_y())
        pdf.ln(3)

        pdf.set_text_color(*_DARK)

        for raw_line in section_lines:
            line = _to_latin1(raw_line)
            if not line.strip():
                pdf.ln(2)
                continue

            # Detecta línea de empresa/cargo (contiene " | ")
            if " | " in line and section_name == "EXPERIENCE":
                parts = line.split(" | ")
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(*_DARK)
                company = parts[0] if len(parts) > 0 else ""
                role_period = " | ".join(parts[1:]) if len(parts) > 1 else ""
                # Empresa en negrita, resto en gris
                cw = pdf.get_string_width(company + "  ")
                pdf.cell(min(cw, w * 0.55), 6, company)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 6, role_period, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # Bullet point
            if line.startswith("•") or line.startswith("-"):
                pdf.set_x(22)
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_DARK)
                bullet_text = line.lstrip("•- ").strip()
                pdf.multi_cell(w - 4, 5.5, f"  - {bullet_text}")
                continue

            # Línea de educación ( | separado)
            if " | " in line and section_name == "EDUCATION":
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                parts = line.split(" | ")
                degree = parts[0]
                rest = " · ".join(parts[1:])
                dw = pdf.get_string_width(degree + "  ")
                pdf.cell(min(dw, w * 0.6), 6, degree)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 6, rest, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # Línea de Skills (Categoría: valores)
            if ":" in line and section_name == "SKILLS":
                colon_idx = line.index(":")
                category = line[:colon_idx].strip()
                values = line[colon_idx + 1:].strip()
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(*_PRIMARY)
                cw2 = pdf.get_string_width(category + ":  ")
                pdf.cell(min(cw2, w * 0.3), 5.5, f"{category}:")
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_DARK)
                pdf.multi_cell(w - min(cw2, w * 0.3), 5.5, values)
                continue

            # Línea de idioma (Idioma: Nivel)
            if ":" in line and section_name == "LANGUAGES":
                colon_idx = line.index(":")
                lang = line[:colon_idx].strip()
                level = line[colon_idx + 1:].strip()
                pdf.set_x(18)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(*_DARK)
                lw = pdf.get_string_width(lang + ":  ")
                pdf.cell(min(lw, w * 0.35), 5.5, f"{lang}:")
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(*_GRAY)
                pdf.cell(0, 5.5, level, ln=True)
                pdf.set_text_color(*_DARK)
                continue

            # Texto genérico (summary, certifications, etc.)
            pdf.set_x(18)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(w, 5.5, line)

        pdf.ln(5)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
