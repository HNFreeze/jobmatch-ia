import { useState, useEffect, useRef, useCallback } from "react";
import { startInterview, sendInterviewMessage, endInterview } from "../services/api";
import alexFace from "../assets/alex_face.jpg";

const TEAL = "#00758A";
const TEAL_DARK = "#0f766e";

// ── CSS Keyframes (inyectados una vez) ───────────────────────────────────────

const KEYFRAMES = `
@keyframes avatarPulse {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes mouthOpen {
  0%   { transform: translateX(-50%) scaleY(0.15) scaleX(0.8); opacity: 0.7; }
  40%  { transform: translateX(-50%) scaleY(1)    scaleX(1);   opacity: 0.92; }
  100% { transform: translateX(-50%) scaleY(0.35) scaleX(0.9); opacity: 0.75; }
}
@keyframes waveBeat {
  0%   { transform: scaleY(0.25); }
  100% { transform: scaleY(1); }
}
@keyframes micPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(1.3); }
}
@keyframes msgSlideIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes thinkingDot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1; }
}
@keyframes scoreReveal {
  from { width: 0; }
  to   { width: var(--score-w); }
}
@keyframes floatIn {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bgPulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}
@keyframes speakingBorder {
  0%, 100% { box-shadow: 0 0 0 3px rgba(0,117,138,0.7), 0 12px 48px rgba(0,117,138,0.35); }
  50%      { box-shadow: 0 0 0 4px rgba(0,117,138,0.9), 0 12px 56px rgba(0,117,138,0.5); }
}
@keyframes listenBorder {
  0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.7), 0 12px 40px rgba(239,68,68,0.3); }
  50%      { box-shadow: 0 0 0 4px rgba(239,68,68,0.9), 0 12px 48px rgba(239,68,68,0.45); }
}
`;

// ── Avatar Component ──────────────────────────────────────────────────────────

