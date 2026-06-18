import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { agentSearch, confirmAgentRun, getAgentRuns, getAgentRun } from "../services/api";
import { palette } from "../constants/theme";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Select from "../components/ui/Select";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import AgentTimeline from "../components/ui/AgentTimeline";
import CompatibilityIndicator from "../components/ui/CompatibilityIndicator";

const SORTS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "compatibilidad", label: "Compatibilidad" },
  { value: "empresa", label: "Empresa (A-Z)" },
];

// Buscar oportunidades — búsqueda asistida (no chat). El usuario describe su
// objetivo; el sistema interpreta, filtra y prioriza con evidencia, y el usuario
// decide qué guardar. La IA es el motor, no el protagonista visual.

const EXAMPLES = [
  "Ofertas junior de React en Madrid o remoto, publicadas en los últimos 7 días",
  "Posiciones senior de Python y FastAPI en remoto con salario mayor que 40000",
  "Empleos de Go o Rust, modalidad híbrida, en Barcelona",
];

const RESULT_TONE = { APLICA: "aplica", "QUIZÁ": "quiza", NO_ENCAJA: "no_encaja" };
const RESULT_LABEL = { APLICA: "Encaje alto", "QUIZÁ": "Encaje parcial", NO_ENCAJA: "Encaje bajo" };

const STYLE_ID = "agent-search-responsive";
const RESPONSIVE_CSS = `
  .ag-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; }
  .ag-detail-col { position: sticky; top: 16px; }
  @media (max-width: 920px) {
    .ag-grid { grid-template-columns: 1fr; }
    .ag-detail-col { position: static; display: none; }
    .ag-detail-col.open { display: block; }
    .ag-list-col.hidden-mobile { display: none; }
    .ag-detail-col-back { display: block !important; }
  }
  .ag-row:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .ag-anim { transition: none !important; } }
`;

function Criteria({ filters, dm }) {
  if (!filters) return null;
  const chips = [];
  (filters.roles || []).forEach(r => chips.push(["Rol", r]));
  (filters.skills || []).forEach(s => chips.push(["Skill", s]));
  (filters.locations || []).forEach(l => chips.push(["Ubicación", l]));
  (filters.seniority || []).forEach(s => chips.push(["Nivel", s]));
  if (filters.remote_allowed) chips.push(["Modalidad", "remoto"]);
  if (filters.salary_min) chips.push(["Salario", `≥ ${filters.salary_min.toLocaleString("es-ES")} €`]);
  if (filters.max_age_days) chips.push(["Antigüedad", `≤ ${filters.max_age_days} días`]);
  if (chips.length === 0) chips.push(["Criterio", "tu perfil"]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map(([k, v], i) => (
        <Badge key={i} dm={dm} tone="info" style={{ marginRight: 0 }}>
          <span style={{ opacity: 0.7 }}>{k}:</span> {v}
        </Badge>
      ))}
    </div>
  );
}

function Evidence({ offer, dm }) {
  const t = palette(dm);
  const block = (items, color, mark, label) =>
    items && items.length > 0 ? (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 4 }}>{label}</div>
        {items.map((x, i) => (
          <div key={i} style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55, display: "flex", gap: 6 }}>
            <span aria-hidden="true" style={{ color, fontWeight: 800 }}>{mark}</span>
            <span>{x}</span>
          </div>
        ))}
      </div>
    ) : null;
  return (
    <>
      {block(offer.strengths, t.positive, "✓", "Coincidencias")}
      {block(offer.gaps, t.warning, "△", "A revisar")}
      {block(offer.blockers, t.danger, "✕", "Bloqueantes")}
    </>
  );
}

