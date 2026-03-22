import { useState, useEffect } from "react";
import { getFavorites, removeFavorite, createApplication } from "../services/api";
import {
  gradients,
  typography,
  transition,
} from "../constants/theme";
import CompanyLogo from "../components/CompanyLogo";

const RESULT_STYLES = {
  APLICA:    { bg: "#ecfdf5", border: "#10b981", label: "APLICA" },
  QUIZÁ:     { bg: "#fffbeb", border: "#f59e0b", label: "QUIZÁ" },
  NO_ENCAJA: { bg: "#fff1f2", border: "#f43f5e", label: "NO ENCAJA" },
};

export default function Favoritos({ addToast, darkMode }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    setLoading(true);
    try {
      const list = await getFavorites();
      setFavorites(list);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveFavorite(adzunaId) {
    try {
      await removeFavorite(adzunaId);
      setFavorites(prev => prev.filter(f => f.adzuna_id !== adzunaId));
      addToast?.("Oferta eliminada de favoritos", "info");
    } catch {
      // silent
    }
  }

  async function handleTrackOffer(offer) {
    try {
      await createApplication({
        adzuna_id: offer.adzuna_id,
        titulo: offer.titulo,
        empresa: offer.empresa,
        url: offer.url
      });
      addToast?.("Candidatura añadida al seguimiento", "success");
    } catch (err) {
      if (err.message.includes("Ya es") || err.message.includes("crear")) {
        addToast?.("Esta oferta ya está en tus candidaturas", "info");
      } else {
        addToast?.("Error al añadir candidatura", "error");
      }
    }
  }

  const dm = darkMode;

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div style={{ ...S.page, ...(dm ? S.dmPage : {}), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...S.emptyCard, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}) }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⭐</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", margin: "0 0 10px", fontFamily: typography.family }}>
            Aún no tienes favoritos
          </h2>
          <p style={{ fontSize: 15, color: dm ? "#94a3b8" : "#6b7280", marginBottom: 28, lineHeight: 1.6, fontFamily: typography.family }}>
            Cuando encuentres una oferta que te guste, pulsa ⭐ para guardarla aquí
          </p>
          <a
            href="#buscar"
            onClick={e => { e.preventDefault(); window.location.hash = "buscar"; }}
            style={S.btnPrimary}
          >
            Buscar ofertas →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.page, ...(dm ? S.dmPage : {}) }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 32px", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.02em", fontFamily: typography.family }}>
          Ofertas Favoritas
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: dm ? "#64748b" : "#6b7280", fontFamily: typography.family }}>
          {favorites.length} oferta{favorites.length !== 1 ? "s" : ""} guardada{favorites.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {favorites.map(offer => {
          const rs = RESULT_STYLES[offer.resultado_ia] || RESULT_STYLES.QUIZÁ;
          return (
            <div key={offer.adzuna_id} className="fav-card" style={{
              padding: "20px 24px", borderRadius: 16,
              backgroundColor: dm ? "#1e293b" : "#fff",
              border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
              borderLeft: `4px solid ${rs.border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex", gap: 16, alignItems: "flex-start",
            }}>
              <CompanyLogo
                name={offer.empresa}
                logoUrl={offer.company_logo_url}
                size={44}
                darkMode={dm}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1.35, fontFamily: typography.family }}>
                      {offer.titulo}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: dm ? "#64748b" : "#6b7280", fontFamily: typography.family }}>
                      {offer.empresa}
                    </p>
                  </div>

                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    backgroundColor: dm ? `${rs.border}22` : rs.bg,
                    color: rs.border, border: `1px solid ${rs.border}30`,
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: rs.border, display: "inline-block" }} />
                    {offer.resultado_ia || "N/A"}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <button
                    onClick={() => handleRemoveFavorite(offer.adzuna_id)}
                    style={{
                      padding: "6px 14px", fontSize: 12, fontWeight: 600, color: dm ? "#94a3b8" : "#6b7280",
                      backgroundColor: "transparent", border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#d1d5db"}`,
                      borderRadius: 8, cursor: "pointer", fontFamily: typography.family,
                    }}
                  >
                    Quitar favorito
                  </button>
                  {offer.url && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleTrackOffer(offer)}
                        style={{
                          padding: "6px 16px", fontSize: 12, fontWeight: 600, color: dm ? "#5eead4" : "#00758A",
                          backgroundColor: "transparent", border: `1px solid ${dm ? "rgba(94,234,212,0.3)" : "rgba(0,117,138,0.5)"}`,
                          borderRadius: 8, cursor: "pointer", fontFamily: typography.family,
                        }}
                      >
                        Seguir oferta
                      </button>
                      <a href={offer.url} target="_blank" rel="noopener noreferrer" style={{
                        padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff",
                        background: gradients.primary, textDecoration: "none", borderRadius: 8,
                        fontFamily: typography.family, boxShadow: "0 2px 6px rgba(37,99,235,0.2)",
                      }}>
                        Ver en Adzuna →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#f8f9fc",
    padding: "32px 24px",
    fontFamily: typography.family,
  },
  dmPage: { background: "#0f172a" },
  emptyCard: {
    textAlign: "center",
    backgroundColor: "#fff",
    padding: "56px 48px",
    borderRadius: 16,
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    maxWidth: 440,
    width: "100%",
  },
  btnPrimary: {
    display: "inline-block",
    padding: "10px 24px",
    background: gradients.primary,
    color: "white",
    textDecoration: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
    transition: `all ${transition.smooth}`,
    cursor: "pointer",
    fontFamily: typography.family,
  },
};

if (typeof document !== "undefined" && !document.getElementById("fav-styles")) {
  const s = document.createElement("style");
  s.id = "fav-styles";
  s.innerHTML = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .fav-card {
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1);
    }
    .fav-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important;
    }
  `;
  document.head.appendChild(s);
}
