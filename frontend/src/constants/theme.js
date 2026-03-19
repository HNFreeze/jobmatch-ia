// Theme Constants — JobMatch IA
// Referencia centralizada de colores, tipografía y espaciado

export const colors = {
  // Neutrals
  text: {
    primary: "#111827",      // Títulos, texto principal
    secondary: "#374151",    // Etiquetas
    tertiary: "#4b5563",     // Motivos, descripción
    disabled: "#6b7280",     // Deshabilitado, placeholders
    hint: "#9ca3af",         // Estados vacíos
  },
  border: {
    active: "#e5e7eb",       // Bordes normales
    inactive: "#d1d5db",     // Bordes deshabilitados
  },
  background: {
    page: "#f5f5f5",         // Fondo de página
    card: "#f9fafb",         // Tarjetas, contenedores suaves
    white: "#fff",           // Blanco puro
  },

  // Semáforo (Matching Results)
  semaphore: {
    aplica: {
      main: "#22c55e",       // Verde
      bg: "#dcfce7",         // Verde claro
    },
    quiza: {
      main: "#eab308",       // Amarillo
      bg: "#fef9c3",         // Amarillo claro
    },
    noEncaja: {
      main: "#ef4444",       // Rojo
      bg: "#fee2e2",         // Rojo claro
    },
  },

  // Estados
  success: "#059669",        // Éxito, salarios
  error: {
    text: "#991b1b",         // Texto error
    border: "#fecaca",       // Borde error
    bg: "#fee2e2",           // Fondo error
  },

  // Primario
  primary: "#3b82f6",        // Botones, links
};

export const typography = {
  family: "'Segoe UI', system-ui, sans-serif",
  sizes: {
    h1: 26,    // Títulos principales
    h2: 16,    // Subtítulos
    normal: 15,
    body: 14,
    small: 13,
    xs: 11,    // Badges
  },
  weights: {
    bold: 700,
    semibold: 600,
    normal: 400,
  },
  letterSpacing: {
    tight: "-0.5px",
    normal: 0,
    wide: "0.5px",
  },
};

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  huge: 32,
  massive: 40,
};

export const border = {
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    full: 14,
    circle: "50%",
  },
  width: {
    thin: "1px",
    medium: "1.5px",
    thick: "4px",
  },
};

export const shadow = {
  subtle: "0 1px 3px rgba(0,0,0,0.08)",
};

export const transition = {
  fast: "0.2s ease",
};

// Presets para componentes comunes
export const componentStyles = {
  button: {
    primary: {
      padding: `${spacing.md}px ${spacing.xl}px`,
      fontSize: typography.sizes.normal,
      fontWeight: typography.weights.semibold,
      color: colors.background.white,
      backgroundColor: colors.primary,
      border: "none",
      borderRadius: border.radius.md,
      cursor: "pointer",
      transition: `all ${transition.fast}`,
      fontFamily: typography.family,
    },
    filter: {
      active: {
        padding: `${spacing.sm}px ${spacing.md}px`,
        fontSize: typography.sizes.small,
        fontWeight: typography.weights.semibold,
        backgroundColor: colors.primary,
        color: colors.background.white,
        borderColor: colors.primary,
        borderRadius: border.radius.md,
        cursor: "pointer",
        transition: `all ${transition.fast}`,
      },
      inactive: {
        padding: `${spacing.sm}px ${spacing.md}px`,
        fontSize: typography.sizes.small,
        fontWeight: typography.weights.semibold,
        backgroundColor: colors.background.white,
        color: colors.text.disabled,
        borderColor: colors.border.inactive,
        borderRadius: border.radius.md,
        cursor: "pointer",
        transition: `all ${transition.fast}`,
      },
    },
  },
  input: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: typography.sizes.body,
    borderRadius: border.radius.md,
    border: `${border.width.medium} solid ${colors.border.inactive}`,
    backgroundColor: colors.background.white,
    fontFamily: "inherit",
  },
  card: {
    padding: spacing.xxl,
    borderRadius: border.radius.lg,
    backgroundColor: colors.background.card,
    border: `${border.width.thin} solid ${colors.border.active}`,
    transition: `all ${transition.fast}`,
  },
  badge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: border.radius.sm,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wide,
  },
};
