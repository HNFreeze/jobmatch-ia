import { useState, useEffect } from "react";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";

function App() {
  const [page, setPage] = useState("home");

  // Simple routing based on URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || "home";
      setPage(hash);
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (newPage) => {
    window.location.hash = newPage;
    setPage(newPage);
  };

  return (
    <div>
      {page === "home" && (
        <Landing onStartClick={() => navigateTo("perfil")} />
      )}
      {page === "perfil" && (
        <Profile onBackClick={() => navigateTo("home")} />
      )}
    </div>
  );
}

export default App;
