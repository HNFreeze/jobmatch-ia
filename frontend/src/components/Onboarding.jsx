import { useState, useEffect } from "react";
import { updateUserProfile } from "../services/api";
import { typography } from "../constants/theme";

const TEAL = "#00758A";

const TECH_STACKS = [
  { group: "Frontend", techs: ["React", "Vue", "Angular", "Next.js", "TypeScript", "JavaScript", "HTML/CSS", "Tailwind CSS", "Redux"] },
  { group: "Backend", techs: ["Python", "Node.js", "Java", "PHP", "Go", "Rust", "C#", "Django", "FastAPI", "Spring"] },
  { group: "Data / IA", techs: ["Machine Learning", "TensorFlow", "PyTorch", "Pandas", "SQL", "MongoDB", "PostgreSQL", "Redis", "Spark"] },
  { group: "DevOps / Cloud", techs: ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Linux", "Nginx"] },
  { group: "Mobile", techs: ["React Native", "Flutter", "Swift", "Kotlin", "Android", "iOS"] },
];

const MODALIDADES = [
  { id: "remoto", label: "🏠 Remoto" },
  { id: "presencial", label: "🏢 Presencial" },
  { id: "híbrido", label: "🔀 Híbrido" },
];

const CITIES = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga", "Toda España", "Internacional"];

const EXP_OPTIONS = [
  { value: "0", label: "Sin experiencia" },
  { value: "1", label: "1 año" },
  { value: "2", label: "2 años" },
  { value: "3", label: "3 años" },
  { value: "5", label: "5 años" },
  { value: "7", label: "7 años" },
  { value: "10+", label: "10+ años" },
];

const FEATURE_CARDS = [
  { icon: "⚡", title: "Matching IA", desc: "Analizamos miles de ofertas y te decimos cuáles encajan con tu perfil real.", color: TEAL, delay: "0s" },
  { icon: "📄", title: "CV inteligente", desc: "Mejora tu CV con IA y genera versiones adaptadas a cada oferta.", color: "#2563eb", delay: "0.1s" },
  { icon: "🎤", title: "Entrevistas simuladas", desc: "Practica con un entrevistador IA antes de enfrentarte al proceso real.", color: "#7c3aed", delay: "0.2s" },
];

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i < step ? `linear-gradient(90deg, ${TEAL}, #2563eb)` : "rgba(0,0,0,0.1)",
            marginRight: i < total - 1 ? 6 : 0,
            transition: "background 0.4s ease",
          }} />
        ))}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.1em",
        fontFamily: typography.family,
        textAlign: "right",
      }}>
        Paso {step} de {total}
      </div>
    </div>
  );
}

function TechChip({ tech, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 50,
        fontSize: 13,
        fontWeight: 600,
        border: `1.5px solid ${selected ? TEAL : "#e5e7eb"}`,
        background: selected ? `${TEAL}14` : "#fff",
        color: selected ? TEAL : "#4b5563",
        cursor: "pointer",
        transition: "all 0.15s ease",
        fontFamily: typography.family,
        transform: selected ? "scale(1.04)" : "scale(1)",
      }}
    >
      {selected ? "✓ " : ""}{tech}
    </button>
  );
}

