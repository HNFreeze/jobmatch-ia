import { typography, transition } from "../constants/theme";

const TEAL = "#007A8A";

const RESULT_META = {
  APLICA: { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Aplica" },
  "QUIZÁ": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Quizá" },
  NO_ENCAJA: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)", label: "NO ENCAJA" },
};

function normalizeLocationLabel(rawLocation) {
  if (!rawLocation) return "Sin ubicación";

  const raw = String(rawLocation).trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("remote") ||
    lower.includes("remoto") ||
    lower.includes("teletrabajo")
  ) {
    return "Remoto";
  }

  const firstChunk = raw.split(",")[0]?.trim() || raw;
  return firstChunk || "Sin ubicación";
}

function inferWorkMode(offer) {
  const explicit = offer?.signals_summary?.work_mode;
  if (explicit === "remote") return "Remoto";
  if (explicit === "hybrid") return "Híbrido";
  if (explicit === "onsite") return "Presencial";

  const text = `${offer?.ubicacion || ""} ${offer?.descripcion || ""}`.toLowerCase();
  if (text.includes("remote") || text.includes("remoto") || text.includes("teletrabajo")) return "Remoto";
  if (text.includes("hybrid") || text.includes("hibrid") || text.includes("hibrido")) return "Híbrido";
  if (text.includes("presencial") || text.includes("onsite")) return "Presencial";
  return "No indicado";
}

function buildLocationGroups(offers) {
  const groups = new Map();

  offers.forEach((offer) => {
    const locationKey = normalizeLocationLabel(offer.ubicacion);
    if (!groups.has(locationKey)) {
      groups.set(locationKey, {
        location: locationKey,
        offers: [],
        counts: { APLICA: 0, "QUIZÁ": 0, NO_ENCAJA: 0 },
        bestScore: 0,
        avgScore: 0,
      });
    }

    const group = groups.get(locationKey);
    group.offers.push(offer);
    group.counts[offer.resultado] = (group.counts[offer.resultado] || 0) + 1;
    group.bestScore = Math.max(group.bestScore, Number(offer.match_score ?? offer.puntuacion ?? 0));
  });

  return Array.from(groups.values())
    .map((group) => {
      const totalScore = group.offers.reduce(
        (sum, offer) => sum + Number(offer.match_score ?? offer.puntuacion ?? 0),
        0
      );
      return {
        ...group,
        avgScore: group.offers.length ? Math.round(totalScore / group.offers.length) : 0,
        topOffers: group.offers
          .slice()
          .sort((a, b) => Number(b.match_score ?? b.puntuacion ?? 0) - Number(a.match_score ?? a.puntuacion ?? 0))
          .slice(0, 3),
      };
    })
    .sort((a, b) => {
      if (b.counts.APLICA !== a.counts.APLICA) return b.counts.APLICA - a.counts.APLICA;
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
      return b.offers.length - a.offers.length;
    });
}

function formatWorkModeSummary(offers) {
  const summary = { Remoto: 0, Híbrido: 0, Presencial: 0, "No indicado": 0 };
  offers.forEach((offer) => {
    const mode = inferWorkMode(offer);
    summary[mode] = (summary[mode] || 0) + 1;
  });
  return summary;
}

function formatOfferAge(dateString) {
  if (!dateString) return "Fecha no disponible";
  try {
    const published = new Date(dateString);
    const now = new Date();
    const diff = Math.max(0, now - published);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Publicada hoy";
    if (days === 1) return "Publicada hace 1 día";
    return `Publicada hace ${days} días`;
  } catch {
    return "Fecha no disponible";
  }
}