function AlexAvatar({ isSpeaking, isListening, dm, size = 120 }) {
  // Scale factor — keeps all proportions relative to the base size
  const W = Math.max(size, 140);
  const H = Math.round(W * 1.18);

  const borderAnim = isSpeaking
    ? "speakingBorder 2s ease-in-out infinite"
    : isListening
    ? "listenBorder 1.2s ease-in-out infinite"
    : "none";

  const borderShadow = isSpeaking
    ? "0 0 0 3px rgba(0,117,138,0.8), 0 16px 52px rgba(0,117,138,0.4)"
    : isListening
    ? "0 0 0 3px rgba(239,68,68,0.8), 0 16px 40px rgba(239,68,68,0.35)"
    : "0 8px 32px rgba(0,0,0,0.28)";

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none" }}>

      {/* ── Video-call frame ─────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: W,
        height: H,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: borderShadow,
        animation: borderAnim,
        transition: "box-shadow 0.35s ease",
        flexShrink: 0,
      }}>

        {/* Office background (CSS only — blurred gradient suggesting a meeting room) */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          background: "linear-gradient(170deg, #d6cfc6 0%, #c8bfb2 35%, #b8b0a4 65%, #a8a098 100%)",
        }}>
          {/* Subtle window light from top-right */}
          <div style={{
            position: "absolute", top: "-20%", right: "-10%",
            width: "55%", height: "60%",
            background: "radial-gradient(ellipse, rgba(255,248,230,0.55) 0%, transparent 70%)",
            borderRadius: "50%",
          }}/>
          {/* Desk/table suggestion at bottom */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "22%",
            background: "linear-gradient(to top, rgba(90,75,60,0.35), transparent)",
          }}/>
        </div>

        {/* Face photo */}
        <img
          src={alexFace}
          alt="Alejandro - Entrevistador IA"
          style={{
            position: "relative", zIndex: 1,
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: "center 8%",
            display: "block",
          }}
        />

        {/* ── Mouth open overlay (speaking) ── */}
        {isSpeaking && (
          <div style={{
            position: "absolute", zIndex: 2,
            bottom: "20%",
            left: "50%",
            width: "22%",
            height: "6%",
            background: "radial-gradient(ellipse, rgba(10,5,3,0.82) 50%, rgba(30,15,8,0.45) 100%)",
            borderRadius: "50%",
            animation: "mouthOpen 0.21s ease-in-out infinite alternate",
            transformOrigin: "center center",
          }}/>
        )}

        {/* ── Listening badge (bottom of frame) ── */}
        {isListening && !isSpeaking && (
          <div style={{
            position: "absolute", zIndex: 3,
            bottom: 10, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px",
            background: "rgba(185,28,28,0.88)",
            borderRadius: 20,
            backdropFilter: "blur(4px)",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white", animation: "micPulse 0.85s ease-in-out infinite" }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: "white", fontFamily: "system-ui, sans-serif", letterSpacing: "0.03em" }}>
              Escuchando…
            </span>
          </div>
        )}

        {/* ── Name tag (bottom-left, always visible) ── */}
        <div style={{
          position: "absolute", zIndex: 3,
          bottom: 8, left: 10,
          padding: "3px 9px",
          background: "rgba(0,0,0,0.52)",
          borderRadius: 8,
          backdropFilter: "blur(6px)",
          color: "white",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.02em",
        }}>
          Alejandro
        </div>

        {/* ── Speaking: subtle teal overlay glow ── */}
        {isSpeaking && (
          <div style={{
            position: "absolute", zIndex: 2, inset: 0,
            background: "radial-gradient(ellipse at 50% 100%, rgba(0,117,138,0.12) 0%, transparent 65%)",
            pointerEvents: "none",
          }}/>
        )}
      </div>

      {/* ── Audio wave bars (speaking) ── */}
      {isSpeaking && (
        <div style={{ display: "flex", gap: 3, alignItems: "center", height: 20, marginTop: 10 }}>
          {[0.65, 1.05, 0.55, 1.25, 0.75, 0.95, 0.5].map((dur, i) => (
            <div key={i} style={{
              width: 3, height: "100%", backgroundColor: TEAL, borderRadius: 2,
              animation: `waveBeat ${dur}s ease-in-out ${i * 0.09}s infinite alternate`,
            }}/>
          ))}
        </div>
      )}

      {/* Idle / listening spacer */}
      {!isSpeaking && <div style={{ height: 20 }}/>}

      {/* ── Role badge ── */}
      <div style={{
        marginTop: 6, padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: dm ? "rgba(0,117,138,0.2)" : "rgba(0,117,138,0.1)",
        color: dm ? "#5eead4" : TEAL,
        border: `1px solid ${dm ? "rgba(94,234,212,0.25)" : "rgba(0,117,138,0.2)"}`,
        fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em",
      }}>
        Alejandro · Entrevistador IA
      </div>
    </div>
  );
}

// ── Thinking dots ─────────────────────────────────────────────────────────────

