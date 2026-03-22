import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colors, gradients, typography, spacing, shadow, transition } from "../constants/theme";

// Spanish city coordinates
const CITY_COORDS = {
  madrid: [40.4168, -3.7038],
  barcelona: [41.3851, 2.1734],
  valencia: [39.4699, -0.3763],
  sevilla: [37.3891, -5.9845],
  bilbao: [43.2630, -2.9350],
  málaga: [36.7213, -4.4214],
  zaragoza: [41.6488, -0.8891],
  murcia: [37.9922, -1.1307],
  alicante: [38.3452, -0.4810],
  valladolid: [41.6523, -4.7245],
  granada: [37.1773, -3.5986],
  "a coruña": [43.3623, -8.4115],
};

// Default center (Spain center)
const SPAIN_CENTER = [40.0, -3.5];

// Icon colors mapping
const ICON_COLORS = {
  APLICA: "#10b981",    // Green
  QUIZÁ: "#f59e0b",     // Amber
  NO_ENCAJA: "#f43f5e", // Rose
};

function createCustomIcon(color, count = null) {
  const badge = count && count > 3 ? `<div style="position: absolute; top: -8px; right: -8px; background: #e63946; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white;">${count}</div>` : '';
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <span style="font-size: 16px;">📌</span>
        ${badge}
      </div>
    `,
    iconSize: [32, 32],
    className: "custom-marker",
  });
}

function getCityCoordinates(location) {
  if (!location) return SPAIN_CENTER;
  const normalized = location.toLowerCase().trim();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(city)) {
      return coords;
    }
  }
  return SPAIN_CENTER;
}

export default function MapaOfertas({ analysisResults, darkMode }) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const offers = Array.isArray(analysisResults) ? analysisResults : (analysisResults?.offers || []);

  // Group offers by city and apply offset
  const groupedOffers = offers.map((offer, idx) => {
    const baseCoords = getCityCoordinates(offer.ubicacion);
    const city = offer.ubicacion || "unknown";
    const offersInCity = offers.filter(o => (o.ubicacion || "unknown") === city);
    const indexInCity = offersInCity.indexOf(offer);

    // Apply small random offset (±0.01 degrees ≈ 1km)
    const offsetLat = (Math.random() - 0.5) * 0.02;
    const offsetLng = (Math.random() - 0.5) * 0.02;

    return {
      ...offer,
      coords: [baseCoords[0] + offsetLat, baseCoords[1] + offsetLng],
      cityCount: offersInCity.length,
    };
  });

  const dmPage = darkMode ? { background: "#0f172a" } : {};
  const dmCard = darkMode ? { backgroundColor: "#1e293b" } : {};
  const dmText = darkMode ? { color: "#f1f5f9" } : {};

  if (offers.length === 0) {
    return (
      <div style={{ ...styles.emptyContainer, ...dmPage }}>
        <div style={{ ...styles.emptyCard, ...dmCard }}>
          <div style={styles.emptyIcon}>🗺️</div>
          <h2 style={{ ...styles.emptyTitle, ...dmText }}>Aún no hay ofertas en el mapa</h2>
          <p style={{ ...styles.emptySubtitle, ...(darkMode ? { color: "#94a3b8" } : {}) }}>
            Realiza un análisis de ofertas para verlas en el mapa interactivo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.pageWrapper, ...dmPage }}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={{ ...styles.title, ...dmText }}>Mapa de Ofertas de Trabajo</h1>
        <p style={{ ...styles.subtitle, ...(darkMode ? { color: "#94a3b8" } : {}) }}>
          {offers.length} oferta{offers.length !== 1 ? "s" : ""} del último análisis
        </p>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, backgroundColor: "#10b981" }} />
          <span>APLICA</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, backgroundColor: "#f59e0b" }} />
          <span>QUIZÁ</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, backgroundColor: "#f43f5e" }} />
          <span>NO ENCAJA</span>
        </div>
      </div>

      {/* Map + Side panel */}
      <div style={styles.mapWrapper}>
        <div style={styles.mapContainer}>
          <MapContainer
            center={SPAIN_CENTER}
            zoom={6}
            style={styles.map}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {groupedOffers.map((offer, idx) => {
              const iconColor = ICON_COLORS[offer.resultado] || "#8b5cf6";

              return (
                <Marker
                  key={idx}
                  position={offer.coords}
                  icon={createCustomIcon(iconColor, offer.cityCount > 3 ? offer.cityCount : null)}
                  eventHandlers={{
                    click: () => setSelectedMarker(idx),
                  }}
                >
                  <Popup>
                    <div style={styles.popupContent}>
                      <h3 style={styles.popupTitle}>{offer.titulo}</h3>
                      <p style={styles.popupCompany}>{offer.empresa}</p>
                      {offer.salario && (
                        <p style={styles.popupSalary}>💷 {offer.salario}</p>
                      )}
                      {offer.ubicacion && (
                        <p style={styles.popupLocation}>📍 {offer.ubicacion}</p>
                      )}
                      <div style={styles.popupResult}>
                        <span style={{
                          ...styles.resultBadge,
                          backgroundColor: ICON_COLORS[offer.resultado] || "#8b5cf6",
                        }}>
                          {offer.resultado}
                        </span>
                      </div>
                      <a
                        href={offer.redirect_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.detailButton}
                      >
                        Ver detalle
                      </a>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Side panel */}
        <div style={{ ...styles.sidePanel, ...dmCard }}>
          <h3 style={{ ...styles.sidePanelTitle, ...dmText }}>Resumen</h3>
          <div style={styles.sidePanelTotal}>
            <span style={{ fontSize: 36, fontWeight: 800, color: darkMode ? "#f1f5f9" : "#1e293b" }}>{offers.length}</span>
            <span style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#6b7280", marginTop: 2 }}>ofertas totales</span>
          </div>
          <div style={styles.sidePanelDivider} />
          {[
            { key: "APLICA",    color: "#10b981", label: "APLICA" },
            { key: "QUIZÁ",     color: "#f59e0b", label: "QUIZÁ" },
            { key: "NO_ENCAJA", color: "#f43f5e", label: "NO ENCAJA" },
          ].map(({ key, color, label }) => {
            const count = offers.filter(o => o.resultado === key).length;
            const pct = offers.length ? Math.round((count / offers.length) * 100) : 0;
            return (
              <div key={key} style={styles.sidePanelRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: darkMode ? "#94a3b8" : "#374151", letterSpacing: "0.04em" }}>{label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 800, color }}>{count}</span>
                </div>
                <div style={{ height: 5, backgroundColor: darkMode ? "#334155" : "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: darkMode ? "#64748b" : "#9ca3af", marginTop: 2, textAlign: "right" }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageWrapper: {
    minHeight: "100vh",
    background: gradients.page,
    padding: spacing.xl,
  },
  header: {
    maxWidth: 1200,
    margin: "0 auto 32px",
    textAlign: "center",
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  legend: {
    maxWidth: 1200,
    margin: "0 auto 24px",
    display: "flex",
    gap: 32,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: 500,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid white",
    boxShadow: shadow.card,
  },
  mapWrapper: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: shadow.elevated,
  },
  map: {
    width: "100%",
    height: "75vh",
    zIndex: 10,
  },
  sidePanel: {
    width: 200,
    flexShrink: 0,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    boxShadow: shadow.card,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  sidePanelTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
    margin: "0 0 12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  sidePanelTotal: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 16,
  },
  sidePanelDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    margin: "0 0 16px",
  },
  sidePanelRow: {
    marginBottom: 16,
  },
  emptyContainer: {
    minHeight: "100vh",
    background: gradients.page,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyCard: {
    textAlign: "center",
    backgroundColor: "white",
    padding: spacing.xl,
    borderRadius: 16,
    boxShadow: shadow.card,
    maxWidth: 400,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  popupContent: {
    padding: 8,
    minWidth: 250,
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: "0 0 6px",
    color: colors.text.primary,
  },
  popupCompany: {
    fontSize: 13,
    color: colors.text.secondary,
    margin: "0 0 8px",
    fontWeight: 500,
  },
  popupSalary: {
    fontSize: 12,
    color: "#059669",
    margin: "0 0 4px",
    fontWeight: 600,
  },
  popupLocation: {
    fontSize: 12,
    color: "#666",
    margin: "0 0 8px",
  },
  popupResult: {
    margin: "8px 0",
  },
  resultBadge: {
    display: "inline-block",
    color: "white",
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  detailButton: {
    display: "inline-block",
    marginTop: 8,
    padding: "6px 12px",
    backgroundColor: colors.primary,
    color: "white",
    textDecoration: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    transition: transition.smooth,
  },
};
