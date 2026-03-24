const CLARITY_ID = process.env.REACT_APP_CLARITY_ID;

export function initClarity({ isAdmin = false } = {}) {
  if (!CLARITY_ID) return;
  if (isAdmin) return; // never track admin sessions
  if (document.getElementById("clarity-script")) return;

  // Official Clarity inline snippet (dynamically injected)
  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };

  const script = document.createElement("script");
  script.id = "clarity-script";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

export function stopClarity() {
  const script = document.getElementById("clarity-script");
  if (script) script.remove();
  // Opt the session out so Clarity stops recording
  if (typeof window.clarity === "function") {
    window.clarity("consent", false);
  }
}
