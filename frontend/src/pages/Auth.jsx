import { useCallback, useMemo, useState } from "react";
import { login, register, resendVerificationEmail } from "../services/api";
import {
  gradients,
  typography,
  transition,
} from "../constants/theme";
import TurnstileWidget from "../components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || "";

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
    if (token) setTurnstileError("");
  }, []);

  const handleTurnstileError = useCallback((message) => {
    setTurnstileToken("");
    setTurnstileError(message);
  }, []);

  async function handleResend(targetEmail = pendingVerificationEmail || email) {
    if (!targetEmail) return;
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
      if (!alias.trim()) {
        setError("El alias es obligatorio");
        return;
      }
      if (password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres");
        return;
      }
      if (!canSubmitRegister) {
        setError(turnstileError || "Completa la verificación anti-bot antes de crear la cuenta");
        return;
      }
    } else if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
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
          ? "Cuenta creada. Revisa tu correo para verificar tu cuenta antes de iniciar sesión."
          : "Cuenta creada, pero no se pudo enviar el correo automáticamente. Usa el botón de reenvío."
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

  function switchMode(newMode) {
    setMode(newMode);
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

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.mainTitle}>JobMatch IA</h1>
        <p style={S.subtitle}>Análisis inteligente de ofertas de trabajo</p>
      </div>

      <div style={S.card}>
        <div style={S.tabs}>
          <button type="button" onClick={() => switchMode("login")}
            style={{ ...S.tab, ...(mode === "login" ? S.tabActive : S.tabInactive) }}>
            Iniciar sesión
          </button>
          <button type="button" onClick={() => switchMode("register")}
            style={{ ...S.tab, ...(mode === "register" ? S.tabActive : S.tabInactive) }}>
            Registrarse
          </button>
        </div>

        {notice && <div style={S.notice}>{notice}</div>}
        {error && <div style={S.error}>{error}</div>}

        {pendingVerificationEmail && (
          <div style={S.pendingBox}>
            <p style={S.pendingTitle}>Verificación pendiente</p>
            <p style={S.pendingText}>
              La cuenta asociada a <strong>{pendingVerificationEmail}</strong> necesita verificar el correo antes de acceder.
            </p>
            <button
              type="button"
              onClick={() => handleResend(pendingVerificationEmail)}
              disabled={resendLoading}
              style={{ ...S.secondaryButton, opacity: resendLoading ? 0.7 : 1 }}
            >
              {resendLoading ? "Reenviando..." : "Reenviar email de verificación"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              style={S.input}
            />
          </div>

          {mode === "register" && (
            <>
              <div style={S.field}>
                <label style={S.label}>
                  ¿Cómo quieres que te llamemos? <span style={S.required}>*</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={e => setAlias(e.target.value)}
                  required
                  placeholder="Tu alias o apodo"
                  style={S.input}
                  maxLength={50}
                />
              </div>
              <div style={S.fieldRow}>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.label}>Nombre <span style={S.optional}>(opcional)</span></label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    style={S.input}
                    maxLength={100}
                  />
                </div>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.label}>Apellidos <span style={S.optional}>(opcional)</span></label>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={e => setApellidos(e.target.value)}
                    placeholder="Tus apellidos"
                    style={S.input}
                    maxLength={200}
                  />
                </div>
              </div>
            </>
          )}

          <div style={S.field}>
            <label style={S.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  style={S.input}
                />
              </div>

              <div style={S.turnstileSection}>
                <label style={S.label}>Protección anti-bot</label>
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onTokenChange={handleTurnstileToken}
                  onError={handleTurnstileError}
                />
                <p style={S.turnstileHelp}>
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
              opacity: loading || (mode === "register" && !canSubmitRegister) ? 0.7 : 1,
              cursor: loading || (mode === "register" && !canSubmitRegister) ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#f8f9fc",
    paddingTop: 64,
    paddingBottom: 64,
    fontFamily: typography.family,
  },
  header: {
    maxWidth: 500,
    margin: "0 auto",
    paddingBottom: 32,
    textAlign: "center",
  },
  mainTitle: {
    margin: "0 0 12px",
    fontSize: 48,
    fontWeight: 800,
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-1px",
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 1.6,
  },
  card: {
    maxWidth: 520,
    margin: "0 auto",
    padding: 32,
    backgroundColor: "#fff",
    borderRadius: 16,
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  tabs: {
    display: "flex",
    marginBottom: 24,
    borderBottom: "2px solid #e8ecf1",
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontFamily: typography.family,
    transition: `all ${transition.fast}`,
  },
  tabActive: {
    color: "#2563eb",
    borderBottom: "2px solid #2563eb",
    marginBottom: -2,
  },
  tabInactive: {
    color: "#9ca3af",
  },
  notice: {
    padding: "10px 14px",
    backgroundColor: "#ecfdf5",
    color: "#166534",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
    border: "1px solid #bbf7d0",
  },
  error: {
    padding: "10px 14px",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
    border: "1px solid #fecaca",
  },
  pendingBox: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 16,
    marginBottom: 18,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  pendingTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#111827",
  },
  pendingText: {
    margin: 0,
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 1.6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  fieldRow: {
    display: "flex",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },
  required: {
    color: "#ef4444",
    fontSize: 13,
  },
  optional: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: 400,
  },
  input: {
    padding: "10px 14px",
    fontSize: 14,
    borderRadius: 10,
    border: "1.5px solid #d1d5db",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    color: "#111827",
    outline: "none",
    transition: `border-color ${transition.fast}`,
  },
  turnstileSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  turnstileHelp: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
  },
  turnstileError: {
    margin: 0,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 1.5,
  },
  submitButton: {
    marginTop: 8,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: gradients.primary,
    border: "none",
    borderRadius: 50,
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    width: "100%",
    boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
  },
  secondaryButton: {
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: typography.family,
    alignSelf: "flex-start",
  },
};
