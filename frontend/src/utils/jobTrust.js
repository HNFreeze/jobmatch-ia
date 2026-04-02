const SOURCE_NAME_LABELS = {
  infojobs: "InfoJobs",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  adzuna: "Adzuna",
};

const SOURCE_TYPE_META = {
  official_api: {
    shortLabel: "oficial",
    detailLabel: "API oficial",
    tone: "positive",
  },
  public_ats: {
    shortLabel: "directo",
    detailLabel: "ATS público",
    tone: "positive",
  },
  career_page: {
    shortLabel: "empresa",
    detailLabel: "web de empresa",
    tone: "info",
  },
  aggregator: {
    shortLabel: "agregada",
    detailLabel: "agregador",
    tone: "neutral",
  },
};

const FRESHNESS_META = {
  verified_recently: {
    label: "Verificada",
    detailLabel: "Verificada recientemente",
    tone: "positive",
  },
  verification_due: {
    label: "Verificación reciente",
    detailLabel: "Verificación reciente",
    tone: "info",
  },
  stale_verification: {
    label: "Revisar verificación",
    detailLabel: "Verificación pendiente",
    tone: "warning",
  },
  stale_listing: {
    label: "Listado antiguo",
    detailLabel: "Listado antiguo",
    tone: "warning",
  },
  inactive: {
    label: "Inactiva",
    detailLabel: "Marcada como inactiva",
    tone: "danger",
  },
  verification_pending: {
    label: "Sin verificar",
    detailLabel: "Pendiente de verificar",
    tone: "neutral",
  },
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function hasMeaningfulValue(value) {
  return String(value || "").trim().length > 0;
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatSourceName(sourceName) {
  const normalized = normalizeText(sourceName);
  if (!normalized) return "";
  return SOURCE_NAME_LABELS[normalized] || titleCase(normalized);
}

export function formatRelativeTimestamp(dateString) {
  if (!dateString) return "";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "";

  const diffMs = Date.now() - parsed.getTime();
  const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "hace menos de 1 hora";
  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    return `hace ${hours} hora${hours !== 1 ? "s" : ""}`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`;

  return parsed.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isVerifiedOffer(offer) {
  return normalizeText(offer?.freshness_state) === "verified_recently" || Boolean(offer?.verified_recently);
}

export function isOfficialOffer(offer) {
  return normalizeText(offer?.source_type) === "official_api";
}

export function isDirectSourceOffer(offer) {
  return ["official_api", "public_ats", "career_page"].includes(normalizeText(offer?.source_type));
}

export function isAggregatorOffer(offer) {
  return normalizeText(offer?.source_type) === "aggregator";
}

export function hasVisibleSalary(offer) {
  const salary = normalizeText(offer?.salario);
  return hasMeaningfulValue(salary) && !["salario no especificado", "no especificado"].includes(salary);
}

export function isJuniorFriendlyOffer(offer) {
  const seniority = normalizeText(offer?.signals_summary?.seniority_level);
  if (seniority === "junior") return true;
  const text = normalizeText(`${offer?.titulo || ""} ${offer?.descripcion || ""}`);
  return /(junior|trainee|intern|beca|practicas|prácticas|primer empleo)/.test(text);
}

export function getOfferQualityCounts(offers = []) {
  return {
    verified: offers.filter(isVerifiedOffer).length,
    direct: offers.filter(isDirectSourceOffer).length,
    official: offers.filter(isOfficialOffer).length,
    salaryVisible: offers.filter(hasVisibleSalary).length,
    juniorFriendly: offers.filter(isJuniorFriendlyOffer).length,
  };
}

export function getOfferTrustSignals(offer, maxSignals = 3) {
  const signals = [];
  const sourceName = formatSourceName(offer?.source_name);
  const sourceType = normalizeText(offer?.source_type) || "aggregator";
  const sourceMeta = SOURCE_TYPE_META[sourceType];

  if (sourceName) {
    signals.push({
      key: "source",
      tone: sourceMeta?.tone || "neutral",
      label: sourceMeta?.shortLabel ? `${sourceName} ${sourceMeta.shortLabel}` : sourceName,
    });
  }

  const freshnessMeta = FRESHNESS_META[normalizeText(offer?.freshness_state)];
  if (freshnessMeta) {
    signals.push({
      key: "freshness",
      tone: freshnessMeta.tone,
      label: freshnessMeta.label,
    });
  }

  const confidence = Number(offer?.source_confidence);
  if (!Number.isNaN(confidence) && confidence > 0) {
    let label = "Confianza baja";
    let tone = "danger";

    if (confidence >= 0.9) {
      label = "Alta confianza";
      tone = "positive";
    } else if (confidence >= 0.75) {
      label = "Buena confianza";
      tone = "info";
    } else if (confidence >= 0.6) {
      label = "Confianza media";
      tone = "warning";
    }

    signals.push({
      key: "confidence",
      tone,
      label,
    });
  }

  return signals.slice(0, Math.max(0, maxSignals));
}

export function getOfferTrustDetail(offer) {
  const sourceName = formatSourceName(offer?.source_name);
  const sourceType = normalizeText(offer?.source_type) || "aggregator";
  const sourceMeta = SOURCE_TYPE_META[sourceType];
  const freshnessMeta = FRESHNESS_META[normalizeText(offer?.freshness_state)];
  const verifiedAt = formatRelativeTimestamp(offer?.last_verified_at);

  const parts = [];

  if (sourceName) {
    const suffix = sourceMeta?.detailLabel ? ` (${sourceMeta.detailLabel})` : "";
    parts.push(`Fuente: ${sourceName}${suffix}`);
  }

  if (freshnessMeta?.detailLabel) {
    parts.push(freshnessMeta.detailLabel);
  }

  if (verifiedAt) {
    parts.push(`Última verificación ${verifiedAt}`);
  }

  return parts.join(" · ");
}
