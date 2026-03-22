import { useEffect, useMemo, useState } from "react";
import { verifyEmailToken, resendVerificationEmail } from "../services/api";
import { typography } from "../constants/theme";

function getTokenFromHash() {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return "";
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return params.get("token") || "";
}

export default function VerifyEmail() {
  const token = useMemo(() => getTokenFromHash(), []);
  const [status, setStatus] = useState(token ? "loading" : "missing");
  const [message, setMessage] = useState(
    token ? "Estamos verificando tu email..." : "El enlace de verificación no es válido."
  );
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    verifyEmailToken(token)
      .then((data) => {
        if (cancelled) return;
        setStatus("success");
        setVerifiedEmail(data.email || "");
        setMessage("Tu email ha quedado verificado. Ya puedes iniciar sesión.");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err.code === "expired_verification_token" ? "expired" : "error");
        setVerifiedEmail(err.email || "");
        setMessage(err.message || "No se pudo verificar el email.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend() {
    if (!verifiedEmail) return;
    setResendLoading(true);
    try {
      const data = await resendVerificationEmail(verifiedEmail);
      setStatus("resent");
      setMessage(data.detail || "Te hemos enviado un nuevo correo de verificación.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "No se pudo reenviar el email de verificación.");
    } finally {
      setResendLoading(false);
    }
  }

  const tone = status === "success" || status === "resent"
    ? { bg: "#ecfdf5", border: "#bbf7d0", title: "#166534", text: "#166534" }
    : status === "loading"
      ? { bg: "#eff6ff", border: "#bfdbfe", title: "#1d4ed8", text: "#1e40af" }
      : { bg: "#fff7ed", border: "#fed7aa", title: "#c2410c", text: "#9a3412" };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
      fontFamily: typography.family,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 520,
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: "28px 24px",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
      }}>
        <p style={{
          margin: "0 0 8px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#00758A",
        }}>
          Seguridad de cuenta
        </p>
        <h1 style={{
          margin: "0 0 16px",
          fontSize: 28,
          lineHeight: 1.1,
          color: "#111827",
        }}>
          Verificación de email
        </h1>

        <div style={{
          borderRadius: 14,
          padding: "16px 18px",
          backgroundColor: tone.bg,
          border: `1px solid ${tone.border}`,
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: tone.title }}>
            {status === "success" ? "Email verificado" : status === "loading" ? "Verificando enlace" : "Revisión necesaria"}
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: tone.text }}>
            {message}
          </p>
        </div>

        {(status === "expired" || status === "error") && verifiedEmail && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            style={{
              marginTop: 16,
              padding: "11px 16px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              color: "#0f172a",
              fontSize: 14,
              fontWeight: 700,
              cursor: resendLoading ? "not-allowed" : "pointer",
              opacity: resendLoading ? 0.7 : 1,
              fontFamily: typography.family,
            }}
          >
            {resendLoading ? "Reenviando..." : "Reenviar email de verificación"}
          </button>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
          <button
            type="button"
            onClick={() => { window.location.hash = "auth"; }}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#00758A",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: typography.family,
              boxShadow: "0 10px 24px rgba(0, 117, 138, 0.18)",
            }}
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