export default function Onboarding({ onDismiss, darkMode, alias = "" }) {
  const dm = darkMode;
  const [step, setStep] = useState(1);
  const [stack, setStack] = useState([]);
  const [experience, setExperience] = useState("3");
  const [modalidad, setModalidad] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchTech, setSearchTech] = useState("");
  const [stackYears, setStackYears] = useState({});

  const TOTAL_STEPS = 4;

  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  function toggleTech(tech) {
    setStack(prev => {
      if (prev.includes(tech)) {
        setStackYears(y => { const n = { ...y }; delete n[tech]; return n; });
        return prev.filter(t => t !== tech);
      }
      setStackYears(y => y[tech] != null ? y : { ...y, [tech]: 1 });
      return [...prev, tech];
    });
  }

  function toggleModalidad(id) {
    setModalidad(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  function toggleCity(city) {
    setUbicaciones(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await updateUserProfile({
        stack,
        stack_years: stackYears,
        anos_experiencia: experience === "10+" ? 10 : parseInt(experience, 10),
        modalidad,
        ubicaciones,
        onboarding_completed: true,
      });
    } catch { /* non-critical */ }
    setSaving(false);
    onDismiss();
  }

  const filteredTechs = searchTech.trim()
    ? TECH_STACKS.flatMap(g => g.techs).filter(t => t.toLowerCase().includes(searchTech.toLowerCase()))
    : null;

  const bgCard = dm ? "#1e293b" : "#fff";
  const textMain = dm ? "#f1f5f9" : "#111827";
  const textSub = dm ? "#94a3b8" : "#6b7280";
  const borderColor = dm ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const firstName = alias ? alias.split(" ")[0] : "";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.65)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9000, padding: "20px 16px",
      fontFamily: typography.family,
    }}>
      <style>{`
        @keyframes ob-bounceIn {
          0%   { transform: scale(0) rotate(-8deg); opacity: 0; }
          55%  { transform: scale(1.22) rotate(6deg); opacity: 1; }
          80%  { transform: scale(0.93) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes ob-fadeSlideUp {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-glowPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(0,117,138,0.42); }
          50%       { box-shadow: 0 4px 36px rgba(0,117,138,0.8), 0 0 52px rgba(37,99,235,0.38); }
        }
        @keyframes ob-stepFade {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: bgCard,
        borderRadius: 24,
        padding: "36px 32px",
        maxWidth: 560,
        width: "100%",
        boxShadow: "0 32px 100px rgba(0,0,0,0.35)",
        transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
        opacity: visible ? 1 : 0,
        transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Header — progress bar hidden on welcome step */}
        <div style={{ flexShrink: 0 }}>
          {step > 1 && <ProgressBar step={step - 1} total={TOTAL_STEPS - 1} />}

          <div style={{ textAlign: "center", marginBottom: step === 1 ? 20 : 24 }}>
            <div style={{
              fontSize: 52, marginBottom: 12,
              display: "inline-block",
              animation: step === 1 ? "ob-bounceIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both" : undefined,
            }}>
              {step === 1 ? "🚀" : step === 2 ? "⚡" : step === 3 ? "🗺️" : "🎯"}
            </div>

            <h2 style={{
              margin: "0 0 8px",
              fontSize: step === 1 ? 26 : 24,
              fontWeight: 800,
              color: textMain,
              letterSpacing: "-0.02em",
              fontFamily: typography.family,
              animation: step === 1 ? "ob-fadeSlideUp 0.5s ease 0.22s both" : undefined,
            }}>
              {step === 1 && (firstName ? `¡Hola, ${firstName}!` : "¡Bienvenido/a a JobMatch!")}
              {step === 2 && "¿Con qué tecnologías trabajas?"}
              {step === 3 && "¿Cómo y dónde quieres trabajar?"}
              {step === 4 && "¡Todo listo para encontrar tu oferta!"}
            </h2>

            <p style={{
              margin: 0, fontSize: 14, color: textSub, lineHeight: 1.6,
              fontFamily: typography.family,
              animation: step === 1 ? "ob-fadeSlideUp 0.5s ease 0.34s both" : undefined,
            }}>
              {step === 1 && "Tu asistente de empleo con IA. Configuremos tu perfil en 2 minutos."}
              {step === 2 && "Selecciona tu stack. Cuantas más añadas, más preciso será el análisis."}
              {step === 3 && "Filtramos las ofertas a lo que realmente encaja con tu situación."}
              {step === 4 && "La IA ya conoce tu perfil. Aquí tienes lo que te espera."}
            </p>
          </div>
        </div>

        {/* Content — React key forces re-mount so animations replay on step change */}
        <div key={step} style={{ flex: 1, overflowY: "auto", marginBottom: 20, animation: "ob-stepFade 0.3s ease both" }}>

          {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {FEATURE_CARDS.map(card => (
                  <div key={card.title} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 16px", borderRadius: 14,
                    background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                    border: `1px solid ${borderColor}`,
                    animation: "ob-fadeSlideUp 0.45s ease both",
                    animationDelay: card.delay,
                  }}>
                    <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{card.icon}</span>
                    <div>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: card.color,
                        marginBottom: 3, fontFamily: typography.family,
                      }}>
                        {card.title}
                      </div>
                      <div style={{ fontSize: 13, color: textSub, lineHeight: 1.5, fontFamily: typography.family }}>
                        {card.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 50,
                background: dm ? "rgba(0,117,138,0.15)" : "rgba(0,117,138,0.08)",
                border: `1px solid ${dm ? "rgba(0,117,138,0.3)" : "rgba(0,117,138,0.2)"}`,
                fontSize: 12, fontWeight: 700, color: TEAL,
                fontFamily: typography.family,
                animation: "ob-fadeSlideUp 0.45s ease 0.33s both",
              }}>
                ⏱️ Solo 2 minutos de configuración
              </div>
            </div>
          )}

          {/* ── Step 2: Tech stack ──────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <input
                type="text"
                placeholder="🔍 Buscar tecnología..."
                value={searchTech}
                onChange={e => setSearchTech(e.target.value)}
                style={{
                  display: "block", width: "100%", boxSizing: "border-box",
                  padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                  border: `1.5px solid ${borderColor}`,
                  background: dm ? "rgba(255,255,255,0.05)" : "#f8fafc",
                  color: textMain, fontSize: 14, outline: "none",
                  fontFamily: typography.family,
                }}
              />

              {filteredTechs ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {filteredTechs.map(tech => (
                    <TechChip
                      key={tech} tech={tech}
                      selected={stack.includes(tech)}
                      onClick={() => toggleTech(tech)}
                    />
                  ))}
                  {searchTech.trim() &&
                    !stack.includes(searchTech.trim()) &&
                    !TECH_STACKS.flatMap(g => g.techs).some(t => t.toLowerCase() === searchTech.trim().toLowerCase()) && (
                    <button
                      onClick={() => { toggleTech(searchTech.trim()); setSearchTech(""); }}
                      style={{
                        padding: "6px 14px", borderRadius: 50, fontSize: 13, fontWeight: 600,
                        border: `1.5px dashed ${TEAL}`, background: "transparent", color: TEAL,
                        cursor: "pointer", transition: "all 0.15s ease", fontFamily: typography.family,
                      }}
                    >
                      + Añadir "{searchTech.trim()}"
                    </button>
                  )}
                </div>
              ) : (
                TECH_STACKS.map(group => (
                  <div key={group.group} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: textSub,
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
                    }}>
                      {group.group}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {group.techs.map(tech => (
                        <TechChip
                          key={tech} tech={tech}
                          selected={stack.includes(tech)}
                          onClick={() => toggleTech(tech)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}

              {stack.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: 10,
                    background: dm ? "rgba(0,117,138,0.12)" : "rgba(0,117,138,0.06)",
                    border: `1px solid ${dm ? "rgba(0,117,138,0.25)" : "rgba(0,117,138,0.15)"}`,
                    fontSize: 13, color: dm ? "#5eead4" : TEAL, fontWeight: 600,
                    marginBottom: 12,
                  }}>
                    ✓ {stack.length} tecnología{stack.length !== 1 ? "s" : ""} seleccionada{stack.length !== 1 ? "s" : ""}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: textSub, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    Años de experiencia por tecnología
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stack.map(tech => (
                      <div key={tech} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: textMain, width: 110, flexShrink: 0, fontFamily: typography.family, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tech}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[1, 2, 3, 5, "7+"].map(yr => (
                            <button
                              key={yr}
                              onClick={() => setStackYears(prev => ({ ...prev, [tech]: yr === "7+" ? 7 : yr }))}
                              style={{
                                padding: "3px 9px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                                border: `1.5px solid ${(stackYears[tech] ?? 1) === (yr === "7+" ? 7 : yr) ? TEAL : borderColor}`,
                                background: (stackYears[tech] ?? 1) === (yr === "7+" ? 7 : yr)
                                  ? (dm ? "rgba(0,117,138,0.2)" : "rgba(0,117,138,0.1)")
                                  : "transparent",
                                color: (stackYears[tech] ?? 1) === (yr === "7+" ? 7 : yr) ? TEAL : textSub,
                                cursor: "pointer", fontFamily: typography.family, transition: "all 0.12s ease",
                              }}
                            >
                              {yr}{typeof yr === "number" ? "a" : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Location & Modality ────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textSub, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Modalidad de trabajo
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {MODALIDADES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleModalidad(m.id)}
                      style={{
                        flex: 1, padding: "12px 8px", borderRadius: 12,
                        border: `2px solid ${modalidad.includes(m.id) ? TEAL : borderColor}`,
                        background: modalidad.includes(m.id)
                          ? (dm ? "rgba(0,117,138,0.15)" : "rgba(0,117,138,0.06)")
                          : (dm ? "rgba(255,255,255,0.03)" : "#fff"),
                        color: modalidad.includes(m.id) ? TEAL : textSub,
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        fontFamily: typography.family, textAlign: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textSub, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Ubicación
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CITIES.map(city => (
                    <button
                      key={city}
                      onClick={() => toggleCity(city)}
                      style={{
                        padding: "7px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${ubicaciones.includes(city) ? TEAL : borderColor}`,
                        background: ubicaciones.includes(city)
                          ? (dm ? "rgba(0,117,138,0.15)" : "rgba(0,117,138,0.06)")
                          : "transparent",
                        color: ubicaciones.includes(city) ? TEAL : textSub,
                        cursor: "pointer", fontFamily: typography.family,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {ubicaciones.includes(city) ? "✓ " : ""}{city}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textSub, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Años de experiencia
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {EXP_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setExperience(opt.value)}
                      style={{
                        padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${experience === opt.value ? "#7c3aed" : borderColor}`,
                        background: experience === opt.value
                          ? (dm ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.06)")
                          : "transparent",
                        color: experience === opt.value ? "#7c3aed" : textSub,
                        cursor: "pointer", fontFamily: typography.family,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Summary & CTA ───────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                {
                  icon: "⚡",
                  label: "Tu stack",
                  value: stack.length > 0
                    ? stack.slice(0, 4).join(", ") + (stack.length > 4 ? ` +${stack.length - 4}` : "")
                    : "Sin definir — puedes añadir más desde Mi perfil",
                  color: TEAL,
                },
                {
                  icon: "🕐",
                  label: "Experiencia",
                  value: EXP_OPTIONS.find(o => o.value === experience)?.label || experience + " años",
                  color: "#2563eb",
                },
                {
                  icon: "🏠",
                  label: "Modalidad",
                  value: modalidad.length > 0
                    ? modalidad.map(m => MODALIDADES.find(x => x.id === m)?.label || m).join(", ")
                    : "Sin preferencia (todas las modalidades)",
                  color: "#7c3aed",
                },
                {
                  icon: "📍",
                  label: "Ubicación",
                  value: ubicaciones.length > 0 ? ubicaciones.join(", ") : "Toda España",
                  color: "#f59e0b",
                },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "12px 16px", borderRadius: 12,
                  background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                  border: `1px solid ${borderColor}`,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: textSub, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textMain, marginTop: 2, lineHeight: 1.4 }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: dm ? "rgba(16,185,129,0.1)" : "#ecfdf5",
                border: `1px solid ${dm ? "rgba(16,185,129,0.2)" : "#a7f3d0"}`,
                fontSize: 14, color: dm ? "#34d399" : "#065f46",
                fontWeight: 600, lineHeight: 1.5,
              }}>
                🚀 Con este perfil, la IA analizará miles de ofertas reales y te dirá cuáles encajan. ¡Ya puedes empezar!
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ flexShrink: 0, display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={step === 1 ? onDismiss : () => setStep(s => s - 1)}
            style={{
              padding: "10px 20px", background: "none",
              border: `1px solid ${borderColor}`,
              borderRadius: 50, fontSize: 14, color: textSub,
              cursor: "pointer", fontFamily: typography.family,
            }}
          >
            {step === 1 ? "Saltar" : "← Atrás"}
          </button>

          <button
            onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleFinish}
            disabled={saving}
            style={{
              padding: "11px 28px",
              background: saving ? "#94a3b8" : `linear-gradient(135deg, ${TEAL}, #2563eb)`,
              border: "none", borderRadius: 50,
              fontSize: 14, fontWeight: 700, color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: typography.family,
              boxShadow: saving ? "none" : "0 4px 14px rgba(0,117,138,0.35)",
              transition: "all 0.2s ease",
              animation: (!saving && step === 1) ? "ob-glowPulse 2.5s ease-in-out 0.9s infinite" : undefined,
            }}
          >
            {saving ? "Guardando..." : step === 1 ? "Empezar →" : step < TOTAL_STEPS ? "Siguiente →" : "🚀 ¡Buscar mis ofertas!"}
          </button>
        </div>
      </div>
    </div>
  );
}
