# Tests — JobMatch IA Backend

## Tests unitarios (rápidos, sin servicios externos)

Estos tests se ejecutan con SQLite en memoria y mocks. Son los que corre el CI.

```bash
cd backend
pytest tests/ -v
```

No necesitan backend en marcha, ni base de datos real, ni clave de Claude API.

---

## Tests de batería (integración con backend real)

Los battery tests lanzan perfiles reales contra el motor de matching y miden calidad. **Requieren un backend en marcha** con datos reales indexados.

### Prerrequisitos

1. Backend corriendo en `http://localhost:8000`
2. Base de datos con ofertas indexadas (ejecutar al menos una ingesta manual desde el Admin)
3. `JWT_SECRET` igual al configurado en `backend/.env`
4. Usuario con `id=6` existente en la base de datos (o ajustar `USER_ID` en el archivo)

### Cómo ejecutarlos

```bash
# Batería rápida (4 perfiles, ~2-5 min)
pytest tests/test_battery_v3_quick.py -m battery -s -v

# Batería v2 (14 perfiles, ~10-15 min)
pytest tests/test_battery_v2.py -m battery -s -v

# Batería masiva (100 perfiles, ~35 min, ~$0.55 en Claude API)
pytest tests/test_battery_v5_massive.py -m battery -s -v
```

El flag `-s` muestra el output en tiempo real (resultados por perfil, métricas de precisión, ghost survivors).

### Resumen de archivos

| Archivo | Perfiles | Duración estimada | Coste Claude API |
|---------|----------|-------------------|-----------------|
| `test_battery_v3_quick.py` | 4 | 2–5 min | ~$0.03 |
| `test_battery_v2.py` | 14 | 10–15 min | ~$0.10 |
| `test_battery_v5_massive.py` | 100 | ~35 min | ~$0.55 |

> Los battery tests están marcados con `pytest.mark.battery` y excluidos del CI automáticamente.
> Para forzar su ejecución en CI: `pytest -m battery tests/`
