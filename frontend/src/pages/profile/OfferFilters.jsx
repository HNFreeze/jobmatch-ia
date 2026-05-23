import { typography } from "../../constants/theme";

const TEAL = "#00758A";

const S = {
  filterPanel: {
    width: 240,
    flexShrink: 0,
    padding: "20px 18px",
    borderRadius: 16,
    backgroundColor: "#fff",
    border: "1px solid #e8ecf1",
    height: "fit-content",
    position: "sticky",
    top: 80,
  },
  filterGroup: {
    marginBottom: 18,
  },
  filterLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 7,
    fontFamily: typography.family,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  filterInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: typography.family,
    backgroundColor: "#f8fafc",
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  },
  filterInputDm: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "#f1f5f9",
  },
};

/**
 * OfferFilters — desktop sidebar filter panel for the Profile results view.
 *
 * All filter state lives in Profile.jsx; this component is purely presentational
 * and receives state values + setters as props.
 *
 * Props:
 *  darkMode             — boolean
 *  userStack            — string[]
 *  keywordFilter        — string
 *  setKeywordFilter     — setter
 *  locationFilter       — string
 *  setLocationFilter    — setter
 *  contractFilter       — string
 *  setContractFilter    — setter
 *  workModeFilter       — string
 *  setWorkModeFilter    — setter
 *  sortBy               — string
 *  setSortBy            — setter
 *  salaryMin            — string
 *  setSalaryMin         — setter
 *  salaryMax            — string
 *  setSalaryMax         — setter
 *  onlyVerified         — boolean
 *  setOnlyVerified      — setter
 *  onlyDirectSources    — boolean
 *  setOnlyDirectSources — setter
 *  hideAggregators      — boolean
 *  setHideAggregators   — setter
 *  onlySalaryVisible    — boolean
 *  setOnlySalaryVisible — setter
 *  onlyJuniorFriendly   — boolean
 *  setOnlyJuniorFriendly — setter
 *  onClearFilters       — () => void  (called when "Limpiar filtros" is clicked)
 */
export default function OfferFilters({
  darkMode,
  userStack = [],
  keywordFilter,
  setKeywordFilter,
  locationFilter,
  setLocationFilter,
  contractFilter,
  setContractFilter,
  workModeFilter,
  setWorkModeFilter,
  sortBy,
  setSortBy,
  salaryMin,
  setSalaryMin,
  salaryMax,
  setSalaryMax,
  onlyVerified,
  setOnlyVerified,
  onlyDirectSources,
  setOnlyDirectSources,
  hideAggregators,
  setHideAggregators,
  onlySalaryVisible,
  setOnlySalaryVisible,
  onlyJuniorFriendly,
  setOnlyJuniorFriendly,
  onClearFilters,
}) {
  const dm = darkMode;

  return (
    <div style={{ ...S.filterPanel, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}) }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", fontFamily: typography.family }}>
          Filtros Avanzados
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: dm ? "#475569" : "#9ca3af", fontFamily: typography.family }}>
          Refina tu búsqueda IA
        </p>
      </div>

      {/* Keyword */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>🔍 Palabra clave</label>
        <input
          type="text"
          placeholder="Ej: React, Node, UX..."
          value={keywordFilter}
          onChange={e => setKeywordFilter(e.target.value)}
          style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
        />
      </div>

      {/* Location */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📍 Ubicación</label>
        <input
          type="text"
          placeholder="Madrid, Barcelona..."
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
        />
      </div>

      {/* Contract */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📄 Contrato</label>
        <select
          value={contractFilter}
          onChange={e => setContractFilter(e.target.value)}
          style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
        >
          <option value="todos">Cualquiera</option>
          <option value="indefinido">Indefinido</option>
          <option value="temporal">Temporal / Prácticas</option>
          <option value="freelance">Freelance</option>
        </select>
      </div>

      {/* Work mode */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>🏡 Modo de trabajo</label>
        <select
          value={workModeFilter}
          onChange={e => setWorkModeFilter(e.target.value)}
          style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
        >
          <option value="todos">Cualquiera</option>
          <option value="remoto">Remoto</option>
          <option value="hibrido">Hibrido</option>
          <option value="presencial">Presencial</option>
        </select>
      </div>

      {/* Sort */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📊 Ordenar por</label>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
        >
          <option value="relevancia">Relevancia</option>
          <option value="puntuacion">Puntuación</option>
          <option value="confianza">Confianza de la fuente</option>
          <option value="fecha">Más recientes</option>
          <option value="salario">Mayor salario</option>
        </select>
      </div>

      {/* Salary */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>💰 Salario</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="Min"
            value={salaryMin}
            onChange={e => setSalaryMin(e.target.value)}
            style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), flex: 1 }}
          />
          <input
            type="number"
            placeholder="Max"
            value={salaryMax}
            onChange={e => setSalaryMax(e.target.value)}
            style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), flex: 1 }}
          />
        </div>
      </div>

      {/* Quality checkboxes */}
      <div style={S.filterGroup}>
        <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>✨ Calidad de la oferta</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { checked: onlyVerified,      onChange: setOnlyVerified,      label: "Solo verificadas recientemente" },
            { checked: onlyDirectSources, onChange: setOnlyDirectSources, label: "Solo fuentes directas u oficiales" },
            { checked: hideAggregators,   onChange: setHideAggregators,   label: "Ocultar agregadas" },
            { checked: onlySalaryVisible, onChange: setOnlySalaryVisible, label: "Con salario visible" },
            { checked: onlyJuniorFriendly, onChange: setOnlyJuniorFriendly, label: "Junior o primer empleo" },
          ].map((item) => (
            <label
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: dm ? "#cbd5e1" : "#374151",
                fontFamily: typography.family,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                style={{ accentColor: TEAL, cursor: "pointer" }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tech Stack chips */}
      {userStack.length > 0 && (
        <div style={S.filterGroup}>
          <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>&lt;/&gt; Tech Stack</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {userStack.slice(0, 8).map(tech => (
              <span key={tech} style={{
                padding: "4px 12px", borderRadius: 20,
                fontSize: 12, fontWeight: 500,
                backgroundColor: dm ? "rgba(0,117,138,0.12)" : "rgba(0,117,138,0.06)",
                color: TEAL,
                border: `1px solid ${dm ? "rgba(0,117,138,0.25)" : "rgba(0,117,138,0.2)"}`,
                whiteSpace: "nowrap",
              }}>
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clear filters button */}
      <button
        style={{
          width: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600,
          color: dm ? "#94a3b8" : "#6b7280",
          backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
          border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
          borderRadius: 10,
          cursor: "pointer", fontFamily: typography.family, marginTop: 8,
        }}
        onClick={onClearFilters}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
