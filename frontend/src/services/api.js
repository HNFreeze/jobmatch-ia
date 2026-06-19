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

function buildCvQuery({ template = null, fitOnePage = null, variantId = null } = {}) {
  const query = new URLSearchParams();
  if (template) query.set("template", template);
  if (fitOnePage != null) query.set("fit_one_page", String(Boolean(fitOnePage)));
  if (variantId != null) query.set("variant_id", String(variantId));
  return query;
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

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
    const msg = seconds
      ? `Demasiadas peticiones. Puedes volver a intentarlo en ${seconds}s.`
      : (error.detail || "Demasiadas peticiones. Espera un momento antes de volver a intentarlo.");
    const err = new Error(msg);
    err.status = 429;
    err.retryAfter = seconds;
    err.isRateLimit = true;
    return err;
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

export async function loadMoreOffers({ experience, stack, english, ubicaciones, modalidad, idiomas, exclude_ids, adzuna_page, results_count }) {
  const response = await fetch(`${API_URL}/api/match/more`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ experience, stack, english, ubicaciones, modalidad, idiomas, exclude_ids, adzuna_page, results_count }),
  });
  if (!response.ok) throw await buildApiError(response, "Error cargando más ofertas");
  return response.json();
}

// ── Agente personal de empleo ───────────────────────────────────────────────
export async function agentSearch(instruction, overrideFilters = null) {
  const response = await fetch(`${API_URL}/api/agent/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instruction, override_filters: overrideFilters }),
  });
  if (!response.ok) throw await buildApiError(response, "El agente no pudo completar la búsqueda");
  return response.json();
}

export async function getAgentRuns() {
  const response = await fetch(`${API_URL}/api/agent/runs`, { headers: authHeaders() });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el historial del agente");
  return response.json();
}

export async function getAgentRun(runId) {
  const response = await fetch(`${API_URL}/api/agent/runs/${runId}`, { headers: authHeaders() });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el run del agente");
  return response.json();
}

export async function confirmAgentRun(runId, offerIds) {
  const response = await fetch(`${API_URL}/api/agent/runs/${runId}/confirm`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ offer_ids: offerIds }),
  });
  if (!response.ok) throw await buildApiError(response, "No se pudieron guardar las ofertas seleccionadas");
  return response.json();
}

export async function cancelAgentRun(runId) {
  const response = await fetch(`${API_URL}/api/agent/runs/${runId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "No se pudo cancelar el run");
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

export async function updateConsent(accepted) {
  const response = await fetch(`${API_URL}/api/user/consent`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ accepted }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al guardar preferencia");
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
    body: JSON.stringify({ oferta, perfil }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al generar la carta");
  return response.json();
}

// CV Analysis
export async function analyzeCV(file) {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/cv/analyze`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw await buildApiError(response, "Error al analizar el CV");
  return response.json();
}

export async function getLatestCVAnalysis() {
  const response = await fetch(`${API_URL}/api/cv/latest`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el análisis de CV");
  return response.json();
}

export async function improveCV(file) {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/cv/improve`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw await buildApiError(response, "Error al mejorar el CV");
  return response.json();
}

export async function improveCVFull(file) {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/cv/improve-full`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw await buildApiError(response, "Error al mejorar el CV");
  return response.json();
}

export async function downloadCVPdf(improvementId, template = null, fitOnePage = null, variantId = null) {
  const query = buildCvQuery({ template, fitOnePage, variantId });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_URL}/api/cv/download-pdf/${improvementId}${suffix}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al descargar el PDF");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  // Always trigger a real file download — never open in a new tab.
  // Using <a download> is the most reliable cross-browser approach.
  const a = document.createElement("a");
  a.href = url;
  a.download = variantId != null
    ? `cv_mejorado_${improvementId}_variante_${variantId}.pdf`
    : `cv_mejorado_${improvementId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function getMyImprovements() {
  const response = await fetch(`${API_URL}/api/cv/my-improvements`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar tus CVs mejorados");
  return response.json();
}

export async function searchFromImprovement(improvementId) {
  const response = await fetch(`${API_URL}/api/cv/search-from-improvement/${improvementId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al buscar ofertas desde CV mejorado");
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

export async function getAdminJobIngestionRuns(limit = 12) {
  const response = await fetch(`${API_URL}/api/admin/job-ingestion/runs?limit=${encodeURIComponent(limit)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar las ejecuciones de ingesta");
  return response.json();
}

export async function getAdminJobIndexHealth() {
  const response = await fetch(`${API_URL}/api/admin/job-index/health`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar la salud del índice de ofertas");
  return response.json();
}

export async function getAdminJobSourceStatus() {
  const response = await fetch(`${API_URL}/api/admin/job-sources/status`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el estado de las fuentes de ofertas");
  return response.json();
}

export async function startAdminJobIngestion(payload = {}) {
  const response = await fetch(`${API_URL}/api/admin/job-ingestion/run`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await buildApiError(response, "Error al lanzar la ingesta manual");
  return response.json();
}

export async function getCVEdit(improvementId, variantId = null) {
  const query = buildCvQuery({ variantId });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/edit${suffix}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar la sesión de edición del CV");
  return response.json();
}

export async function saveCVEdit(improvementId, editedCvJson, actionLog, variantId = null) {
  const query = buildCvQuery({ variantId });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/edit${suffix}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ edited_cv_json: editedCvJson, action_log: actionLog }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al guardar los cambios del CV");
  return response.json();
}

export async function downloadCVPdfFromEdit(improvementId, template = "professional_modern", fitOnePage = null, variantId = null) {
  const query = buildCvQuery({ template, fitOnePage, variantId });
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/pdf?${query.toString()}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al generar el PDF del CV");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  // Always trigger a real file download — never open in a new tab.
  const a = document.createElement("a");
  a.href = url;
  a.download = variantId != null
    ? `cv_mejorado_${improvementId}_variante_${variantId}.pdf`
    : `cv_mejorado_${improvementId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function listCVVariants(improvementId) {
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/variants`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar las variantes del CV");
  return response.json();
}

export async function createCVVariant(improvementId, payload) {
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/variants`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) throw await buildApiError(response, "Error al crear la variante del CV");
  return response.json();
}

export async function optimizeCVVariantForOffer(improvementId, variantId) {
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/optimize-for-offer?variant_id=${variantId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al optimizar el CV para esta oferta");
  return response.json();
}

export async function deleteCVVariant(improvementId, variantId) {
  const response = await fetch(`${API_URL}/api/cv/improvement/${improvementId}/variants/${variantId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al eliminar la variante del CV");
  return response.json();
}

// ── Feedback de matching ──────────────────────────────────────────────────────

export async function submitMatchFeedback({ adzuna_id, rating, offer_score, offer_result }) {
  const response = await fetch(`${API_URL}/api/match/feedback`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ adzuna_id, rating, offer_score, offer_result }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al guardar el feedback");
  return response.json();
}

export async function getMatchFeedback() {
  const response = await fetch(`${API_URL}/api/match/feedback`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al obtener el feedback");
  return response.json();
}
export async function getMarketAnalysis() {
  const response = await fetch(`${API_URL}/api/match/market-analysis`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al obtener análisis de mercado");
  return response.json();
}

// ── JWT Refresh ───────────────────────────────────────────────────────────────

export async function refreshToken() {
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "No se pudo renovar la sesión");
  return response.json();
}

/** Decode JWT payload (no signature verification — server validates on every call). */
export function getTokenExpiresAt() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null; // ms
  } catch {
    return null;
  }
}

// ── Notificaciones in-app ─────────────────────────────────────────────────────

export async function getNotifications(unreadOnly = false) {
  const response = await fetch(
    `${API_URL}/api/notifications${unreadOnly ? "?unread_only=true" : ""}`,
    { headers: authHeaders() },
  );
  if (!response.ok) throw await buildApiError(response, "Error al cargar notificaciones");
  return response.json();
}

export async function markNotificationRead(id) {
  const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al marcar notificación");
  return response.json();
}

export async function markAllNotificationsRead() {
  const response = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al marcar notificaciones");
  return response.json();
}

// ── Interview ─────────────────────────────────────────────────────────────────

export async function startInterview({ job_title, company, job_description, application_id }) {
  const response = await fetch(`${API_URL}/api/interview/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ job_title, company, job_description, application_id }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al iniciar la entrevista");
  return response.json();
}

export async function sendInterviewMessage(sessionId, content) {
  const response = await fetch(`${API_URL}/api/interview/${sessionId}/message`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw await buildApiError(response, "Error enviando mensaje");
  return response.json();
}

export async function endInterview(sessionId) {
  const response = await fetch(`${API_URL}/api/interview/${sessionId}/end`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al finalizar la entrevista");
  return response.json();
}

export async function getInterviewSessions() {
  const response = await fetch(`${API_URL}/api/interview/sessions`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al obtener sesiones");
  return response.json();
}

// ── Admin: Calidad del motor de matching ──────────────────────────────────────

export async function getMatchingQualityMetrics() {
  const response = await fetch(`${API_URL}/api/admin/matching-quality`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar métricas de calidad del matching");
  return response.json();
}

// ── Admin: Exportar CSV de evaluación ─────────────────────────────────────────

export async function exportEvaluationCsv() {
  const response = await fetch(`${API_URL}/api/admin/export/evaluation-csv`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al exportar CSV");
  const blob = await response.blob();
  const cd = response.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : "jobmatch_evaluacion.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Admin: Limpieza de usuarios inactivos ─────────────────────────────────────

export async function cleanupInactiveUsers({ daysInactive = 30, dryRun = true } = {}) {
  const response = await fetch(
    `${API_URL}/api/admin/cleanup/inactive-users?days_inactive=${daysInactive}&dry_run=${dryRun}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!response.ok) throw await buildApiError(response, "Error en limpieza de usuarios");
  return response.json();
}

// ── Skills roadmap ────────────────────────────────────────────────────────────

export async function getSkillsRoadmap() {
  const response = await fetch(`${API_URL}/api/match/skills-roadmap`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await buildApiError(response, "Error al cargar el roadmap de skills");
  return response.json();
}

// ── Encuesta de satisfacción ──────────────────────────────────────────────────

export async function submitSearchSatisfaction({ rating, comment = "" }) {
  const response = await fetch(`${API_URL}/api/match/satisfaction`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ rating, comment }),
  });
  if (!response.ok) throw await buildApiError(response, "Error al enviar la valoración");
  return response.json();
}

// ── Health check (público) ────────────────────────────────────────────────────

export async function getHealthStatus() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error("API no disponible");
  return response.json();
}
