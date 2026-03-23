const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:8001").replace(/\/$/, "");

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function buildApiError(response, fallbackMessage) {
  const error = await response.json().catch(() => ({}));
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
