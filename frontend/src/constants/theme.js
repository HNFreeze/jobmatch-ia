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

// ── Design tokens v2 — semantic, dark-mode aware ─────────────────────────────
// Resolve all surface/text/border colors for a given mode with one call:
//   const t = palette(dm);  ->  t.surface, t.text, t.border, t.primary, ...
// Keeps the UI sober (neutral surfaces + one recognizable blue) instead of the
// purple "AI" gradient dominating the interface.
export const breakpoints = { sm: 480, md: 768, lg: 1024, xl: 1440 };

export const focusRing = "0 0 0 3px rgba(37,99,235,0.40)";

export function palette(dm) {
  return dm
    ? {
        bg: "#0b1120", surface: "#0f172a", surfaceMuted: "#111c34", surfaceHover: "#16223e",
        border: "#1e293b", borderStrong: "#334155",
        text: "#f1f5f9", textSecondary: "#cbd5e1", textMuted: "#94a3b8",
        primary: "#3b82f6", primaryHover: "#60a5fa", primaryText: "#ffffff",
        positive: "#34d399", warning: "#fbbf24", danger: "#f87171",
        overlay: "rgba(2,6,23,0.72)",
      }
    : {
        bg: "#f6f8fc", surface: "#ffffff", surfaceMuted: "#f8fafc", surfaceHover: "#f1f5f9",
        border: "#e5e7eb", borderStrong: "#cbd5e1",
        text: "#0f172a", textSecondary: "#334155", textMuted: "#64748b",
        primary: "#2563eb", primaryHover: "#1d4ed8", primaryText: "#ffffff",
        positive: "#059669", warning: "#b45309", danger: "#be123c",
        overlay: "rgba(15,23,42,0.45)",
      };
}

// Agent operational states → human label + tone. Only operational steps are
// surfaced to the user (never chain-of-thought).
export const agentStateMeta = {
  CREATED: { label: "Iniciado", tone: "#64748b" },
  INTERPRETING: { label: "Interpretando la búsqueda", tone: "#2563eb" },
  SEARCHING: { label: "Consultando oportunidades", tone: "#2563eb" },
  FILTERING: { label: "Aplicando restricciones", tone: "#2563eb" },
  ANALYZING: { label: "Analizando ofertas", tone: "#2563eb" },
  RANKING: { label: "Ordenando resultados", tone: "#2563eb" },
  WAITING_FOR_USER: { label: "Esperando tu decisión", tone: "#0891b2" },
  EXECUTING_APPROVED_ACTION: { label: "Guardando tu selección", tone: "#7c3aed" },
  COMPLETED: { label: "Completado", tone: "#059669" },
  FAILED: { label: "Error", tone: "#dc2626" },
  CANCELLED: { label: "Cancelado", tone: "#6b7280" },
};

// Compatibility tiers from a 0..100 score. Thresholds mirror the backend
// matching engine (APLICA >= 73, QUIZÁ >= 52).
export function compatTier(score) {
  const s = Number(score) || 0;
  if (s >= 73) return { key: "alta", label: "Compatibilidad alta", tone: "aplica", color: "#059669" };
  if (s >= 52) return { key: "media", label: "Compatibilidad media", tone: "quiza", color: "#b45309" };
  return { key: "baja", label: "Compatibilidad baja", tone: "no_encaja", color: "#be123c" };
}

// ── Tokens de página (fuente única) ──────────────────────────────────────────
// Superconjunto de tokens que comparten Dashboard / UserProfile / Favoritos.
// Antes cada página definía su propio useTokens() duplicado y con teal divergente;
// ahora todas derivan de aquí (un solo origen, teal unificado a #00758A).
export function pageTokens(dm, density) {
  const d = !!dm;
  const compact = density === "compacta";
  return {
    bg: d ? "#0a1120" : "#f8f9fc",
    surface: d ? "#0f172a" : "#ffffff",
    surface2: d ? "#111c30" : "#fbfbfd",
    text: d ? "#e6edf7" : "#0b1220",
    textSub: d ? "#94a3b8" : "#475569",
    textMute: d ? "#64748b" : "#94a3b8",
    border: d ? "#1e293b" : "#e8ebf2",
    borderSt: d ? "#27364d" : "#d8dde7",
    teal: "#00758A",
    tealSoft: d ? "rgba(0,117,138,0.18)" : "rgba(0,117,138,0.08)",
    tealLine: d ? "rgba(0,117,138,0.40)" : "rgba(0,117,138,0.25)",
    purple: "#7c3aed",
    purpleSoft: d ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.08)",
    blue: "#2563eb",
    green: "#10b981",
    greenSoft: d ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.10)",
    greenFg: d ? "#6ee7b7" : "#047857",
    amber: "#f59e0b",
    amberSoft: d ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.10)",
    amberFg: d ? "#fcd34d" : "#b45309",
    red: "#ef4444",
    redSoft: d ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)",
    redFg: d ? "#fca5a5" : "#b91c1c",
    shadow: d
      ? "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)"
      : "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.10)",
    gap: compact ? 12 : 18,
    gapLg: compact ? 16 : 24,
    pad: compact ? 16 : 22,
    padLg: compact ? 20 : 28,
    radius: 12,
    radiusSm: 8,
    font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    _dm: d,
  };
}

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
