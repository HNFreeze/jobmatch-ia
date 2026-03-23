import { useCallback, useMemo, useState } from "react";
import { login, register, resendVerificationEmail } from "../services/api";
import { typography, transition } from "../constants/theme";
import TurnstileWidget from "../components/TurnstileWidget";
import BrandLogo from "../components/BrandLogo";

const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || "";
const TEAL = "#007A8A";

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [alias, setAlias] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");

  const canSubmitRegister = useMemo(() => {
    return Boolean(turnstileToken) && !turnstileError;
  }, [turnstileToken, turnstileError]);

  const handleTurnstileToken = useCallback((token) => {
    setTurnstileToken(token || "");
    if (token) {
      setTurnstileError("");
    }
  }, []);

  const handleTurnstileError = useCallback((message) => {
    setTurnstileToken("");
    setTurnstileError(message);
  }, []);

  async function handleResend(targetEmail = pendingVerificationEmail || email) {
    if (!targetEmail) {
      return;
    }
    setResendLoading(true);
    setError(null);
    try {
      const data = await resendVerificationEmail(targetEmail);
      setNotice(data.detail);
      setPendingVerificationEmail(targetEmail);
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
      if (!alias.trim()) {
        setError("El alias es obligatorio.");
        return;
      }
      if (password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (!canSubmitRegister) {
        setError(turnstileError || "Completa la protección anti-bot antes de crear la cuenta.");
        return;
      }
    } else if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const data = await login(email, password);
        localStorage.setItem("token", data.token);
        localStorage.setItem("email", data.email);
        localStorage.setItem("alias", data.alias || data.email.split("@")[0]);
        onAuthSuccess?.("login");
        return;
      }

      const data = await register(
        email,
        password,
        alias.trim(),
        nombre.trim(),
        apellidos.trim(),
        turnstileToken,
      );

      setPendingVerificationEmail(data.email || email.trim().toLowerCase());
      setNotice(
        data.email_sent
          ? "Cuenta creada. Revisa tu correo y verifica tu cuenta antes de iniciar sesión."
          : "Cuenta creada, pero no se pudo enviar el correo automáticamente. Usa el reenvío manual."
      );
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setAlias("");
      setNombre("");
      setApellidos("");
      setTurnstileToken("");
    } catch (err) {
      if (err.code === "email_not_verified") {
        setPendingVerificationEmail(err.email || email.trim().toLowerCase());
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
    setAlias("");
    setNombre("");
    setApellidos("");
    setTurnstileToken("");
    setTurnstileError("");
  }

  const title = mode === "login" ? "Bienvenido de nuevo." : "Crea tu acceso profesional.";
  const intro = mode === "login"
    ? "Accede a tu panel de precisión y sigue afinando tu siguiente movimiento profesional."
    : "Activa tu cuenta, protege el acceso con verificación real y deja listo tu perfil para el matching.";
  const submitLabel = loading
    ? "Cargando..."
    : mode === "login"
      ? "Entrar"
      : "Crear cuenta";

  return (
    <div style={S.page}>
      <div style={S.backgroundLayer}>
        <div style={S.topBlob} />
        <div style={S.bottomBlob} />
      </div>

      <header style={S.header}>
        <div style={S.brand}>
          <BrandLogo size={36} showWordmark={true} gap={12} wordmarkSize={24} />
        </div>
        <div style={S.headerMeta}>Precision Match Technology</div>
      </header>

      <main style={S.main}>
        <section style={S.hero}>
          <p style={S.kicker}>Acceso profesional</p>
          <h1 style={S.heroTitle}>{title}</h1>
          <p style={S.heroText}>{intro}</p>
        </section>

        <section style={S.card}>
          <div style={S.modeSwitch}>
            <button
              type="button"
              onClick={() => switchMode("login")}
              style={{
                ...S.modeButton,
                ...(mode === "login" ? S.modeButtonActive : S.modeButtonIdle),
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              style={{
                ...S.modeButton,
                ...(mode === "register" ? S.modeButtonActive : S.modeButtonIdle),
              }}
            >
              Registrarse
            </button>
          </div>

          {notice && <div style={S.noticeBox}>{notice}</div>}
          {error && <div style={S.errorBox}>{error}</div>}

          {pendingVerificationEmail && (
            <div style={S.pendingBox}>
              <div>
                <p style={S.pendingEyebrow}>Verificación pendiente</p>
                <p style={S.pendingText}>
                  La cuenta asociada a <strong>{pendingVerificationEmail}</strong> necesita verificar el correo antes de acceder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResend(pendingVerificationEmail)}
                disabled={resendLoading}
                style={{
                  ...S.secondaryButton,
                  opacity: resendLoading ? 0.7 : 1,
                  cursor: resendLoading ? "not-allowed" : "pointer",
                }}
              >
                {resendLoading ? "Reenviando..." : "Reenviar email de verificación"}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} style={S.form}>
            {mode === "register" && (
              <>
                <div style={S.row}>
                  <div style={S.fieldGrow}>
                    <label style={S.label}>Alias</label>
                    <input
                      type="text"
                      value={alias}
                      onChange={(event) => setAlias(event.target.value)}
                      required
                      placeholder="Como quieres aparecer"
                      style={S.input}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div style={S.row}>
                  <div style={S.fieldGrow}>
                    <label style={S.label}>Nombre</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Opcional"
                      style={S.input}
                      maxLength={100}
                    />
                  </div>
                  <div style={S.fieldGrow}>
                    <label style={S.label}>Apellidos</label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(event) => setApellidos(event.target.value)}
                      placeholder="Opcional"
                      style={S.input}
                      maxLength={200}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={S.field}>
              <label style={S.label}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="nombre@ejemplo.com"
                style={S.input}
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                style={S.input}
              />
            </div>

            {mode === "register" && (
              <>
                <div style={S.field}>
                  <label style={S.label}>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    placeholder="Repite la contraseña"
                    style={S.input}
                  />
                </div>

                <div style={S.securityPanel}>
                  <div style={S.securityHeader}>
                    <span style={S.securityBadge}>Seguridad</span>
                    <span style={S.securityMeta}>Turnstile + verificación por email</span>
                  </div>
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    onTokenChange={handleTurnstileToken}
                    onError={handleTurnstileError}
                  />
                  <p style={S.securityHelp}>
                    Usamos Cloudflare Turnstile para reducir registros automáticos y proteger el servicio.
                  </p>
                  {turnstileError && <p style={S.turnstileError}>{turnstileError}</p>}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "register" && !canSubmitRegister)}
              style={{
                ...S.submitButton,
                opacity: loading || (mode === "register" && !canSubmitRegister) ? 0.72 : 1,
                cursor: loading || (mode === "register" && !canSubmitRegister) ? "not-allowed" : "pointer",
              }}
            >
              {submitLabel}
            </button>
          </form>

          <div style={S.cardFooter}>
            <span style={S.cardFooterText}>
              {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes acceso?"}
            </span>
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              style={S.linkButton}
            >
              {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
            </button>
          </div>
        </section>

        <div style={S.poweredRow}>
          <div style={S.poweredLine} />
          <span style={S.poweredText}>Protected access for JobMatch IA</span>
          <div style={S.poweredLine} />
        </div>
      </main>

      <footer style={S.footer}>
        <span>Cuenta protegida con verificación por email y anti-bot.</span>
        <span>JobMatch IA · 2026</span>
      </footer>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
    fontFamily: typography.family,
    color: "#0f172a",
    padding: "0 20px 32px",
  },
  backgroundLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  topBlob: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: "50%",
    backgroundColor: "rgba(207,250,254,0.7)",
    filter: "blur(70px)",
  },
  bottomBlob: {
    position: "absolute",
    bottom: -160,
    left: -140,
    width: 420,
    height: 420,
    borderRadius: "50%",
    backgroundColor: "rgba(226,232,240,0.8)",
    filter: "blur(70px)",
  },
  header: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1080,
    margin: "0 auto",
    padding: "24px 0 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  main: {
    position: "relative",
    zIndex: 1,
    maxWidth: 480,
    margin: "0 auto",
    paddingTop: 44,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  hero: {
    width: "100%",
    marginBottom: 26,
  },
  kicker: {
    margin: "0 0 12px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  heroTitle: {
    margin: "0 0 14px",
    fontSize: 46,
    lineHeight: 1.02,
    letterSpacing: "-0.05em",
    fontWeight: 900,
    color: "#0f172a",
  },
  heroText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#64748b",
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    boxShadow: "0 12px 34px rgba(15,23,42,0.06)",
    border: "1px solid #e2e8f0",
    borderLeft: `6px solid ${TEAL}`,
    padding: "26px 24px 22px",
  },
  modeSwitch: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    borderRadius: 999,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 800,
    border: "1px solid transparent",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
  },
  modeButtonActive: {
    backgroundColor: TEAL,
    color: "#ffffff",
    borderColor: "#005B66",
    boxShadow: "0 6px 18px rgba(0,122,138,0.18)",
  },
  modeButtonIdle: {
    backgroundColor: "#f8fafc",
    color: "#64748b",
    borderColor: "#e2e8f0",
    cursor: "pointer",
  },
  noticeBox: {
    padding: "12px 14px",
    backgroundColor: "#ecfdf5",
    color: "#166534",
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.55,
    marginBottom: 14,
    border: "1px solid #bbf7d0",
  },
  errorBox: {
    padding: "12px 14px",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.55,
    marginBottom: 14,
    border: "1px solid #fecaca",
  },
  pendingBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  pendingEyebrow: {
    margin: "0 0 6px",
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 900,
  },
  pendingText: {
    margin: 0,
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  fieldGrow: {
    flex: "1 1 180px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "rgba(248,250,252,0.85)",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 14,
    outline: "none",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
  },
  securityPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  securityHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  securityBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: TEAL,
    backgroundColor: "#ecfeff",
    border: "1px solid #bae6fd",
  },
  securityMeta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  securityHelp: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
  },
  turnstileError: {
    margin: 0,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 1.5,
  },
  submitButton: {
    width: "100%",
    borderRadius: 999,
    padding: "15px 18px",
    border: "1px solid #005B66",
    backgroundColor: TEAL,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 900,
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    boxShadow: "0 10px 24px rgba(0,122,138,0.18)",
    marginTop: 4,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "11px 16px",
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: typography.family,
  },
  cardFooter: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  cardFooterText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  linkButton: {
    border: "none",
    backgroundColor: "transparent",
    color: TEAL,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    fontFamily: typography.family,
  },
  poweredRow: {
    width: "100%",
    marginTop: 28,
    display: "flex",
    alignItems: "center",
    gap: 14,
    opacity: 0.72,
  },
  poweredLine: {
    height: 1,
    flex: 1,
    backgroundColor: "#cbd5e1",
  },
  poweredText: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#64748b",
    textAlign: "center",
  },
  footer: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1080,
    margin: "32px auto 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 700,
  },
};
