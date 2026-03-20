# -*- coding: utf-8 -*-
import os
import httpx
import json
from typing import Optional


async def fetch_offers_from_adzuna(skills: list[str], location: str = "Madrid") -> Optional[list]:
    """
    Obtiene ofertas de trabajo reales de Adzuna API para España.

    Args:
        skills: Lista de tecnologías/skills a buscar
        location: Ubicación (default: Madrid)

    Returns:
        Lista de ofertas mapeadas al formato interno, o None si falla
    """
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")

    if not app_id or not app_key:
        print("ERROR: ADZUNA_APP_ID o ADZUNA_APP_KEY no configurados")
        return None

    # Construir query de búsqueda con los skills del usuario
    # Ejemplo: "javascript" OR "react" OR "python"
    search_query = " OR ".join(skills) if skills else "developer"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            url = "https://api.adzuna.com/v1/api/jobs/es/search/1"

            params = {
                "app_id": app_id,
                "app_key": app_key,
                "results_per_page": 50,
                "what": search_query,
                "content-type": "application/json",
                "sort_by": "date",
                "sort_direction": "descending",
            }

            print(f"DEBUG: Llamando a Adzuna API con skills: {skills}")
            response = await client.get(url, params=params)
            response.raise_for_status()

            data = response.json()
            print(f"DEBUG: Adzuna respondió con {len(data.get('results', []))} ofertas")

            # Mapear respuesta de Adzuna al formato interno
            mapped_offers = _map_adzuna_to_internal_format(data.get("results", []))
            return mapped_offers

    except httpx.HTTPStatusError as e:
        print(f"ERROR: Adzuna API HTTP {e.response.status_code}: {e.response.text}")
        return None
    except httpx.TimeoutException:
        print("ERROR: Timeout conectando a Adzuna API")
        return None
    except Exception as e:
        print(f"ERROR en Adzuna API: {str(e)}")
        return None


def _map_adzuna_to_internal_format(adzuna_results: list) -> list:
    """
    Mapea ofertas de Adzuna al formato interno (compatible con mock_offers.json).

    Formato interno esperado:
    {
        "id": int,
        "titulo": str,
        "empresa": str,
        "ubicacion": str,
        "descripcion": str,
        "salario": str (opcional)
    }

    Campos de Adzuna:
    - id
    - title
    - company
    - location
    - description
    - salary_min / salary_max
    - contract_type
    - redirect_url
    """
    mapped = []

    for idx, job in enumerate(adzuna_results, 1):
        # Extraer salario si está disponible
        salario = None
        if job.get("salary_min") and job.get("salary_max"):
            salary_min = int(job["salary_min"])
            salary_max = int(job["salary_max"])
            salario = f"€{salary_min:,} - €{salary_max:,}/año"
        elif job.get("salary_min"):
            salario = f"€{int(job['salary_min']):,}/año"
        elif job.get("salary_max"):
            salario = f"Hasta €{int(job['salary_max']):,}/año"

        # Limpiar descripción (Adzuna incluye HTML)
        description = job.get("description", "").replace("<br>", " ").replace("</p>", " ").replace("<p>", "")
        # Truncar descripción muy larga
        if len(description) > 500:
            description = description[:500] + "..."

        offer = {
            "id": idx,  # Usar índice local como ID
            "titulo": job.get("title", "Sin título"),
            "empresa": job.get("company", {}).get("display_name", "Empresa desconocida") if isinstance(job.get("company"), dict) else job.get("company", "Empresa desconocida"),
            "ubicacion": job.get("location", {}).get("display_name", "Ubicación desconocida") if isinstance(job.get("location"), dict) else job.get("location", "Ubicación desconocida"),
            "descripcion": description.strip(),
            "salario": salario or "Salario no especificado",
        }

        mapped.append(offer)

    return mapped
