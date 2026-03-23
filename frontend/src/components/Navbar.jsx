import { useState, useEffect } from "react";
import {
  typography,
  transition,
} from "../constants/theme";
import BrandLogo from "./BrandLogo";

const BASE_NAV_LINKS = [
  { key: "buscar",       label: "Buscar ofertas" },
  { key: "mapa",         label: "Mapa" },
  { key: "favoritos",    label: "Favoritos" },
  { key: "candidaturas", label: "Candidaturas" },
  { key: "user-profile", label: "Mi perfil" },
];

export default function Navbar({
  currentPage, onNavigate, onLogout,
  darkMode, toggleDarkMode,
  progressDone, profileComplete, hasSearched,
  profileCompletion = 0,
  isAdmin = false,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = isAdmin
    ? [...BASE_NAV_LINKS, { key: "admin", label: "Admin" }]
    : BASE_NAV_LINKS;

  useEffect(() => {
    function handleScroll() { setScrolled(window.scrollY > 10); }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function navigate(key) {
    setMenuOpen(false);
    onNavigate(key);
  }

  const dm = darkMode;

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        fontFamily: typography.family,
        backgroundColor: dm
          ? (scrolled ? "rgba(15,23,42,0.95)" : "#0f172a")
          : (scrolled ? "rgba(255,255,255,0.97)" : "#fff"),
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
        borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
        transition: `all ${transition.smooth}`,
      }}>
        {/* Progress bar */}
        {!progressDone && (
          <div style={S.progressBar}>
            <div style={S.progressLabel}>
              {!profileComplete
                ? `Perfil ${profileCompletion}% — complétalo para mejorar la IA`
                : !hasSearched
                ? "Haz tu primera búsqueda"
                : null}
            </div>
            <div style={S.progressTrack}>
              <div style={{
                ...S.progressFill,
                width: profileComplete
                  ? (hasSearched ? "100%" : "75%")
                  : `${Math.max(10, profileCompletion * 0.6)}%`,
              }} />
            </div>
          </div>
        )}

        <div style={S.inner}>
          {/* Logo */}
          <button style={S.logo} onClick={() => navigate("buscar")}>
            <BrandLogo
              size={34}
              showWordmark={true}
              gap={10}
              wordmarkSize={22}
              tone={dm ? "light" : "gradient"}
            />
          </button>

          {/* Desktop links */}
          <div className="nav-links" style={S.links}>
            {navLinks.map(item => (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  ...S.link,
                  ...(currentPage === item.key
                    ? S.linkActive
                    : { ...S.linkInactive, color: dm ? "#94a3b8" : "#6b7280" }),
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div style={S.rightControls}>
            <button
              style={{
                ...S.darkToggle,
                background: dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                color: dm ? "#f1f5f9" : "#374151",
              }}
              onClick={toggleDarkMode}
              title={dm ? "Modo claro" : "Modo oscuro"}
            >
              {dm ? "☀️" : "🌙"}
            </button>

            <button
              className="nav-logout"
              style={{
                ...S.logoutBtn,
                color: dm ? "#94a3b8" : "#6b7280",
                borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db",
              }}
              onClick={onLogout}
            >
              Salir
            </button>

            {/* Hamburger (mobile) */}
            <button
              className="nav-hamburger"
              style={{ ...S.hamburger, display: "none" }}
              onClick={() => setMenuOpen(m => !m)}
              aria-label="Menú"
            >
              <span style={{
                ...S.hamburgerBar,
                background: dm ? "#94a3b8" : "#374151",
                transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
              }} />
              <span style={{
                ...S.hamburgerBar,
                background: dm ? "#94a3b8" : "#374151",
                opacity: menuOpen ? 0 : 1,
              }} />
              <span style={{
                ...S.hamburgerBar,
                background: dm ? "#94a3b8" : "#374151",
                transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none",
              }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          ...S.mobileMenu,
          background: dm ? "#1e293b" : "#fff",
          borderTop: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
        }}>
          {navLinks.map(item => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              style={{
                ...S.mobileLink,
                background: currentPage === item.key ? gradients.primary : "none",
                color: currentPage === item.key ? "#fff" : dm ? "#f1f5f9" : "#111827",
              }}
            >
              {item.label}
            </button>
          ))}
          <button style={S.mobileSeparator} onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </>
  );
}

const S = {
  progressBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 24px",
    background: "rgba(37,99,235,0.04)",
    borderBottom: "1px solid rgba(37,99,235,0.08)",
  },
  progressLabel: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: 600,
    whiteSpace: "nowrap",
    fontFamily: typography.family,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    background: "rgba(37,99,235,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: gradients.primary,
    borderRadius: 2,
    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "12px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  logo: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  links: {
    display: "flex",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },
  link: {
    background: "none",
    border: "none",
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 50,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: `all ${transition.smooth}`,
  },
  linkActive: {
    background: gradients.primary,
    color: "#fff",
    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
  },
  linkInactive: {
    backgroundColor: "transparent",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  darkToggle: {
    border: "none",
    borderRadius: 50,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
    transition: `all ${transition.smooth}`,
  },
  logoutBtn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: "transparent",
    border: "1px solid",
    borderRadius: 50,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: `all ${transition.smooth}`,
  },
  hamburger: {
    display: "none",
    flexDirection: "column",
    gap: 4,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
  },
  hamburgerBar: {
    width: 22,
    height: 2,
    borderRadius: 1,
    display: "block",
    transition: "all 0.25s ease",
  },
  mobileMenu: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 16px 16px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
  mobileLink: {
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    textAlign: "left",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: typography.family,
    margin: "2px 0",
    transition: `all ${transition.smooth}`,
  },
  mobileSeparator: {
    background: "none",
    border: "none",
    borderTop: "1px solid #e8ecf1",
    padding: "12px 16px",
    textAlign: "left",
    fontSize: 14,
    color: "#6b7280",
    cursor: "pointer",
    fontFamily: typography.family,
    marginTop: 8,
  },
};

// CSS for responsive hamburger visibility
if (!document.getElementById("navbar-responsive")) {
  const s = document.createElement("style");
  s.id = "navbar-responsive";
  s.textContent = `
    @media (max-width: 768px) {
      .nav-links { display: none !important; }
      .nav-hamburger { display: flex !important; }
      .nav-logout { display: none !important; }
    }
  `;
  document.head.appendChild(s);
}
