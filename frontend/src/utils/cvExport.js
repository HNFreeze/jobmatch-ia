export const SECTION_KEYS = [
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
];

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function normalizeList(items) {
  return Array.isArray(items) ? items : [];
}

export function getHiddenSections(cvJson) {
  const sections = cvJson?.meta?.hidden_sections;
  return Array.isArray(sections) ? sections.filter(Boolean) : [];
}

export function withExportSettings(cvJson, template, fitOnePage) {
  return {
    ...cvJson,
    meta: {
      ...(cvJson?.meta || {}),
      selected_template: template || "professional_modern",
      fit_one_page: Boolean(fitOnePage),
    },
  };
}

export function buildPreviewData(cvJson, options = {}) {
  if (!cvJson) return null;
  const hiddenSections = options.ignoreHiddenSections ? [] : getHiddenSections(cvJson);
  const hidden = new Set(hiddenSections);

  return {
    personal: cvJson.personal || {},
    summary: hidden.has("summary") ? "" : (cvJson.summary || "").trim(),
    experience: hidden.has("experience")
      ? []
      : normalizeList(cvJson.experience).filter((entry) => hasText(entry?.company) || hasText(entry?.role)),
    education: hidden.has("education")
      ? []
      : normalizeList(cvJson.education).filter((entry) => hasText(entry?.degree) || hasText(entry?.institution)),
    skills: hidden.has("skills")
      ? []
      : normalizeList(cvJson.skills).filter((group) =>
        hasText(group?.category) || normalizeList(group?.items).some(hasText)
      ),
    languages: hidden.has("languages")
      ? []
      : normalizeList(cvJson.languages).filter((language) => hasText(language?.language)),
    projects: hidden.has("projects")
      ? []
      : normalizeList(cvJson.projects).filter((project) => hasText(project?.name)),
    certifications: hidden.has("certifications")
      ? []
      : normalizeList(cvJson.certifications).filter((certification) => hasText(certification?.name)),
    meta: cvJson.meta || {},
  };
}

export function autoHideEmptySections(cvJson) {
  const visibleData = buildPreviewData(cvJson, { ignoreHiddenSections: true }) || {};
  const hidden = new Set(getHiddenSections(cvJson));
  const hiddenByAutoRule = [];

  SECTION_KEYS.forEach((section) => {
    const value = visibleData[section];
    const isEmpty = typeof value === "string"
      ? !hasText(value)
      : !Array.isArray(value) || value.length === 0;
    if (isEmpty) {
      hidden.add(section);
      hiddenByAutoRule.push(section);
    }
  });

  return {
    cvJson: {
      ...cvJson,
      meta: {
        ...(cvJson?.meta || {}),
        hidden_sections: SECTION_KEYS.filter((section) => hidden.has(section)),
      },
    },
    hiddenSections: hiddenByAutoRule,
  };
}

export function estimateCvPageFit(cvJson, template = "professional_modern", fitOnePage = false) {
  const data = buildPreviewData(cvJson) || {
    summary: "",
    experience: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
    certifications: [],
  };

  let units = template === "professional_modern" ? 12 : 10;
  const drivers = [];
  const suggestions = [];

  if (hasText(data.summary)) {
    const summaryUnits = Math.ceil(data.summary.length / 230) * 4.4;
    units += summaryUnits;
    if (data.summary.length > 420) {
      drivers.push("Resumen largo");
      suggestions.push("Recorta el resumen a 3-4 líneas");
    }
  }

  data.experience.forEach((entry) => {
    const bullets = normalizeList(entry?.bullets).filter(hasText);
    units += 6.8 + bullets.length * 2.6;
    units += bullets.filter((bullet) => bullet.length > 120).length * 1.3;
  });
  if (data.experience.length >= 4) {
    drivers.push("Mucha experiencia visible");
    suggestions.push("Deja solo la experiencia más relevante");
  }

  data.education.forEach(() => {
    units += 3.1;
  });

  data.skills.forEach((group) => {
    const skillCount = normalizeList(group?.items).filter(hasText).length;
    units += 1.8 + skillCount * 0.45;
  });

  if (data.languages.length) {
    units += Math.ceil(data.languages.length / 2) * 1.8;
  }

  data.projects.forEach((project) => {
    const bullets = normalizeList(project?.bullets).filter(hasText);
    units += 4.8 + bullets.length * 2.4;
  });
  if (data.projects.length >= 2) {
    drivers.push("Proyectos detallados");
    suggestions.push("Reduce proyectos o sus bullets");
  }

  if (data.certifications.length) {
    units += data.certifications.length * 1.2;
  }

  if (fitOnePage) {
    units *= template === "professional_modern" ? 0.82 : 0.86;
  }

  const onePageLimit = template === "professional_modern" ? 46 : 43;
  const twoPageLimit = onePageLimit * 1.75;
  const estimatedPages = units <= onePageLimit ? 1 : units <= twoPageLimit ? 2 : 3;
  const distance = Math.abs(units - onePageLimit);
  const confidence = distance < 3.5 ? "media" : "alta";

  if (estimatedPages > 1 && !fitOnePage) {
    suggestions.unshift("Activa “Intentar 1 pagina”");
  }

  return {
    estimatedPages,
    confidence,
    units,
    label: estimatedPages === 1
      ? (confidence === "alta" ? "Cabe en 1 página" : "Probablemente cabe en 1 página")
      : estimatedPages === 2
        ? (fitOnePage ? "Aún puede ocupar 2 páginas" : "Probablemente ocupará 2 páginas")
        : "Seguramente ocupará más de 2 páginas",
    tone: estimatedPages === 1 ? "success" : estimatedPages === 2 ? "warning" : "danger",
    drivers: drivers.slice(0, 3),
    suggestions: [...new Set(suggestions)].slice(0, 3),
  };
}