function ThinkingDots({ dm }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "12px 16px" }}>
      {[0, 0.18, 0.36].map(delay => (
        <div key={delay} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: dm ? "#5eead4" : TEAL,
          animation: `thinkingDot 1.2s ease-in-out ${delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

// ── Feedback Panel ────────────────────────────────────────────────────────────

function FeedbackPanel({ feedback, dm, onClose }) {
  if (!feedback) return null;
  const score = feedback.puntuacion_general || 0;
  const scoreColor = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: dm ? "#0f172a" : "#fff",
        border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
        borderRadius: 20, padding: "32px 28px", maxWidth: 500, width: "100%",
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        animation: "msgSlideIn 0.3s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", margin: 0, fontFamily: "system-ui, sans-serif" }}>
            Resultado de la entrevista
          </h2>
        </div>

        {/* Score */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
          borderRadius: 14, padding: "18px 24px", marginBottom: 20,
          border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
        }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: scoreColor, fontFamily: "system-ui, sans-serif", lineHeight: 1 }}>
            {score}<span style={{ fontSize: 22, fontWeight: 600, color: dm ? "#64748b" : "#94a3b8" }}>/10</span>
          </span>
          <div style={{ width: "100%", height: 8, background: dm ? "#1e293b" : "#e5e7eb", borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4, background: scoreColor,
              width: `${score * 10}%`, transition: "width 1s ease 0.3s",
            }}/>
          </div>
          {feedback.resumen && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: dm ? "#94a3b8" : "#6b7280", textAlign: "center", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
              {feedback.resumen}
            </p>
          )}
        </div>

        {feedback.puntos_fuertes?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>✓ Puntos fuertes</p>
            {feedback.puntos_fuertes.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ color: "#10b981", fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{p}</span>
              </div>
            ))}
          </div>
        )}

        {feedback.areas_mejora?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>△ Áreas de mejora</p>
            {feedback.areas_mejora.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ color: "#f59e0b", fontSize: 14, flexShrink: 0, marginTop: 1 }}>△</span>
                <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{a}</span>
              </div>
            ))}
          </div>
        )}

        {feedback.consejos?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: TEAL, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>💡 Consejos</p>
            {feedback.consejos.map((c, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: 8,
                background: dm ? "rgba(0,117,138,0.1)" : "rgba(0,117,138,0.05)",
                border: `1px solid ${dm ? "rgba(0,117,138,0.2)" : "rgba(0,117,138,0.12)"}`,
              }}>
                <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "13px", borderRadius: 12, border: "none",
            background: TEAL, color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "system-ui, sans-serif",
            boxShadow: "0 4px 14px rgba(0,117,138,0.35)",
          }}
        >
          Volver a candidaturas
        </button>
      </div>
    </div>
  );
}

// ── Main Interview Page ───────────────────────────────────────────────────────

export default function Interview({ darkMode, jobTitle, company, applicationId, onExit }) {
  const dm = darkMode;

  const [phase, setPhase]             = useState("ready"); // ready | starting | active | finished
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking]   = useState(false);
  const [voiceMode, setVoiceMode]     = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [feedback, setFeedback]       = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError]             = useState(null);

  // Audio via Web Audio API (desbloqueado por gesto del usuario en handleBegin)
  const audioCtxRef    = useRef(null);
  const audioSrcRef    = useRef(null);   // BufferSourceNode activo
  const recognitionRef = useRef(null);
  const manualStopRef  = useRef(false);  // true = el usuario pulsó parar (no reanudar)
  const voiceBaseRef   = useRef("");     // texto acumulado entre reanudaciones
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const sessionIdRef   = useRef(null);

  // Inject CSS keyframes once
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "interview-keyframes";
    el.textContent = KEYFRAMES;
    if (!document.getElementById("interview-keyframes")) document.head.appendChild(el);
    return () => { const s = document.getElementById("interview-keyframes"); if (s) s.remove(); };
  }, []);

  // Check voice support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []); // eslint-disable-line

  // ── Audio playback (Web Audio API) ─────────────────────────────────────────

  function stopAudio() {
    if (audioSrcRef.current) {
      try { audioSrcRef.current.stop(); } catch {}
      audioSrcRef.current = null;
    }
    // Cancela también la voz del navegador (Web Speech API).
    try { window.speechSynthesis?.cancel(); } catch {}
    setIsSpeaking(false);
  }

  // Voz del entrevistador con la Web Speech API del navegador (coste 0).
  // Se usa cuando el backend no devuelve audio (ElevenLabs desactivado por defecto).
  function speakWithBrowser(text) {
    const synth = window.speechSynthesis;
    const clean = (text || "").trim();
    if (!synth || !clean) { setIsSpeaking(false); return; }
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = "es-ES";
      utter.rate = 1.0;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      synth.speak(utter);
    } catch {
      setIsSpeaking(false);
    }
  }

  // Reproduce la respuesta: audio de ElevenLabs si viene, si no voz del navegador.
  async function speakResponse(data) {
    if (data?.audio_b64) await playAudio(data.audio_b64);
    else speakWithBrowser(data?.text);
  }

  async function playAudio(b64) {
    const ctx = audioCtxRef.current;
    if (!ctx || !b64) return;
    stopAudio();
    try {
      // Decodificar base64 → ArrayBuffer
      const raw = atob(b64);
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);

      // Asegurarse de que el contexto está activo
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(buf.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => { setIsSpeaking(false); audioSrcRef.current = null; };
      audioSrcRef.current = source;
      setIsSpeaking(true);
      source.start(0);
    } catch (e) {
      console.warn("[Interview] Audio error:", e);
      setIsSpeaking(false);
    }
  }

  // ── Comenzar entrevista (click del usuario = gesto = AudioContext desbloqueado) ──

  async function handleBegin() {
    // Crear AudioContext dentro del evento click para desbloquear autoplay
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      await ctx.resume();
      audioCtxRef.current = ctx;
    }

    setPhase("starting");
    try {
      const data = await startInterview({
        job_title: jobTitle,
        company: company || "",
        application_id: applicationId || null,
      });
      sessionIdRef.current = data.session_id;
      setMessages([{ role: "assistant", text: data.text }]);
      setPhase("active");
      await speakResponse(data);
      if (data.is_final) handleFinish(data.session_id);
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo iniciar la entrevista.");
      setPhase("error");
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isThinking || isSpeaking || !sessionIdRef.current) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setIsThinking(true);
    stopAudio();

    try {
      const data = await sendInterviewMessage(sessionIdRef.current, text);
      setMessages(prev => [...prev, { role: "assistant", text: data.text }]);
      await speakResponse(data);
      if (data.is_final) handleFinish(sessionIdRef.current);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Lo siento, ha ocurrido un error. ¿Podrías repetir tu respuesta?" }]);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, isSpeaking]); // eslint-disable-line

  // ── Finish & feedback ────────────────────────────────────────────────────────

  async function handleFinish(sid) {
    setPhase("finished");
    setLoadingFeedback(true);
    try {
      const data = await endInterview(sid);
      setFeedback(data.feedback);
    } catch {
      setFeedback({ puntuacion_general: 0, resumen: "No se pudo generar el feedback.", puntos_fuertes: [], areas_mejora: [], consejos: [] });
    } finally {
      setLoadingFeedback(false);
    }
  }

  // ── Voice input ──────────────────────────────────────────────────────────────

  function toggleVoice() {
    if (isListening) {
      // Parada manual: marcamos para que onend NO reinicie la escucha.
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "es-ES";
    rec.continuous = true;       // sigue escuchando hasta que el usuario pulsa parar
    rec.interimResults = true;   // muestra el texto en tiempo real mientras habla
    manualStopRef.current = false;
    // Lo ya escrito es la base; el texto final reconocido se va acumulando ahí
    // (en un ref) para no perderlo cuando Chrome corta y reanudamos la escucha.
    voiceBaseRef.current = input.trim() ? input.trim() + " " : "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          voiceBaseRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      // No se envía: se vuelca en el cuadro de texto como si lo hubiese escrito,
      // para que pueda corregir o añadir antes de enviar.
      setInput((voiceBaseRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e) => {
      // Sin permiso de micrófono no tiene sentido reintentar.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        manualStopRef.current = true;
        setIsListening(false);
      }
    };
    rec.onend = () => {
      // Chrome corta tras un silencio aunque continuous=true: reanudamos
      // mientras el usuario no haya pulsado parar.
      if (manualStopRef.current) {
        setIsListening(false);
        return;
      }
      try { rec.start(); } catch { setIsListening(false); }
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { setIsListening(false); return; }
    setIsListening(true);
    stopAudio();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const bg = dm ? "#0f172a" : "#f8fafc";

  // ── Pantalla de error ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ fontSize: 15, color: "#ef4444", fontFamily: "system-ui, sans-serif", textAlign: "center", maxWidth: 340 }}>{error}</p>
        <button onClick={onExit} style={{ padding: "10px 28px", borderRadius: 10, background: TEAL, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
          Volver
        </button>
      </div>
    );
  }

  // ── Pantalla de inicio (gesto del usuario → desbloquea AudioContext) ─────────
  if (phase === "ready") {
    return (
      <div style={{
        minHeight: "100vh", background: bg,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 32, padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
        animation: "floatIn 0.5s ease",
      }}>
        <AlexAvatar isSpeaking={false} isListening={false} dm={dm} size={140}/>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", margin: "0 0 8px" }}>
            Entrevista para {jobTitle}
          </h2>
          {company && (
            <p style={{ fontSize: 14, color: dm ? "#94a3b8" : "#6b7280", margin: "0 0 6px" }}>{company}</p>
          )}
          <p style={{ fontSize: 13, color: dm ? "#64748b" : "#9ca3af", margin: 0 }}>
            Alex te hará preguntas y evaluará tus respuestas. Puedes usar texto o voz.
          </p>
        </div>
        <button
          onClick={handleBegin}
          style={{
            padding: "14px 40px", borderRadius: 50, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
            color: "#fff", fontSize: 16, fontWeight: 800,
            boxShadow: "0 6px 24px rgba(0,117,138,0.45)",
            fontFamily: "system-ui, sans-serif", letterSpacing: "0.01em",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(0,117,138,0.55)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,117,138,0.45)"; }}
        >
          ▶ Comenzar entrevista
        </button>
        <button
          onClick={onExit}
          style={{ padding: "8px 20px", borderRadius: 20, border: `1px solid ${dm ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, background: "none", cursor: "pointer", fontSize: 13, color: dm ? "#64748b" : "#9ca3af", fontFamily: "system-ui, sans-serif" }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ── Pantalla de carga (API call en progreso) ─────────────────────────────────
  if (phase === "starting") {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <AlexAvatar isSpeaking={false} isListening={false} dm={dm} size={120}/>
        <p style={{ fontSize: 15, color: dm ? "#94a3b8" : "#6b7280", fontFamily: "system-ui, sans-serif" }}>Preparando la entrevista…</p>
      </div>
    );
  }

  // ── Entrevista activa ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: dm ? "rgba(15,23,42,0.92)" : "rgba(248,250,252,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
        padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Simulación de entrevista
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827" }}>
            {jobTitle}{company ? ` · ${company}` : ""}
          </p>
        </div>
        <button
          onClick={() => { stopAudio(); manualStopRef.current = true; recognitionRef.current?.stop(); onExit(); }}
          style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${dm ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: dm ? "#94a3b8" : "#6b7280" }}
        >
          ← Salir
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 680, width: "100%", margin: "0 auto", padding: "0 16px" }}>

        {/* Avatar */}
        <div style={{ padding: "32px 0 24px", display: "flex", justifyContent: "center" }}>
          <AlexAvatar isSpeaking={isSpeaking} isListening={isListening} dm={dm}/>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "msgSlideIn 0.25s ease",
            }}>
              <div style={{
                maxWidth: "78%", padding: "12px 16px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user"
                  ? `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`
                  : (dm ? "#1e293b" : "#fff"),
                color: msg.role === "user" ? "#fff" : (dm ? "#e2e8f0" : "#1f2937"),
                fontSize: 14, lineHeight: 1.6,
                boxShadow: msg.role === "user"
                  ? "0 2px 10px rgba(0,117,138,0.3)"
                  : `0 1px 4px rgba(0,0,0,${dm ? "0.3" : "0.06"})`,
                border: msg.role !== "user" ? `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` : "none",
              }}>
                {msg.role === "assistant" && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: TEAL, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                    Alex
                  </span>
                )}
                {msg.text}
              </div>
            </div>
          ))}

          {/* Thinking dots */}
          {isThinking && (
            <div style={{ display: "flex", justifyContent: "flex-start", animation: "msgSlideIn 0.2s ease" }}>
              <div style={{
                padding: "4px 8px", borderRadius: "18px 18px 18px 4px",
                background: dm ? "#1e293b" : "#fff",
                border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                boxShadow: `0 1px 4px rgba(0,0,0,${dm ? "0.3" : "0.06"})`,
              }}>
                <ThinkingDots dm={dm}/>
              </div>
            </div>
          )}

          {phase === "finished" && loadingFeedback && (
            <div style={{ textAlign: "center", padding: 20, color: dm ? "#94a3b8" : "#6b7280", fontSize: 14 }}>
              Generando tu informe de entrevista…
            </div>
          )}

          <div ref={messagesEndRef}/>
        </div>
      </div>

      {/* Input bar */}
      {phase === "active" && (
        <div style={{
          position: "sticky", bottom: 0,
          background: dm ? "rgba(15,23,42,0.95)" : "rgba(248,250,252,0.95)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
          padding: "14px 16px",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* Voice/text toggle */}
            {voiceSupported && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[{ id: false, label: "✏️ Texto" }, { id: true, label: "🎤 Voz" }].map(opt => (
                  <button
                    key={String(opt.id)}
                    onClick={() => setVoiceMode(opt.id)}
                    style={{
                      padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${voiceMode === opt.id ? "transparent" : (dm ? "rgba(255,255,255,0.12)" : "#e2e8f0")}`,
                      background: voiceMode === opt.id ? TEAL : "none",
                      color: voiceMode === opt.id ? "#fff" : (dm ? "#94a3b8" : "#6b7280"),
                      transition: "all 0.15s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Text input */}
            {!voiceMode ? (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Escribe tu respuesta… (Enter para enviar)"
                  rows={2}
                  disabled={isThinking || isSpeaking}
                  style={{
                    flex: 1, resize: "none", borderRadius: 14, padding: "11px 14px",
                    border: `1px solid ${dm ? "rgba(255,255,255,0.12)" : "#d1d5db"}`,
                    background: dm ? "#1e293b" : "#fff",
                    color: dm ? "#f1f5f9" : "#111827",
                    fontSize: 14, fontFamily: "system-ui, sans-serif", lineHeight: 1.5, outline: "none",
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isThinking || isSpeaking}
                  style={{
                    padding: "11px 20px", borderRadius: 14, border: "none",
                    background: !input.trim() || isThinking || isSpeaking ? (dm ? "#334155" : "#e5e7eb") : TEAL,
                    color: !input.trim() || isThinking || isSpeaking ? (dm ? "#64748b" : "#9ca3af") : "#fff",
                    fontSize: 14, fontWeight: 700,
                    cursor: !input.trim() || isThinking || isSpeaking ? "not-allowed" : "pointer",
                    fontFamily: "system-ui, sans-serif", flexShrink: 0, alignSelf: "stretch",
                    transition: "all 0.15s",
                  }}
                >
                  Enviar →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={toggleVoice}
                  disabled={isThinking || isSpeaking}
                  style={{
                    width: 68, height: 68, borderRadius: "50%", border: "none",
                    cursor: isThinking || isSpeaking ? "not-allowed" : "pointer",
                    background: isListening ? "#ef4444" : TEAL,
                    boxShadow: isListening ? "0 0 0 8px rgba(239,68,68,0.2)" : "0 4px 20px rgba(0,117,138,0.4)",
                    fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                >
                  {isListening ? "⏹" : "🎤"}
                </button>
              </div>
            )}

            <p style={{ textAlign: "center", fontSize: 11, color: dm ? "#475569" : "#9ca3af", margin: "8px 0 0", fontFamily: "system-ui, sans-serif" }}>
              {isThinking ? "Alex está pensando…" : isSpeaking ? "Alex está hablando — puedes interrumpir" : "Turno del candidato"}
            </p>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedback && (
        <FeedbackPanel feedback={feedback} dm={dm} onClose={() => { setFeedback(null); onExit(); }}/>
      )}
    </div>
  );
}
