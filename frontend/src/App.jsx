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
import { getUserProfile, updateUserProfile, getHistory } from "./services/api";

const PROTECTED = ["buscar", "user-profile", "mapa", "favoritos", "candidaturas", "admin"];
const AUTH_ONLY = ["home", "landing", "auth", "verify-email"];

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

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.style.background = darkMode ? "#0f172a" : "";
    document.body.style.color = darkMode ? "#f1f5f9" : "";
  }, [darkMode]);

  function toggleDarkMode() { setDarkMode(d => !d); }

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshProfileState = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
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
    }
  }, []);

  useEffect(() => { refreshProfileState(); }, [refreshProfileState]);

  async function handleDismissOnboarding() {
    setShowOnboarding(false);
    try {
      await updateUserProfile({ onboarding_completed: true });
    } catch {
      // non-critical
    }
  }

  const navigateTo = (newPage) => {
    window.location.hash = newPage;
    setPage(newPage);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("alias");
    setAnalysisResults(null);
    setForceAnalyze(false);
    setShowOnboarding(false);
    setProfileCompletion(0);
    setHasSearched(false);
    setCurrentUser(null);
    navigateTo("home");
  };

  useEffect(() => {
    const resolve = () => {
      const hash = window.location.hash.slice(1) || "home";
      const baseHash = hash.split("?")[0] || "home";
      const hasToken = Boolean(localStorage.getItem("token"));

      if (hasToken && AUTH_ONLY.includes(baseHash) && baseHash !== "verify-email") {
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
  }, []);

  const showNavbar = PROTECTED.includes(page) && page !== "admin";
  const profileComplete = profileCompletion >= 60;
  const progressDone = profileComplete && hasSearched;

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
            } catch {
              // ignore
            }
            navigateTo("buscar");
            refreshProfileState();
          }}
        />
      )}

      {page === "verify-email" && <VerifyEmail />}

      {page === "buscar" && (
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
      {page === "mapa" && <MapaOfertas analysisResults={analysisResults} darkMode={darkMode} />}
      {page === "favoritos" && <Favoritos addToast={addToast} darkMode={darkMode} />}
      {page === "candidaturas" && <Candidaturas addToast={addToast} darkMode={darkMode} />}
      {page === "user-profile" && (
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
      {page === "admin" && (
        <Admin
          darkMode={darkMode}
          onLogout={handleLogout}
          toggleDarkMode={toggleDarkMode}
        />
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
