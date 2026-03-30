import { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import Toast from "./components/Toast";
import Onboarding from "./components/Onboarding";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import MapaOfertas from "./pages/MapaOfertas";
import Favoritos from "./pages/Favoritos";
import Candidaturas from "./pages/Candidaturas";
import VerifyEmail from "./pages/VerifyEmail";
import Admin from "./pages/Admin";
import CVSearch from "./pages/CVSearch";
import { getUserProfile, updateUserProfile, getHistory, updateConsent } from "./services/api";
import ConsentBanner from "./components/ConsentBanner";
import { initClarity, stopClarity } from "./services/clarity";

const PROTECTED = ["buscar", "cv-buscar", "user-profile", "mapa", "favoritos", "candidaturas", "admin"];
const AUTH_ONLY = ["home", "landing", "auth", "verify-email"];
const USER_APP_PAGES = ["buscar", "cv-buscar", "user-profile", "mapa", "favoritos", "candidaturas"];
const PAGE_TITLES = {
  home: "JobMatch IA | Matching inteligente de ofertas",
  landing: "JobMatch IA | Matching inteligente de ofertas",
  auth: "Acceso | JobMatch IA",
  "verify-email": "Verificar correo | JobMatch IA",
  buscar: "Ofertas analizadas | JobMatch IA",
  "cv-buscar": "Buscar por CV | JobMatch IA",
  mapa: "Ubicaciones | JobMatch IA",
  favoritos: "Favoritos | JobMatch IA",
  candidaturas: "Candidaturas | JobMatch IA",
  "user-profile": "Mi perfil | JobMatch IA",
  admin: "Admin | JobMatch IA",
};

function computeCompletion(profile) {
  if (!profile) return 0;
  return Math.round(
    [
      (profile.stack || []).length > 0,
      (profile.anos_experiencia || "") !== "",
      (profile.idiomas || []).filter(l => l.idioma?.trim()).length > 0,
      (profile.ubicaciones || []).length > 0,
      (profile.modalidad || []).length > 0,
    ].filter(Boolean).length / 5 * 100
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [analysisResults, setAnalysisResults] = useState(null);
  const [forceAnalyze, setForceAnalyze] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [toasts, setToasts] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // Starts true when a token exists so we don't render the wrong view before the
  // profile (and its is_admin flag) has been fetched from the server.
  const [authLoading, setAuthLoading] = useState(() => Boolean(localStorage.getItem("token")));
  const [showConsentBanner, setShowConsentBanner] = useState(false);

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.style.background = darkMode ? "#0f172a" : "";
    document.body.style.color = darkMode ? "#f1f5f9" : "";
  }, [darkMode]);

  useEffect(() => {
    document.title = PAGE_TITLES[page] || PAGE_TITLES.home;
  }, [page]);

  function toggleDarkMode() { setDarkMode(d => !d); }

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshProfileState = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setAuthLoading(false);
      return;
    }
    try {
      const [profile, history] = await Promise.all([
        getUserProfile(),
        getHistory().catch(() => []),
      ]);
      setCurrentUser(profile);
      setProfileCompletion(computeCompletion(profile));
      setHasSearched(Array.isArray(history) && history.length > 0);
    } catch {
      // token invalid or server down
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfileState(); }, [refreshProfileState]);

  // Clarity: activate if consent already given, show banner if pending (null)
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.analytics_consent === true) {
      initClarity({ isAdmin: Boolean(currentUser.is_admin) });
      setShowConsentBanner(false);
    } else if (currentUser.analytics_consent === false) {
      stopClarity();
      setShowConsentBanner(false);
    } else {
      // null → not decided yet
      setShowConsentBanner(true);
    }
  }, [currentUser?.id, currentUser?.analytics_consent]);

  async function handleDismissOnboarding() {
    setShowOnboarding(false);
    try {
      await updateUserProfile({ onboarding_completed: true });
    } catch {
      // non-critical
    }
  }

  const navigateTo = useCallback((newPage) => {
    window.location.hash = newPage;
    setPage(newPage);
  }, []);

  const handleLogout = useCallback((options = {}) => {
    const targetPage = options.targetPage || "home";
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("alias");
    setAnalysisResults(null);
    setForceAnalyze(false);
    setShowOnboarding(false);
    setProfileCompletion(0);
    setHasSearched(false);
    setCurrentUser(null);
    window.location.replace(`#${targetPage}`);
    setPage(targetPage);
  }, []);

  useEffect(() => {
    function handleForcedLogout() {
      handleLogout({ targetPage: "auth" });
    }

    window.addEventListener("jobmatch:force-logout", handleForcedLogout);
    return () => window.removeEventListener("jobmatch:force-logout", handleForcedLogout);
  }, [handleLogout]);

  useEffect(() => {
    if (!localStorage.getItem("token")) return undefined;
    const intervalId = window.setInterval(() => {
      refreshProfileState();
    }, 45000);
    return () => window.clearInterval(intervalId);
  }, [refreshProfileState, currentUser?.id]);

  useEffect(() => {
    // Don't resolve routes while the auth state is still loading — this prevents
    // the brief redirect to #buscar that caused the admin-view flicker.
    if (authLoading) return;

    const resolve = () => {
      const hash = window.location.hash.slice(1) || "home";
      const baseHash = hash.split("?")[0] || "home";
      const hasToken = Boolean(localStorage.getItem("token"));
      const isAdmin = Boolean(currentUser?.is_admin);

      if (hasToken && AUTH_ONLY.includes(baseHash) && baseHash !== "verify-email") {
        const target = isAdmin ? "admin" : "buscar";
        window.location.replace(`#${target}`);
        setPage(target);
        return;
      }
      if (hasToken && isAdmin && USER_APP_PAGES.includes(baseHash)) {
        window.location.replace("#admin");
        setPage("admin");
        return;
      }
      if (hasToken && !isAdmin && baseHash === "admin") {
        window.location.replace("#buscar");
        setPage("buscar");
        return;
      }
      if (!hasToken && PROTECTED.includes(baseHash)) {
        window.location.replace("#auth");
        setPage("auth");
        return;
      }
      setPage(baseHash);
    };

    resolve();
    window.addEventListener("hashchange", resolve);
    return () => window.removeEventListener("hashchange", resolve);
  }, [currentUser?.is_admin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const hasToken = Boolean(localStorage.getItem("token"));
    if (!hasToken || !currentUser) {
      return;
    }

    if (currentUser.is_admin && page !== "admin") {
      window.location.replace("#admin");
      setPage("admin");
      return;
    }

    if (!currentUser.is_admin && page === "admin") {
      window.location.replace("#buscar");
      setPage("buscar");
    }
  }, [currentUser, page, authLoading]);

  async function handleConsentAccept() {
    try {
      await updateConsent(true);
      setCurrentUser(prev => prev ? { ...prev, analytics_consent: true } : prev);
    } catch { /* non-critical */ }
  }

  async function handleConsentReject() {
    try {
      await updateConsent(false);
      setCurrentUser(prev => prev ? { ...prev, analytics_consent: false } : prev);
    } catch { /* non-critical */ }
  }

  const isAdminSession = Boolean(currentUser?.is_admin);
  const showNavbar = PROTECTED.includes(page) && page !== "admin" && !isAdminSession;
  const profileComplete = profileCompletion >= 60;
  const progressDone = profileComplete && hasSearched;

  // Show a neutral loading screen while we resolve the user's role.
  // This prevents briefly rendering the wrong view (e.g. Profile for an admin).
  if (authLoading) {
    return (
      <>
        <style>{`@keyframes jm-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid",
            borderColor: darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0",
            borderTopColor: "#00758A",
            animation: "jm-spin 0.75s linear infinite",
          }} />
        </div>
      </>
    );
  }

  return (
    <div>
      {showNavbar && (
        <Navbar
          currentPage={page}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          progressDone={progressDone}
          profileComplete={profileComplete}
          hasSearched={hasSearched}
          profileCompletion={profileCompletion}
          isAdmin={Boolean(currentUser?.is_admin)}
        />
      )}

      {showOnboarding && <Onboarding onDismiss={handleDismissOnboarding} darkMode={darkMode} />}

      {(page === "home" || page === "landing") && (
        <Landing onStartClick={() => navigateTo("auth")} />
      )}

      {page === "auth" && (
        <Auth
          onAuthSuccess={async () => {
            try {
              const profile = await getUserProfile();
              if (!profile.onboarding_completed) {
                setShowOnboarding(true);
              }
              setCurrentUser(profile);
              setProfileCompletion(computeCompletion(profile));
              const targetPage = profile.is_admin ? "admin" : "buscar";
              navigateTo(targetPage);
            } catch {
              // ignore
              navigateTo("buscar");
            }
            refreshProfileState();
          }}
        />
      )}

      {page === "verify-email" && <VerifyEmail />}

      {page === "buscar" && !isAdminSession && (
        <Profile
          analysisResults={analysisResults}
          setAnalysisResults={(data) => {
            setAnalysisResults(data);
            setHasSearched(true);
          }}
          addToast={addToast}
          darkMode={darkMode}
          forceAnalyze={forceAnalyze}
          onAnalyzeStarted={() => setForceAnalyze(false)}
        />
      )}
      {page === "cv-buscar" && !isAdminSession && (
        <CVSearch addToast={addToast} darkMode={darkMode} />
      )}
      {page === "mapa" && !isAdminSession && <MapaOfertas analysisResults={analysisResults} darkMode={darkMode} />}
      {page === "favoritos" && !isAdminSession && <Favoritos addToast={addToast} darkMode={darkMode} />}
      {page === "candidaturas" && !isAdminSession && <Candidaturas addToast={addToast} darkMode={darkMode} />}
      {page === "user-profile" && !isAdminSession && (
        <UserProfile
          onProfileSaved={() => {
            setAnalysisResults(null);
            refreshProfileState();
            setForceAnalyze(true);
            navigateTo("buscar");
          }}
          onAccountDeleted={handleLogout}
          onSkip={() => navigateTo("buscar")}
          addToast={addToast}
          darkMode={darkMode}
        />
      )}
      {page === "admin" && isAdminSession && (
        <Admin
          darkMode={darkMode}
          onLogout={handleLogout}
          toggleDarkMode={toggleDarkMode}
        />
      )}

      {showConsentBanner && (
        <ConsentBanner
          onAccept={handleConsentAccept}
          onReject={handleConsentReject}
          darkMode={darkMode}
        />
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
