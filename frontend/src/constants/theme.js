// Theme Constants — JobMatch IA
// Referencia centralizada de colores, tipografía y espaciado

export const colors = {
  // Neutrals
  text: {
    primary: "#111827",
    secondary: "#374151",
    tertiary: "#4b5563",
    disabled: "#6b7280",
    hint: "#9ca3af",
  },
  border: {
    active: "#e5e7eb",
    inactive: "#d1d5db",
    glass: "rgba(255,255,255,0.3)",
  },
  background: {
    page: "#f8faff",
    card: "#f9fafb",
    white: "#fff",
    glass: "rgba(255,255,255,0.85)",
  },

  // Semáforo (Matching Results) — 2026 vibrant palette
  semaphore: {
    aplica: {
      main: "#10b981",   // Emerald
      bg: "#d1fae5",
    },
    quiza: {
      main: "#f59e0b",   // Amber
      bg: "#fef3c7",
    },
    noEncaja: {
      main: "#f43f5e",   // Rose
      bg: "#ffe4e6",
    },
  },

  // Estados
  success: "#059669",
  error: {
    text: "#991b1b",
    border: "#fecaca",
    bg: "#fee2e2",
  },

  // Primario
  primary: "#2563eb",
};

export const gradients = {
  primary: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
  primaryHover: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)",
  hero: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
  text: "linear-gradient(135deg, #2563eb, #7c3aed)",
  page: "linear-gradient(180deg, #f0f4ff 0%, #e8f0fe 100%)",
};

export const typography = {
  family: "'Segoe UI', system-ui, sans-serif",
  sizes: {
    h1: 26,
    h2: 16,
    normal: 15,
    body: 14,
    small: 13,
    xs: 11,
  },
  weights: {
    extrabold: 800,
    bold: 700,
    semibold: 600,
    normal: 400,
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: 0,
    wide: "0.05em",
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
    pill: 50,
    circle: "50%",
  },
  width: {
    thin: "1px",
    medium: "1.5px",
    thick: "4px",
  },
};

export const shadow = {
  subtle: "0 1px 3px rgba(0,0,0,0.06)",
  card: "0 8px 32px rgba(0,0,0,0.08)",
  elevated: "0 20px 60px rgba(0,0,0,0.15)",
  glass: "0 8px 32px rgba(31,38,135,0.07)",
  glow: "0 0 0 3px rgba(37,99,235,0.15)",
};

export const transition = {
  fast: "0.2s ease",
  smooth: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
};

// Presets para componentes comunes
export const componentStyles = {
  button: {
    primary: {
      padding: `${spacing.md}px ${spacing.xl}px`,
      fontSize: typography.sizes.normal,
      fontWeight: typography.weights.semibold,
      color: colors.background.white,
      background: gradients.primary,
      border: "none",
      borderRadius: border.radius.md,
      cursor: "pointer",
      transition: `all ${transition.smooth}`,
      fontFamily: typography.family,
    },
    filter: {
      active: {
        padding: `${spacing.sm}px ${spacing.md}px`,
        fontSize: typography.sizes.small,
        fontWeight: typography.weights.semibold,
        background: gradients.primary,
        color: colors.background.white,
        borderColor: "transparent",
        borderRadius: border.radius.md,
        cursor: "pointer",
        transition: `all ${transition.smooth}`,
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
        transition: `all ${transition.smooth}`,
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
    backgroundColor: colors.background.glass,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${colors.border.glass}`,
    boxShadow: shadow.glass,
    transition: `all ${transition.smooth}`,
  },
  badge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: border.radius.sm,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};
