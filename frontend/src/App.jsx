import { useState, useEffect, useCallback } from "react";
import { ThemeContext } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import Toast from "./components/Toast";
import Onboarding from "./components/Onboarding";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Favoritos from "./pages/Favoritos";
import Candidaturas from "./pages/Candidaturas";
import VerifyEmail from "./pages/VerifyEmail";
import Admin from "./pages/Admin";
import CVSearch from "./pages/CVSearch";
import Dashboard from "./pages/Dashboard";
import Interview from "./pages/Interview";
import AgentSearch from "./pages/AgentSearch";
import {
  getUserProfile, updateUserProfile, getHistory, updateConsent,
  getAiQuota, getNotifications, markAllNotificationsRead,
  refreshToken, getTokenExpiresAt,
} from "./services/api";
import About from "./pages/About";
import ConsentBanner from "./components/ConsentBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { initClarity, stopClarity } from "./services/clarity";

const PROTECTED = ["buscar", "agente", "cv-buscar", "user-profile", "favoritos", "candidaturas", "admin", "dashboard", "entrevista"];
const AUTH_ONLY = ["home", "landing", "auth", "verify-email"];
const USER_APP_PAGES = ["buscar", "agente", "cv-buscar", "user-profile", "favoritos", "candidaturas", "dashboard"];
const PAGE_TITLES = {
  home: "JobMatch IA | Matching inteligente de ofertas",
  landing: "JobMatch IA | Matching inteligente de ofertas",
  auth: "Acceso | JobMatch IA",
  "verify-email": "Verificar correo | JobMatch IA",
  buscar: "Ofertas analizadas | JobMatch IA",
  agente: "Agente de empleo | JobMatch IA",
  "cv-buscar": "Buscar por CV | JobMatch IA",
  favoritos: "Favoritos | JobMatch IA",
  candidaturas: "Candidaturas | JobMatch IA",
  "user-profile": "Mi perfil | JobMatch IA",
  dashboard: "Inicio | JobMatch IA",
  admin: "Admin | JobMatch IA",
  entrevista: "Entrevista IA | JobMatch IA",
  sobre: "Sobre JobMatch IA | TFM",
};

const JWT_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days before expiry

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
  const [authLoading, setAuthLoading] = useState(() => Boolean(localStorage.getItem("token")));
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [interviewContext, setInterviewContext] = useState(null); // {jobTitle, company, applicationId}

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
      // Auto-refresh JWT if expiring within threshold
      const exp = getTokenExpiresAt();
      if (exp && exp - Date.now() < JWT_REFRESH_THRESHOLD_MS) {
        try {
          const { token } = await refreshToken();
          if (token) localStorage.setItem("token", token);
        } catch {
          // non-critical — old token still valid
        }
      }

      const [profile, history, quota, notifData] = await Promise.all([
        getUserProfile(),
        getHistory().catch(() => []),
        getAiQuota().catch(() => null),
        getNotifications(true).catch(() => null),
      ]);
      setCurrentUser(profile);
      setProfileCompletion(computeCompletion(profile));
      setHasSearched(Array.isArray(history) && history.length > 0);
      if (quota) setAiQuota(quota);
      if (notifData) setUnreadNotifications(notifData.unread_count || 0);
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfileState(); }, [refreshProfileState]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.analytics_consent === true) {
      initClarity({ isAdmin: Boolean(currentUser.is_admin) });
      setShowConsentBanner(false);
    } else if (currentUser.analytics_consent === false) {
      stopClarity();
      setShowConsentBanner(false);
    } else {
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
    setAiQuota(null);
    setUnreadNotifications(0);
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
    if (!hasToken || !currentUser) return;

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

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setUnreadNotifications(0);
    } catch { /* non-critical */ }
  }, []);

  // Repeat search: navigate to buscar and auto-trigger analysis
  const handleRepeatSearch = useCallback(() => {
    setForceAnalyze(true);
    navigateTo("buscar");
  }, [navigateTo]);

  const isAdminSession = Boolean(currentUser?.is_admin);
  const showNavbar = PROTECTED.includes(page) && page !== "admin" && page !== "entrevista" && !isAdminSession;
  const profileComplete = profileCompletion >= 60;
  // La barra de progreso superior desaparece al completar el perfil.
  const progressDone = profileComplete;

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
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
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
          aiQuota={aiQuota}
          unreadNotifications={unreadNotifications}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        />
      )}

      {showOnboarding && <Onboarding onDismiss={() => { handleDismissOnboarding(); navigateTo("buscar"); }} darkMode={darkMode} alias={currentUser?.alias || ""} />}

      {(page === "home" || page === "landing") && (
        <Landing onStartClick={() => navigateTo("auth")} onAboutClick={() => navigateTo("sobre")} />
      )}

      {page === "sobre" && (
        <About onStartClick={() => navigateTo("auth")} />
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
              const targetPage = profile.is_admin ? "admin" : "dashboard";
              navigateTo(targetPage);
            } catch {
              navigateTo("buscar");
            }
            refreshProfileState();
          }}
        />
      )}

      {page === "verify-email" && <VerifyEmail />}

      {page === "buscar" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode} onReset={() => setAnalysisResults(null)}>
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
            onNavigate={navigateTo}
          />
        </ErrorBoundary>
      )}
      {page === "agente" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
          <AgentSearch addToast={addToast} darkMode={darkMode} onNavigate={navigateTo} />
        </ErrorBoundary>
      )}
      {page === "cv-buscar" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
          <CVSearch addToast={addToast} darkMode={darkMode} />
        </ErrorBoundary>
      )}
      {page === "favoritos" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
          <Favoritos addToast={addToast} darkMode={darkMode} onNavigate={navigateTo} />
        </ErrorBoundary>
      )}
      {page === "candidaturas" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
          <Candidaturas
            addToast={addToast}
            darkMode={darkMode}
            onNavigate={navigateTo}
            onStartInterview={(jobTitle, company, applicationId) => {
              setInterviewContext({ jobTitle, company, applicationId });
              navigateTo("entrevista");
            }}
          />
        </ErrorBoundary>
      )}
      {page === "entrevista" && !isAdminSession && interviewContext && (
        <Interview
          darkMode={darkMode}
          jobTitle={interviewContext.jobTitle}
          company={interviewContext.company}
          applicationId={interviewContext.applicationId}
          onExit={() => {
            setInterviewContext(null);
            navigateTo("candidaturas");
          }}
        />
      )}
      {page === "entrevista" && !isAdminSession && !interviewContext && (
        <div style={{
          minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
          background: darkMode ? "#0f172a" : "#f8f9fc",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          <p style={{ fontSize: 16, color: darkMode ? "#94a3b8" : "#64748b", margin: 0, fontWeight: 500 }}>
            Selecciona una candidatura para simular la entrevista.
          </p>
          <button
            onClick={() => navigateTo("candidaturas")}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 700,
            }}
          >
            Ir a Candidaturas
          </button>
        </div>
      )}
      {page === "user-profile" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
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
        </ErrorBoundary>
      )}
      {page === "dashboard" && !isAdminSession && (
        <ErrorBoundary darkMode={darkMode}>
          <Dashboard
            darkMode={darkMode}
            addToast={addToast}
            onNavigate={navigateTo}
            onRepeatSearch={handleRepeatSearch}
          />
        </ErrorBoundary>
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
    </ThemeContext.Provider>
  );
}

export default App;
