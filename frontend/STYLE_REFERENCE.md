# Style Reference — Quick Guide

## 📁 Archivos de Referencia de Diseño

- **`DESIGN_SYSTEM.md`** — Documentación completa (colores, tipografía, espaciado, animaciones)
- **`src/constants/theme.js`** — Constantes JavaScript reutilizables para componentes

---

## 🎨 Colores Base

```
Texto Principal:      #111827  (títulos, h2)
Texto Secundario:     #374151  (labels)
Texto Terciario:      #4b5563  (motivos)
Texto Deshabilitado:  #6b7280  (placeholders, hints)
Texto Hints:          #9ca3af  (estados vacíos)

Borde Activo:         #e5e7eb  (containers, cards)
Borde Inactivo:       #d1d5db  (inputs disabled)

Background Card:      #f9fafb  (tarjetas, suave)
Background Page:      #f5f5f5  (fondo de página)
White:                #fff     (fondo principal)

[SEMÁFORO]
Verde (APLICA):       #22c55e  (border #dcfce7 bg)
Amarillo (QUIZÁ):     #eab308  (border #fef9c3 bg)
Rojo (NO_ENCAJA):     #ef4444  (border #fee2e2 bg)

Primario (Botones):   #3b82f6  (blue)
Éxito (Salarios):     #059669  (green)
Error:                #991b1b  (text), #fecaca (border), #fee2e2 (bg)
```

---

## 🔤 Tipografía

**Font Family**: `'Segoe UI', system-ui, sans-serif`

| Elemento | Tamaño | Peso | Ejemplo |
|----------|--------|------|---------|
| Títulos (h2) | 26px | 700 | "Resultados del análisis IA" |
| Subtítulos | 16px | 700 | Nombre de oferta |
| Normal | 15px | 600 | Botones, texto normal |
| Body | 14px | 600 | Labels de inputs |
| Pequeño | 13px | 400 | Metadata, descripción |
| XS (badges) | 11px | 700 | "APLICA", "QUIZÁ" |
| Contador | 36px | 700 | Números de summary |

**Letter-spacing**:
- `-0.5px` — Títulos h2
- `0.5px` — Labels en mayúsculas, badges

---

## 📏 Espaciado (escala)

```javascript
xs:    4px    (espacios mínimos)
sm:    6px    (spacing en labels)
md:    8px    (filtros, gaps pequeños)
lg:    12px   (checkboxes, opciones)
xl:    16px   (tarjetas, metadata)
xxl:   20px   (contenido tarjetas)
xxxl:  24px   (separación secciones)
huge:  32px   (padding contenedor)
massive: 40px (padding outer, loading)
```

---

## 🔲 Bordes

| Elemento | Radius | Border Width |
|----------|--------|--------------|
| Contenedor | 14px | 1px |
| Summary cards | 12px | 1px |
| Tarjetas | 10px | 1px + 4px left |
| Inputs/Buttons | 8px | 1.5px |
| Badges | 6px | — |
| Spinner | 50% (círculo) | 4px |

---

## 🎬 Animaciones

**Keyframe Global** (en index.html):
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Transiciones Estándar**:
- Duration: `0.2s`
- Timing: `ease`
- Property: `all`
- Usado en: botones, tarjetas, filtros

---

## 💾 Importar Constantes en Componentes

```javascript
import { colors, typography, spacing, border, componentStyles } from '../constants/theme';

const myStyle = {
  fontSize: typography.sizes.normal,
  color: colors.text.primary,
  padding: spacing.xl,
  borderRadius: border.radius.md,
  ...componentStyles.button.primary,
};
```

---

## ✅ Checklist para Componentes Nuevos

- [ ] Usar `colors` constantes (no hardcodear #)
- [ ] Usar `typography.sizes` para consistencia
- [ ] Usar `spacing` escala para margins/paddings
- [ ] Usar `border.radius` predefinidos
- [ ] Agregar `transition: all 0.2s ease` en interactivos
- [ ] Usar `font-family: typography.family`
- [ ] Badge uppercase + letter-spacing wide
- [ ] Error bg #fee2e2, border #fecaca, text #991b1b

---

## 📱 Responsive

- **Max-width**: 700px (contenedor principal)
- **Grid summary**: `repeat(3, 1fr)` (3 columnas)
- **Flex wrap**: checkboxes y filtros en móviles
- **Font sizes**: No cambian por breakpoints (legible en cualquier tamaño)

---

## 🎯 Paleta por Contexto

### Para Tarjetas de Resultado
```javascript
// Verde APLICA
borderLeft: colors.semaphore.aplica.main,
backgroundColor: colors.semaphore.aplica.bg,

// Amarillo QUIZÁ
borderLeft: colors.semaphore.quiza.main,
backgroundColor: colors.semaphore.quiza.bg,

// Rojo NO_ENCAJA
borderLeft: colors.semaphore.noEncaja.main,
backgroundColor: colors.semaphore.noEncaja.bg,
```

### Para Badgessugiere
```javascript
backgroundColor: borderColor,  // Verde/Amarillo/Rojo
color: borderColor === colors.semaphore.quiza.main ? "#333" : "#fff",
...componentStyles.badge,
```

---

## 📚 Referencias

- **Documentación completa**: Leer `DESIGN_SYSTEM.md`
- **Constantes JS**: Leer `src/constants/theme.js`
- **Componente actual**: Ver `src/pages/Profile.jsx` (líneas 254-463)
