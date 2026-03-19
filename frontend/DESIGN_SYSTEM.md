# Design System — JobMatch IA

Referencia de estilos base para mantener consistencia visual en todo el proyecto.

## Paleta de Colores

### Neutrales (Grises)
- **#111827** — Texto principal, títulos oscuros
- **#374151** — Texto secundario, etiquetas
- **#4b5563** — Texto terciario, motivos
- **#6b7280** — Texto deshabilitado, placeholders
- **#9ca3af** — Estados vacíos, hints
- **#d1d5db** — Bordes inactivos, divisores
- **#e5e7eb** — Bordes activos, fondos claros
- **#f9fafb** — Fondos suaves (tarjetas, contenedores)
- **#fff** — Blanco puro (fondos principales)

### Semáforo (Estados de Matching)
- **Verde (#22c55e)** — APLICA (fondo #dcfce7)
- **Amarillo (#eab308)** — QUIZÁ (fondo #fef9c3)
- **Rojo (#ef4444)** — NO_ENCAJA (fondo #fee2e2)
- **Verde éxito (#059669)** — Salarios, información positiva

### Primario (Interacción)
- **#3b82f6** — Botones, enlaces activos, accent primario

### Error
- **#991b1b** — Texto de error
- **#dc2626** — Error alternativo
- **#fecaca** — Bordes de error

## Tipografía

### Familia
- **Font Stack**: `'Segoe UI', system-ui, sans-serif`
- Moderno, legible, multiplataforma

### Tamaños
- **26px** — Títulos principales (h2)
- **16px** — Subtítulos (card titles)
- **15px** — Texto normal, botones primarios
- **14px** — Labels, campos de formulario
- **13px** — Metadata, información secundaria
- **11px** — Badges, labels pequeños
- **36px** — Números de contador (summary cards)

### Pesos
- **700** — Títulos, números destacados, badges
- **600** — Labels, subtítulos, botones
- **400** — Texto normal

### Interletraje
- **-0.5px** — Títulos principales (h2)
- **0.5px** — Labels, badges, texto en mayúsculas

## Espaciado

### Padding (Contenedores)
- **32px** — Contenedor principal (container)
- **20px** — Tarjetas (cards, summary cards)
- **12px 14px** — Mensajes de error
- **40px 20px** — Estado vacío
- **60px 0** — Loading spinner container

### Gaps (Flexbox)
- **20px** — Campos en formularios
- **16px** — Tarjetas, summary cards, card metadata
- **12px** — Checkboxes, opciones
- **8px** — Filtros, botones pequeños
- **6px** — Labels y campos
- **4px** — Espaciado interno (márgenes)

### Márgenes
- **40px auto** — Margen externo del contenedor (vertical × horizontal)
- **24px** — Separación entre secciones
- **0 32px** — Título (0 top, 32px bottom)
- **0 0 6px / 0 0 4px** — Subtítulos y metadata

## Bordes

### Border Radius
- **14px** — Contenedor principal
- **12px** — Summary cards
- **10px** — Tarjetas de resultado
- **8px** — Inputs, selects, botones, error messages
- **6px** — Badges
- **50%** — Spinner (círculo)

### Border Width & Style
- **1px solid** — Bordes normales, contenedor
- **1.5px solid** — Inputs, selects, botones de filtro
- **4px solid** — Border-left de tarjetas (color codificado)

## Sombras

### Box Shadow
- **0 1px 3px rgba(0,0,0,0.08)** — Elevación sutil (container)
- Sin sombra en tarjetas (solo borde)

## Estados de Componentes

### Botones
- **Primario (submit/acción)**
  - Background: #3b82f6
  - Color: #fff
  - Padding: 12px 24px
  - Font: 15px, weight 600
  - Border-radius: 8px
  - Transition: all 0.2s ease

- **Filtro — Activo**
  - Background: #3b82f6
  - Color: #fff
  - Border: 1.5px solid #3b82f6
  - Padding: 8px 16px
  - Font: 13px, weight 600

- **Filtro — Inactivo**
  - Background: #fff
  - Color: #6b7280
  - Border: 1.5px solid #d1d5db
  - Padding: 8px 16px
  - Font: 13px, weight 600

### Inputs & Selects
- Padding: 10px 12px
- Font: 14px
- Border-radius: 8px
- Border: 1.5px solid #d1d5db
- Background: #fff
- Font-family: inherit

### Tarjetas de Resultado
- Padding: 20px
- Border-radius: 10px
- Background: #f9fafb
- Border: 1px solid #e5e7eb
- Border-left: 4px solid (color codificado por resultado)
- Transition: all 0.2s ease

### Error Messages
- Background: #fee2e2
- Border: 1px solid #fecaca
- Color: #991b1b
- Padding: 12px 14px
- Border-radius: 8px

## Animaciones & Transiciones

### Spinner de Carga
- **Animation**: `spin 1s linear infinite`
- **Border**: 4px solid #e5e7eb (gris)
- **Border-top**: 4px solid #3b82f6 (azul)
- **Border-radius**: 50%
- Tamaño: 40px × 40px

### Transiciones Estándar
- **Duration**: 0.2s
- **Timing**: ease
- **Property**: all
- Usado en botones y tarjetas

## Responsive

### Ancho Máximo
- **700px** — Contenedor principal
- **600px** — Original (ampliado a 700px)

### Breakpoints
- Grid de summary cards: `repeat(3, 1fr)` (3 columnas)
- Checkbox/filter wrap: flex-wrap para móviles

## Ejemplos de Uso

### Crear tarjeta con estilos consistentes
```javascript
const cardStyle = {
  padding: 20,
  borderRadius: 10,
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderLeft: "4px solid #22c55e", // Verde APLICA
  transition: "all 0.2s ease",
};
```

### Botón primario
```javascript
const buttonStyle = {
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 600,
  color: "#fff",
  backgroundColor: "#3b82f6",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
};
```

### Texto metadata
```javascript
const metaStyle = {
  fontSize: 13,
  color: "#6b7280",
  margin: 0,
};
```

## CSS Global (index.html)

### Keyframes
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Body Styles
- **Margin**: 0
- **Background**: #f5f5f5 (fondo gris claro de página)

## Notas Importantes

1. **Colores del semáforo** se usan como `borderLeft` en tarjetas
2. **Gris neutral #6b7280** es el color por defecto para texto deshabilitado
3. **Transiciones 0.2s ease** en todos los elementos interactivos
4. **Letter-spacing** solo en títulos y labels en mayúsculas
5. **Font-style italic** solo para motivos de IA (descripción)
6. **Font-weight 700** reservado para elementos importantes (títulos, números)
7. **Body background #f5f5f5** proporciona contraste con containers blancos
8. **Contenedor max-width 700px** mantiene legibilidad en pantallas grandes