export default function AgentSearch({ addToast, darkMode: dm, onNavigate }) {
  const t = palette(dm);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showProcess, setShowProcess] = useState(false);
  const [sortBy, setSortBy] = useState("relevancia");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detailHeadingRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = RESPONSIVE_CSS;
    document.head.appendChild(el);
  }, []);

  const loadHistory = useCallback(() => {
    getAgentRuns().then(d => setHistory(d.runs || [])).catch(() => {});
  }, []);

  // Restore the most recent run from PostgreSQL on mount, so the last search
  // persists across navigation between sections and across page reloads
  // (state of record lives in the DB — never in localStorage).
  useEffect(() => {
    let cancelled = false;
    getAgentRuns().then(async (d) => {
      const runs = d?.runs || [];
      if (cancelled) return;
      setHistory(runs);
      if (runs.length === 0) return;
      const full = await getAgentRun(runs[0].id).catch(() => null);
      if (cancelled || !full?.run) return;
      setRun((prev) => prev ?? full.run);
      const first = (full.run.results || [])[0];
      if (first) setActiveId((prev) => prev ?? (first.adzuna_id || first.id));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Close the mobile detail panel with Escape.
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") setActiveId(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runSearch = useCallback(async (text) => {
    const value = (typeof text === "string" ? text : instruction).trim();
    if (value.length < 3) {
      addToast("Describe qué oportunidades buscas.", "error");
      return;
    }
    setLoading(true);
    setRun(null);
    setSelected(new Set());
    setActiveId(null);
    try {
      const data = await agentSearch(value);
      setRun(data.run);
      const first = (data.run.results || [])[0];
      if (first) setActiveId(first.adzuna_id || first.id);
      if (!data.run.result_count) addToast("No se encontraron oportunidades para esos criterios.", "info");
      loadHistory();
    } catch (err) {
      addToast(err?.detail || err?.message || "No se pudo completar la búsqueda", "error");
    } finally {
      setLoading(false);
    }
  }, [instruction, addToast, loadHistory]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirmSelection() {
    if (!run || selected.size === 0) {
      addToast("Selecciona al menos una oportunidad para guardar.", "error");
      return;
    }
    setConfirming(true);
    try {
      const data = await confirmAgentRun(run.id, [...selected]);
      addToast(`${data.saved} oportunidad(es) guardada(s).`, "success");
      setRun(data.run); // backend confirms before we show success
      setConfirmOpen(false);
    } catch (err) {
      if (err?.status === 409) { addToast("Esta propuesta ya se había procesado.", "info"); setConfirmOpen(false); }
      else addToast(err?.detail || err?.message || "No se pudo guardar la selección", "error");
    } finally {
      setConfirming(false);
    }
  }

  const filters = run?.interpreted_filters;
  const results = useMemo(() => run?.results || [], [run]);
  // Client-side, deterministic ordering (no AI). Default keeps the engine order.
  const sortedResults = useMemo(() => {
    const arr = [...results];
    if (sortBy === "compatibilidad") arr.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
    else if (sortBy === "empresa") arr.sort((a, b) => (a.empresa || "").localeCompare(b.empresa || "", "es"));
    return arr;
  }, [results, sortBy]);
  const isWaiting = run?.state === "WAITING_FOR_USER";
  const isCompleted = run?.state === "COMPLETED";
  const active = results.find(o => (o.adzuna_id || o.id) === activeId) || null;
  // Caso frecuente: hay resultados pero ninguno con buen encaje. En vez de un muro
  // confuso de "NO ENCAJA", lo explicamos y guiamos al usuario.
  const strongCount = results.filter(o => o.resultado === "APLICA" || o.resultado === "QUIZÁ").length;
  const noStrongMatch = results.length > 0 && strongCount === 0;

  function openDetail(id) {
    setActiveId(id);
    setTimeout(() => detailHeadingRef.current?.focus?.(), 0);
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: "28px 16px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <PageHeader
          eyebrow="Búsqueda asistida"
          title="Buscar oportunidades"
          subtitle="Describe lo que buscas en lenguaje natural. El sistema interpreta tus criterios, descarta lo irrelevante y prioriza con evidencia. Tú decides qué guardar."
          dm={dm}
        />

        {/* Search bar — se siente como un buscador avanzado, no como un chat */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: dm ? "none" : "0 1px 3px rgba(0,0,0,0.06)" }}>
          <label htmlFor="ag-instruction" style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "block", marginBottom: 8 }}>
            ¿Qué oportunidades buscas?
          </label>
          <textarea
            id="ag-instruction"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runSearch(); }}
            placeholder="Ej. Ofertas junior de React en Madrid o remoto, publicadas en los últimos 7 días"
            rows={2}
            maxLength={1500}
            className="ag-anim"
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, fontSize: 15,
              border: `1.5px solid ${t.borderStrong}`, background: t.surface, color: t.text,
              resize: "vertical", fontFamily: "inherit", outline: "none", transition: "border-color 0.18s ease",
            }}
            onFocus={e => (e.target.style.borderColor = t.primary)}
            onBlur={e => (e.target.style.borderColor = t.borderStrong)}
          />
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>Ejemplos:</span>
            {EXAMPLES.map(ex => (
              <button key={ex} type="button" onClick={() => setInstruction(ex)}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary }}>
                {ex.length > 46 ? ex.slice(0, 46) + "…" : ex}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={() => runSearch()} disabled={loading} dm={dm}>
              {loading ? "Procesando…" : "Buscar oportunidades"}
            </Button>
            <Button variant="secondary" dm={dm} disabled={loading}
              onClick={() => runSearch("Ofertas que encajen con mi perfil profesional")}>
              Usar mi perfil
            </Button>
            <span style={{ fontSize: 12, color: t.textMuted }}>⌘/Ctrl + Enter</span>
          </div>
        </div>

        {/* Recientes — solo si no hay run activo. Reutiliza criterios sin gastar IA. */}
        {!run && !loading && history.length > 0 && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Búsquedas recientes</div>
            {history.slice(0, 6).map(h => (
              <button key={h.id} type="button" onClick={() => setInstruction(h.raw_instruction)}
                style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12, textAlign: "left",
                  padding: "9px 0", border: "none", borderBottom: `1px solid ${t.border}`, background: "transparent", cursor: "pointer" }}>
                <span style={{ fontSize: 13.5, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.raw_instruction}</span>
                <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0 }}>{h.result_count} · {h.state === "COMPLETED" ? "guardada" : h.state === "WAITING_FOR_USER" ? "pendiente" : h.state.toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
            <LoadingState label="El sistema está interpretando, buscando y priorizando oportunidades…" dm={dm} />
          </div>
        )}

        {run && !loading && (
          <>
            {/* Resumen del proceso (criterios + métricas + timeline plegable) */}
            <div role="status" aria-live="polite" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                    Criterios interpretados
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginLeft: 8 }}>
                      ({run.interpretation_source === "ai" ? "interpretación validada" : run.interpretation_source === "user_corrected" ? "ajustado por ti" : "reglas deterministas"})
                    </span>
                  </div>
                  <Criteria filters={filters} dm={dm} />
                </div>
              </div>

              {run.explanation && (
                <p style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.55, margin: "14px 0 0" }}>{run.explanation}</p>
              )}

              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5, color: t.textMuted }}>
                <span>Encontradas <strong style={{ color: t.text }}>{run.offers_found}</strong></span>
                <span>Descartadas sin IA <strong style={{ color: t.text }}>{run.offers_discarded_prefilter}</strong></span>
                <span>Analizadas <strong style={{ color: t.text }}>{run.offers_analyzed}</strong></span>
                <span>Llamadas a IA <strong style={{ color: t.text }}>{run.ai_calls}</strong></span>
                <button type="button" onClick={() => setShowProcess(v => !v)}
                  aria-expanded={showProcess}
                  style={{ marginLeft: "auto", border: "none", background: "transparent", color: t.primary, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {showProcess ? "Ocultar proceso" : "Ver proceso del agente"}
                </button>
              </div>

              {showProcess && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
                  <AgentTimeline steps={run.step_log} currentState={run.state} dm={dm} />
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <EmptyState
                dm={dm}
                title="Sin oportunidades para estos criterios"
                description="Prueba a ampliar la ubicación, reducir el salario mínimo o quitar el filtro de antigüedad."
              />
            ) : (
              <>
                {/* Barra de acción (human-in-the-loop) */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    {results.length} oportunidades priorizadas
                    {selected.size > 0 && <span style={{ color: t.textMuted, fontWeight: 500 }}> · {selected.size} seleccionada(s)</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: t.textMuted }}>Ordenar:</span>
                    <Select value={sortBy} onChange={setSortBy} options={SORTS} ariaLabel="Ordenar resultados" dm={dm} />
                    {isWaiting && (
                      <Button variant="success" dm={dm} disabled={selected.size === 0} onClick={() => setConfirmOpen(true)}>
                        Guardar selección
                      </Button>
                    )}
                    {isCompleted && (
                      <Button variant="secondary" dm={dm} onClick={() => onNavigate && onNavigate("favoritos")}>
                        Ver en Favoritos
                      </Button>
                    )}
                  </div>
                </div>

                {noStrongMatch && (
                  <div role="note" style={{
                    background: dm ? "#2a1e05" : "#fffbeb",
                    border: `1px solid ${dm ? "#7c5e1e" : "#fde68a"}`,
                    borderRadius: 12, padding: "12px 14px", marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: dm ? "#fcd34d" : "#92400e" }}>
                      Aún no hay ofertas con buen encaje para estos criterios
                    </div>
                    <p style={{ fontSize: 13, color: t.textSecondary, margin: "6px 0 0", lineHeight: 1.5 }}>
                      Te mostramos las más cercanas. Para mejorar los resultados: amplía la ubicación, quita el filtro de antigüedad, ajusta las skills, o{" "}
                      <button type="button" onClick={() => onNavigate && onNavigate("user-profile")}
                        style={{ background: "none", border: "none", padding: 0, color: t.primary, fontWeight: 600, cursor: "pointer", font: "inherit" }}>
                        completa tu perfil
                      </button>.
                    </p>
                  </div>
                )}

                <div className="ag-grid">
                  {/* Lista densa */}
                  <div className={`ag-list-col${active ? " hidden-mobile" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sortedResults.map(o => {
                      const id = o.adzuna_id || o.id;
                      const isActive = id === activeId;
                      const isSel = selected.has(o.adzuna_id);
                      return (
                        <div key={id} className="ag-row" role="button" tabIndex={0}
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => openDetail(id)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(id); } }}
                          style={{
                            display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                            border: `1px solid ${isActive ? t.primary : t.border}`,
                            borderLeft: `3px solid ${isSel ? t.positive : isActive ? t.primary : "transparent"}`,
                            borderRadius: 10, padding: "11px 13px", background: isActive ? t.surfaceHover : t.surface,
                          }}>
                          {isWaiting && (
                            <input type="checkbox" checked={isSel} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(o.adzuna_id)}
                              aria-label={`Seleccionar ${o.titulo}`} style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                              <span style={{ fontWeight: 700, color: t.text, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.titulo}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: (RESULT_TONE[o.resultado] === "aplica" ? t.positive : RESULT_TONE[o.resultado] === "quiza" ? t.warning : t.danger), flexShrink: 0 }}>{o.puntuacion}%</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {o.empresa}{o.ubicacion ? ` · ${o.ubicacion}` : ""}{o.salario ? ` · ${o.salario}` : ""}
                            </div>
                            <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <Badge dm={dm} tone={RESULT_TONE[o.resultado] || "no_encaja"}>{RESULT_LABEL[o.resultado] || "Encaje bajo"}</Badge>
                              {o.skills_match?.[0] && <span style={{ fontSize: 12, color: t.textSecondary }}>✓ {o.skills_match[0]}</span>}
                              {o.skills_missing?.[0] && <span style={{ fontSize: 12, color: t.textMuted }}>· falta {o.skills_missing[0]}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Panel de detalle (progressive disclosure) */}
                  <div className={`ag-detail-col${active ? " open" : ""}`}>
                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
                      {!active ? (
                        <EmptyState dm={dm} compact title="Selecciona una oportunidad" description="Elige una de la lista para ver la explicación y los datos completos." />
                      ) : (
                        <>
                          <button type="button" onClick={() => setActiveId(null)}
                            className="ag-detail-col-back"
                            style={{ display: "none", border: "none", background: "transparent", color: t.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>
                            ← Volver a resultados
                          </button>
                          <h2 ref={detailHeadingRef} tabIndex={-1} style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: 0, outline: "none", lineHeight: 1.25 }}>{active.titulo}</h2>
                          <div style={{ fontSize: 13.5, color: t.textMuted, marginTop: 3 }}>
                            {active.empresa}{active.ubicacion ? ` · ${active.ubicacion}` : ""}
                          </div>
                          {active.salario && <div style={{ fontSize: 13.5, color: t.textSecondary, marginTop: 2 }}>{active.salario}</div>}

                          <div style={{ marginTop: 14 }}>
                            <CompatibilityIndicator score={active.puntuacion} dm={dm} />
                          </div>

                          {active.decision_reason && (
                            <p style={{ fontSize: 13.5, color: t.text, lineHeight: 1.55, margin: "14px 0 0" }}>{active.decision_reason}</p>
                          )}

                          <Evidence offer={active} dm={dm} />

                          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {isWaiting && (
                              <Button size="sm" variant={selected.has(active.adzuna_id) ? "secondary" : "primary"} dm={dm}
                                onClick={() => toggleSelect(active.adzuna_id)}>
                                {selected.has(active.adzuna_id) ? "Quitar de la selección" : "Añadir a la selección"}
                              </Button>
                            )}
                            {active.url && (
                              <a href={active.url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 13, color: t.primary, fontWeight: 600, alignSelf: "center", textDecoration: "none" }}>
                                Ver oferta original ↗
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Confirmación humana (human-in-the-loop), accesible vía Radix Dialog */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        dm={dm}
        title="Guardar oportunidades en Favoritos"
        description={`Se guardarán ${selected.size} oportunidad(es) en tu lista de Favoritos. Podrás organizarlas como candidaturas después.`}
        footer={[
          <Button key="c" variant="secondary" dm={dm} onClick={() => setConfirmOpen(false)}>Cancelar</Button>,
          <Button key="ok" variant="success" dm={dm} disabled={confirming} onClick={confirmSelection}>
            {confirming ? "Guardando…" : "Confirmar y guardar"}
          </Button>,
        ]}
      />
    </div>
  );
}
