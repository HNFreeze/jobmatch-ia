import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function TurnstileWidget({ siteKey, onTokenChange, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) {
      setLoading(false);
      onError?.("Turnstile no está configurado en el frontend.");
      return undefined;
    }

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !turnstile || !containerRef.current) return;
        if (widgetIdRef.current != null) {
          turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token) => onTokenChange?.(token),
          "expired-callback": () => onTokenChange?.(""),
          "error-callback": () => {
            onTokenChange?.("");
            onError?.("No se pudo validar el reto de seguridad. Recarga la página e inténtalo de nuevo.");
          },
        });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          onError?.("No se pudo cargar la protección anti-bot. Comprueba tu conexión o recarga la página.");
        }
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current != null) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onTokenChange, onError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        ref={containerRef}
        style={{
          minHeight: 65,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          backgroundColor: "#f8fafc",
          padding: 8,
        }}
      />
      {loading && (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Cargando protección anti-bot...
        </p>
      )}
    </div>
  );
}