function MetricCard({ label, value, hint, darkMode }) {
  return (
    <div style={{ ...S.metricCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
      <div style={{ ...S.metricLabel, color: darkMode ? "#94a3b8" : "#64748b" }}>{label}</div>
      <div style={{ ...S.metricValue, color: darkMode ? "#f8fafc" : "#0f172a" }}>{value}</div>
      <div style={{ ...S.metricHint, color: darkMode ? "#5eead4" : TEAL }}>{hint}</div>
    </div>
  );
}

export default function MapaOfertas({ analysisResults, darkMode }) {
  const offers = Array.isArray(analysisResults) ? analysisResults : (analysisResults?.offers || []);
  const locationGroups = buildLocationGroups(offers);
  const workModeSummary = formatWorkModeSummary(offers);
  const totalAplica = offers.filter((offer) => offer.resultado === "APLICA").length;
  const topLocations = locationGroups.slice(0, 6);
  const topOffers = offers
    .slice()
    .sort((a, b) => Number(b.match_score ?? b.puntuacion ?? 0) - Number(a.match_score ?? a.puntuacion ?? 0))
    .slice(0, 6);

  if (!offers.length) {
    return (
      <div style={{ ...S.page, ...(darkMode ? S.pageDark : {}) }}>
        <div style={{ ...S.emptyCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
          <div style={S.emptyIcon}>Ubicaciones</div>
          <h2 style={{ ...S.emptyTitle, color: darkMode ? "#f8fafc" : "#0f172a" }}>
            Aún no hay distribución geográfica
          </h2>
          <p style={{ ...S.emptyText, color: darkMode ? "#94a3b8" : "#64748b" }}>
            Primero analiza ofertas y después verás en qué ciudades o zonas se concentra mejor tu búsqueda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="locations-page-wrap" style={{ ...S.page, ...(darkMode ? S.pageDark : {}) }}>
      <div style={S.container}>
        <header className="locations-hero-card" style={{ ...S.heroCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
          <div>
            <p style={{ ...S.kicker, color: darkMode ? "#5eead4" : TEAL }}>Ubicaciones</p>
            <h1 className="locations-hero-title" style={{ ...S.heroTitle, color: darkMode ? "#f8fafc" : "#0f172a" }}>
              Donde se concentran las mejores oportunidades
            </h1>
            <p style={{ ...S.heroText, color: darkMode ? "#94a3b8" : "#64748b" }}>
              Hemos sustituido el mapa exacto por una vista más útil y honesta: agrupamos las ofertas por ciudad o zona publicada, sin fingir coordenadas reales de empresa.
            </p>
          </div>

          <div style={S.heroBadge}>
            <span style={{ ...S.heroBadgeCount, color: darkMode ? "#f8fafc" : "#0f172a" }}>{locationGroups.length}</span>
            <span style={{ ...S.heroBadgeLabel, color: darkMode ? "#94a3b8" : "#64748b" }}>zonas detectadas</span>
          </div>
        </header>

        <section style={S.metricsGrid}>
          <MetricCard
            label="Ofertas analizadas"
            value={offers.length}
            hint={`${totalAplica} con APLICA`}
            darkMode={darkMode}
          />
          <MetricCard
            label="Remoto"
            value={workModeSummary.Remoto || 0}
            hint="modalidad detectada"
            darkMode={darkMode}
          />
          <MetricCard
            label="Híbrido"
            value={workModeSummary.Híbrido || 0}
            hint="requiere presencia parcial"
            darkMode={darkMode}
          />
          <MetricCard
            label="Presencial"
            value={workModeSummary.Presencial || 0}
            hint="depende más de ubicación"
            darkMode={darkMode}
          />
        </section>

        <section className="locations-section-grid" style={S.sectionGrid}>
          <div style={{ ...S.sectionCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={{ ...S.sectionTitle, color: darkMode ? "#f8fafc" : "#111827" }}>Mejores ubicaciones para ti</h2>
                <p style={{ ...S.sectionText, color: darkMode ? "#94a3b8" : "#64748b" }}>
                  Priorizadas por volumen de APLICA, afinidad media y número total de ofertas.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topLocations.map((group) => {
                const total = group.offers.length;
                const appliesPct = total ? Math.round((group.counts.APLICA / total) * 100) : 0;
                const maybePct = total ? Math.round((group.counts["QUIZÁ"] / total) * 100) : 0;
                const noPct = Math.max(0, 100 - appliesPct - maybePct);

                return (
                  <div key={group.location} style={{ ...S.locationCard, ...(darkMode ? S.locationCardDark : {}) }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ ...S.locationName, color: darkMode ? "#f8fafc" : "#111827" }}>{group.location}</div>
                        <div style={{ ...S.locationMeta, color: darkMode ? "#94a3b8" : "#64748b" }}>
                          {total} oferta{total !== 1 ? "s" : ""} · afinidad media {group.avgScore}%
                        </div>
                      </div>
                      <div style={{ ...S.bestScoreBadge, color: darkMode ? "#5eead4" : TEAL }}>
                        top {group.bestScore}%
                      </div>
                    </div>

                    <div style={S.distributionBar}>
                      <div style={{ width: `${appliesPct}%`, backgroundColor: RESULT_META.APLICA.color, height: "100%" }} />
                      <div style={{ width: `${maybePct}%`, backgroundColor: RESULT_META["QUIZÁ"].color, height: "100%" }} />
                      <div style={{ width: `${noPct}%`, backgroundColor: RESULT_META.NO_ENCAJA.color, height: "100%" }} />
                    </div>

                    <div style={S.locationStats}>
                      {[
                        { key: "APLICA", value: group.counts.APLICA },
                        { key: "QUIZÁ", value: group.counts["QUIZÁ"] },
                        { key: "NO_ENCAJA", value: group.counts.NO_ENCAJA },
                      ].map((item) => (
                        <span
                          key={`${group.location}-${item.key}`}
                          style={{
                            ...S.resultPill,
                            backgroundColor: darkMode ? `${RESULT_META[item.key].color}22` : RESULT_META[item.key].bg,
                            color: RESULT_META[item.key].color,
                            border: `1px solid ${darkMode ? `${RESULT_META[item.key].color}44` : `${RESULT_META[item.key].color}22`}`,
                          }}
                        >
                          {RESULT_META[item.key]?.label || item.key} · {item.value}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...S.sectionCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
            <h2 style={{ ...S.sectionTitle, color: darkMode ? "#f8fafc" : "#111827" }}>Mejores ofertas del análisis</h2>
            <p style={{ ...S.sectionText, color: darkMode ? "#94a3b8" : "#64748b" }}>
              Una vista rápida de las oportunidades con mejor afinidad actual, manteniendo visible donde estan publicadas.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {topOffers.map((offer) => {
                const meta = RESULT_META[offer.resultado] || RESULT_META.NO_ENCAJA;
                return (
                  <div key={offer.id || offer.adzuna_id} style={{ ...S.offerRow, ...(darkMode ? S.offerRowDark : {}) }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...S.offerTitle, color: darkMode ? "#f8fafc" : "#111827" }}>{offer.titulo}</div>
                      <div style={{ ...S.offerMeta, color: darkMode ? "#94a3b8" : "#64748b" }}>
                        {offer.empresa} · {normalizeLocationLabel(offer.ubicacion)} · {inferWorkMode(offer)}
                      </div>
                    </div>
                    <div style={S.offerRowRight}>
                      <span style={{ ...S.resultPill, backgroundColor: darkMode ? `${meta.color}22` : meta.bg, color: meta.color, border: `1px solid ${darkMode ? `${meta.color}44` : `${meta.color}22`}` }}>
                        {RESULT_META[offer.resultado]?.label || offer.resultado}
                      </span>
                      <span style={{ ...S.scorePill, color: darkMode ? "#f8fafc" : "#111827" }}>
                        {offer.match_score ?? offer.puntuacion ?? 0}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section style={{ ...S.sectionCard, ...(darkMode ? S.cardDark : S.cardLight) }}>
          <div style={S.sectionHeader}>
            <div>
              <h2 style={{ ...S.sectionTitle, color: darkMode ? "#f8fafc" : "#111827" }}>Ofertas agrupadas por ubicación</h2>
              <p style={{ ...S.sectionText, color: darkMode ? "#94a3b8" : "#64748b" }}>
                Esta vista sustituye al pin exacto por contexto real: ciudad o zona publicada, modalidad y mejores oportunidades de cada grupo.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {locationGroups.map((group) => (
              <div key={group.location} style={{ ...S.groupColumn, ...(darkMode ? S.groupColumnDark : {}) }}>
                <div style={S.groupHeader}>
                  <div>
                    <div style={{ ...S.groupTitle, color: darkMode ? "#f8fafc" : "#111827" }}>{group.location}</div>
                    <div style={{ ...S.groupMeta, color: darkMode ? "#94a3b8" : "#64748b" }}>
                      {group.offers.length} oferta{group.offers.length !== 1 ? "s" : ""} · media {group.avgScore}%
                    </div>
                  </div>
                  <span style={{ ...S.groupBadge, color: darkMode ? "#5eead4" : TEAL }}>
                    {group.counts.APLICA} APLICA
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {group.topOffers.map((offer) => {
                    const meta = RESULT_META[offer.resultado] || RESULT_META.NO_ENCAJA;
                    return (
                      <a
                        key={`${group.location}-${offer.id || offer.adzuna_id}`}
                        href={offer.redirect_url || "#"}
                        target={offer.redirect_url ? "_blank" : undefined}
                        rel={offer.redirect_url ? "noreferrer" : undefined}
                        style={{
                          ...S.groupOffer,
                          ...(darkMode ? S.groupOfferDark : {}),
                          textDecoration: "none",
                          cursor: offer.redirect_url ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...S.groupOfferTitle, color: darkMode ? "#f8fafc" : "#111827" }}>{offer.titulo}</div>
                            <div style={{ ...S.groupOfferMeta, color: darkMode ? "#94a3b8" : "#64748b" }}>
                              {offer.empresa} · {inferWorkMode(offer)}
                            </div>
                          </div>
                          <span style={{ ...S.scorePill, alignSelf: "flex-start", color: darkMode ? "#f8fafc" : "#111827" }}>
                            {offer.match_score ?? offer.puntuacion ?? 0}%
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 10 }}>
                          <span style={{ ...S.resultPill, backgroundColor: darkMode ? `${meta.color}22` : meta.bg, color: meta.color, border: `1px solid ${darkMode ? `${meta.color}44` : `${meta.color}22`}` }}>
                            {offer.resultado}
                          </span>
                          <span style={{ ...S.groupOfferMeta, color: darkMode ? "#64748b" : "#94a3af" }}>
                            {formatOfferAge(offer.fecha_publicacion)}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "clamp(16px, 4vw, 28px) clamp(12px, 3vw, 20px) 40px",
    fontFamily: typography.family,
  },
  pageDark: {
    backgroundColor: "#0f172a",
  },
  container: {
    maxWidth: 1240,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  heroCard: {
    borderRadius: 24,
    padding: "24px 24px 22px",
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  cardLight: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardDark: {
    backgroundColor: "#1e293b",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
  },
  kicker: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  heroTitle: {
    margin: "0 0 10px",
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    lineHeight: 1.08,
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    maxWidth: 760,
  },
  heroBadge: {
    minWidth: 140,
    borderRadius: 20,
    padding: "16px 18px",
    backgroundColor: "rgba(0,122,138,0.08)",
    border: "1px solid rgba(0,122,138,0.12)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeCount: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
  },
  heroBadgeLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 14,
  },
  metricCard: {
    borderRadius: 18,
    padding: "18px 18px 16px",
  },
  metricLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metricValue: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
    marginBottom: 10,
  },
  metricHint: {
    fontSize: 13,
    fontWeight: 700,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
    gap: 16,
  },
  sectionCard: {
    borderRadius: 20,
    padding: "20px 20px 18px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.65,
  },
  locationCard: {
    padding: "16px 16px 14px",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  locationCardDark: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  locationName: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  locationMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.5,
  },
  bestScoreBadge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(0,122,138,0.08)",
    border: "1px solid rgba(0,122,138,0.12)",
    whiteSpace: "nowrap",
  },
  distributionBar: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
    backgroundColor: "#e5e7eb",
  },
  locationStats: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  resultPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  offerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
  },
  offerRowDark: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  offerMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.55,
  },
  offerRowRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  scorePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
    padding: "7px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    fontSize: 12,
    fontWeight: 800,
  },
  groupColumn: {
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
  },
  groupColumnDark: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  groupMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.55,
  },
  groupBadge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(0,122,138,0.08)",
    border: "1px solid rgba(0,122,138,0.12)",
    whiteSpace: "nowrap",
  },
  groupOffer: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
    transition: `transform ${transition.fast}, box-shadow ${transition.fast}`,
  },
  groupOfferDark: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#1f2937",
  },
  groupOfferTitle: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  groupOfferMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.5,
  },
  emptyCard: {
    maxWidth: 520,
    margin: "80px auto 0",
    padding: "32px 28px",
    borderRadius: 22,
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 14,
    fontWeight: 900,
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    marginBottom: 14,
  },
  emptyTitle: {
    margin: "0 0 10px",
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
  },
};

if (typeof document !== "undefined" && !document.getElementById("locations-view-styles")) {
  const style = document.createElement("style");
  style.id = "locations-view-styles";
  style.textContent = `
    @media (max-width: 980px) {
      .locations-section-grid {
        grid-template-columns: 1fr !important;
      }
    }
    @media (max-width: 600px) {
      .locations-page-wrap {
        padding: 16px 12px 32px !important;
      }
      .locations-hero-card {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      .locations-hero-title {
        font-size: 24px !important;
      }
      .locations-section-title {
        font-size: 17px !important;
      }
    }
  `;
  document.head.appendChild(style);
}
