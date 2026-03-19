const API_URL = "http://localhost:8000";

export async function matchOffers(profile) {
  const response = await fetch(`${API_URL}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Error al conectar con el servidor");
  }

  return response.json();
}
