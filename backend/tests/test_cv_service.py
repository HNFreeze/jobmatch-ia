# -*- coding: utf-8 -*-
"""
Tests para el servicio de análisis de CV.
Cubre: validación de archivos, extracción de texto, parseo de IA (mockeado)
y conversión de perfil estructurado al formato de matching.
"""
import io
import json
from unittest.mock import AsyncMock, MagicMock

import pytest


# ---------------------------------------------------------------------------
# Helpers para generar PDFs mínimos en tests
# ---------------------------------------------------------------------------

def _make_minimal_pdf() -> bytes:
    """Genera un PDF mínimo (sin texto) usando pypdf."""
    from pypdf import PdfWriter
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    writer.add_page(page)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _make_fake_upload(filename: str, content_type: str, content: bytes):
    """Crea un mock de UploadFile de FastAPI."""
    upload = MagicMock()
    upload.filename = filename
    upload.content_type = content_type
    upload.read = AsyncMock(return_value=content)
    return upload


# ---------------------------------------------------------------------------
# Tests: validación del fichero
# ---------------------------------------------------------------------------

class TestValidateCvUpload:
    def test_pdf_accepted(self):
        from app.services.cv_service import validate_cv_upload
        upload = _make_fake_upload("cv.pdf", "application/pdf", b"%PDF-1.4")
        validate_cv_upload(upload)  # No debe lanzar

    def test_non_pdf_rejected(self):
        from fastapi import HTTPException
        from app.services.cv_service import validate_cv_upload
        upload = _make_fake_upload("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"PK")
        with pytest.raises(HTTPException) as exc_info:
            validate_cv_upload(upload)
        assert exc_info.value.status_code == 400

    def test_wrong_extension_rejected(self):
        from fastapi import HTTPException
        from app.services.cv_service import validate_cv_upload
        upload = _make_fake_upload("cv.exe", "application/pdf", b"%PDF")
        with pytest.raises(HTTPException) as exc_info:
            validate_cv_upload(upload)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_file_rejected(self):
        from fastapi import HTTPException
        from app.services.cv_service import read_and_validate_content
        upload = _make_fake_upload("cv.pdf", "application/pdf", b"")
        with pytest.raises(HTTPException) as exc_info:
            await read_and_validate_content(upload)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_oversized_file_rejected(self):
        from fastapi import HTTPException
        from app.services.cv_service import read_and_validate_content, MAX_FILE_SIZE_BYTES
        big_content = b"%PDF" + b"x" * (MAX_FILE_SIZE_BYTES + 1)
        upload = _make_fake_upload("cv.pdf", "application/pdf", big_content)
        with pytest.raises(HTTPException) as exc_info:
            await read_and_validate_content(upload)
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# Tests: extracción de texto PDF
# ---------------------------------------------------------------------------

class TestExtractTextFromPdf:
    def test_non_pdf_bytes_rejected(self):
        from fastapi import HTTPException
        from app.services.cv_service import extract_text_from_pdf
        with pytest.raises(HTTPException) as exc_info:
            extract_text_from_pdf(b"esto no es un pdf")
        assert exc_info.value.status_code == 422

    def test_valid_pdf_extracts_text(self):
        """Crea un PDF real con pypdf+reportlab y verifica que se puede leer."""
        rlcanvas = pytest.importorskip("reportlab.pdfgen.canvas", reason="reportlab no instalado")

        buf = io.BytesIO()
        c = rlcanvas.Canvas(buf)
        c.drawString(100, 750, "Python Developer with 5 years of experience")
        c.save()
        pdf_bytes = buf.getvalue()

        from app.services.cv_service import extract_text_from_pdf
        text = extract_text_from_pdf(pdf_bytes)
        assert "Python" in text or len(text) > 0


# ---------------------------------------------------------------------------
# Tests: parseo de respuesta de IA (sanitización)
# ---------------------------------------------------------------------------

class TestSanitizeStructuredProfile:
    def _sanitize(self, raw):
        from app.services.cv_service import _sanitize_structured_profile
        return _sanitize_structured_profile(raw)

    def test_full_profile_passes_through(self):
        raw = {
            "full_name": "Ana García",
            "target_roles": ["Backend Developer", "Python Developer"],
            "seniority": "mid",
            "years_experience": 4,
            "skills": ["Python", "FastAPI", "Docker"],
            "languages": [{"language": "Español", "level": "nativo"}],
            "education": [{"degree": "Informática", "institution": "UPM", "year": 2019}],
            "certifications": ["AWS SAA"],
            "preferred_locations": ["Madrid"],
            "work_modalities": ["Remoto"],
            "summary": "Backend dev especializado en Python",
        }
        result = self._sanitize(raw)
        assert result["full_name"] == "Ana García"
        assert result["seniority"] == "mid"
        assert result["years_experience"] == 4
        assert "Python" in result["skills"]

    def test_missing_fields_get_defaults(self):
        result = self._sanitize({})
        assert result["seniority"] == "desconocido"
        assert result["years_experience"] is None
        assert result["skills"] == []
        assert result["target_roles"] == []

    def test_invalid_seniority_becomes_desconocido(self):
        result = self._sanitize({"seniority": "wizard"})
        assert result["seniority"] == "desconocido"

    def test_years_as_string_parsed(self):
        result = self._sanitize({"years_experience": "5 years"})
        assert result["years_experience"] == 5

    def test_skills_capped_at_30(self):
        raw = {"skills": [f"skill{i}" for i in range(50)]}
        result = self._sanitize(raw)
        assert len(result["skills"]) == 30


# ---------------------------------------------------------------------------
# Tests: conversión a perfil de matching
# ---------------------------------------------------------------------------

class TestBuildMatchingProfile:
    def _build(self, profile):
        from app.services.cv_service import build_matching_profile
        return build_matching_profile(profile)

    def test_years_become_experience_string(self):
        p = self._build({"years_experience": 4, "skills": ["Python"], "languages": [], "preferred_locations": [], "work_modalities": [], "seniority": "mid"})
        assert p["experience"] == "4"

    def test_seniority_fallback_when_no_years(self):
        p = self._build({"years_experience": None, "skills": [], "languages": [], "preferred_locations": [], "work_modalities": [], "seniority": "senior"})
        assert p["experience"] == "6"

    def test_english_extracted_from_languages(self):
        p = self._build({
            "years_experience": 3,
            "skills": [],
            "languages": [{"language": "Inglés", "level": "avanzado"}, {"language": "Español", "level": "nativo"}],
            "preferred_locations": [],
            "work_modalities": [],
            "seniority": "mid",
        })
        assert p["english"] == "avanzado"
        assert len(p["idiomas"]) == 2

    def test_work_modalities_normalized(self):
        p = self._build({
            "years_experience": 2,
            "skills": [],
            "languages": [],
            "preferred_locations": [],
            "work_modalities": ["Remoto", "Híbrido"],
            "seniority": "mid",
        })
        assert "Remoto" in p["modalidad"]
        assert "Híbrido" in p["modalidad"]

    def test_skills_capped_at_25(self):
        p = self._build({
            "years_experience": 3,
            "skills": [f"skill{i}" for i in range(30)],
            "languages": [],
            "preferred_locations": [],
            "work_modalities": [],
            "seniority": "mid",
        })
        assert len(p["stack"]) == 25


# ---------------------------------------------------------------------------
# Tests: parseo de JSON en respuesta de IA
# ---------------------------------------------------------------------------

class TestExtractJsonFromResponse:
    def _extract(self, raw):
        from app.services.cv_service import _extract_json_from_response
        return _extract_json_from_response(raw)

    def test_plain_json(self):
        raw = '{"key": "value"}'
        assert self._extract(raw) == {"key": "value"}

    def test_markdown_code_block(self):
        raw = '```json\n{"key": "value"}\n```'
        assert self._extract(raw) == {"key": "value"}

    def test_markdown_block_no_language(self):
        raw = '```\n{"key": "value"}\n```'
        assert self._extract(raw) == {"key": "value"}

    def test_json_embedded_in_text(self):
        raw = 'Aquí tienes: {"key": "value"} espero que ayude'
        assert self._extract(raw) == {"key": "value"}

    def test_invalid_raises(self):
        import json
        with pytest.raises((json.JSONDecodeError, Exception)):
            self._extract("esto no es json")
