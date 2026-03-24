const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:8001").replace(/\/$/, "");

const FORCED_LOGOUT_MESSAGES = {
  account_blocked: "Tu cuenta ha sido bloqueada y la sesión se ha cerrado. Si necesitas ayuda, contacta con administración.",
  token_invalid: "Tu sesión ha caducado o ya no es válida. Inicia sesión de nuevo para continuar.",
  session_invalid: "Tu sesión ya no está disponible. Vuelve a iniciar sesión para continuar.",
};

function forceLogoutFromServer(reason = "session_invalid") {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("jobmatch_auth_message", FORCED_LOGOUT_MESSAGES[reason] || FORCED_LOGOUT_MESSAGES.session_invalid);
    sessionStorage.setItem("jobmatch_auth_message_type", "error");
  } catch {
    // Non-critical UI hint.
  }
  localStorage.removeItem("token");
  localStorage.removeItem("email");
  localStorage.removeItem("alias");
  window.dispatchEvent(new CustomEvent("jobmatch:force-logout", { detail: { reason } }));
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function buildApiError(response, fallbackMessage) {
  const error = await response.json().catch(() => ({}));
  const detailText = typeof error.detail === "string" ? error.detail : "";

  if (
    response.status === 401 ||
    (response.status === 403 && (
      error.code === "account_blocked" ||
      detailText.toLowerCase().includes("bloquead")
    ))
  ) {
    forceLogoutFromServer(error.code || (response.status === 401 ? "token_invalid" : "account_blocked"));
  }

  const err = new Error(error.detail || fallbackMessage);
  Object.assign(err, error);
  err.status = response.status;
  return err;
}

export async function matchOffers(profile) {
  const response = await fetch(`${API_URL}/api/match`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw await buildApiError(response, "Error al conectar con el servidor");
  return response.json();
}

export async function login(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al iniciar sesión");
  return response.json();
}

export async function register(email, password, alias, nombre, apellidos, turnstileToken) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      alias,
      nombre: nombre || null,
      apellidos: apellidos || null,
      turnstile_token: turnstileToken,
    }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al registrarse");
  return response.json();
}

export async function verifyEmailToken(token) {
  const response = await fetch(`${API_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al verificar el email");
  return response.json();
}

export async function resendVerificationEmail(email) {
  const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al reenviar el email de verificación");
  return response.json();
}

export async function getUserProfile() {
  const response = await fetch(`${API_URL}/api/user/profile`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar perfil");
  return response.json();
}

export async function getAiQuota() {
  const response = await fetch(`${API_URL}/api/user/ai-quota`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar la cuota IA");
  return response.json();
}

// Applications
export async function getApplications() {
  const res = await fetch(`${API_URL}/api/applications`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw await buildApiError(res, "Error al obtener candidaturas");
  return res.json();
}

export async function createApplication(data) {
  const res = await fetch(`${API_URL}/api/applications`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al crear candidatura");
  return res.json();
}

export async function updateApplication(id, data) {
  const res = await fetch(`${API_URL}/api/applications/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar candidatura");
  return res.json();
}

export async function deleteApplication(id) {
  const res = await fetch(`${API_URL}/api/applications/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw await buildApiError(res, "Error al eliminar candidatura");
  return res.json();
}

export async function updateUserProfile(data) {
  const response = await fetch(`${API_URL}/api/user/profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await buildApiError(response, "Error al guardar perfil");
  return response.json();
}

// Favorites
export async function getFavorites() {
  const response = await fetch(`${API_URL}/api/favorites`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar favoritas");
  return response.json();
}

export async function addFavorite(data) {
  const response = await fetch(`${API_URL}/api/favorites`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await buildApiError(response, "Error al añadir favorita");
  return response.json();
}

export async function removeFavorite(adzunaId) {
  const response = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(adzunaId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al eliminar favorita");
  return response.json();
}

// Search history
export async function saveHistory(data) {
  const response = await fetch(`${API_URL}/api/history`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await buildApiError(response, "Error al guardar historial");
  return response.json();
}

export async function getHistory() {
  const response = await fetch(`${API_URL}/api/history`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar historial");
  return response.json();
}

// Password change
export async function changePassword(currentPassword, newPassword) {
  const response = await fetch(`${API_URL}/api/user/password`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cambiar la contraseña");
  return response.json();
}

export async function deleteAccount(currentPassword, confirmationText) {
  const response = await fetch(`${API_URL}/api/user/account`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({
      current_password: currentPassword,
      confirmation_text: confirmationText,
    }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al eliminar la cuenta");
  return response.json();
}

// Cover letter
export async function generateCoverLetter(oferta, perfil) {
  const response = await fetch(`${API_URL}/api/cover-letter`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al generar la carta");
  return response.json();
}

// Company
export async function getCompanyInfo(name) {
  const response = await fetch(`${API_URL}/api/company/${encodeURIComponent(name)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar info de empresa");
  return response.json();
}

// Admin
export async function getAdminDashboard() {
  const response = await fetch(`${API_URL}/api/admin/dashboard`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el dashboard admin");
  return response.json();
}

export async function getAdminUsers(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const response = await fetch(`${API_URL}/api/admin/users?${query.toString()}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar usuarios admin");
  return response.json();
}

export async function getAdminActivity(limit = 20) {
  const response = await fetch(`${API_URL}/api/admin/activity?limit=${encodeURIComponent(limit)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar actividad admin");
  return response.json();
}

export async function getAdminAiUsage() {
  const response = await fetch(`${API_URL}/api/admin/ai-usage`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar uso IA admin");
  return response.json();
}

export async function updateAdminUserQuota(userId, dailyAiQuota) {
  const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/quota`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ daily_ai_quota: dailyAiQuota }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al actualizar la cuota del usuario");
  return response.json();
}

export async function updateAdminUserBlock(userId, isBlocked) {
  const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/block`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ is_blocked: isBlocked }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al actualizar el bloqueo del usuario");
  return response.json();
}

export async function deleteAdminUser(userId, confirmationCode) {
  const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ confirmation_code: confirmationCode }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al eliminar el usuario");
  return response.json();
}

export async function resetAdminUserQuotaUsage(userId) {
  const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/quota/reset`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirm: true }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al resetear el uso diario del usuario");
  return response.json();
}

export async function clearAdminCache() {
  const response = await fetch(`${API_URL}/api/admin/cache/clear`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al limpiar el caché");
  return response.json();
}
