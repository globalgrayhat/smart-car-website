// frontend/src/services/api.ts
// Unified API client for the whole frontend.
// - Reads base URL from Vite envs
// - Attaches bearer token if present
// - Emits a global "app:unauthorized" event on 401
// - Exposes get/post/put/delete helpers with typed responses

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")) ||
  "http://localhost:3000";

let currentToken: string | null =
  localStorage.getItem("token") || localStorage.getItem("access_token") || null;

/**
 * Set / clear the current API token.
 * Call this after login / logout.
 */
export function setApiToken(token: string | null) {
  currentToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

/**
 * Internal request helper.
 */
async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // common 401 handling across the whole frontend
  if (res.status === 401) {
    // tell AuthContext to logout
    window.dispatchEvent(new CustomEvent("app:unauthorized"));
    throw new Error("Unauthorized");
  }

  // try to parse json, but keep it safe
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!res.ok) {
    const msg =
      (data as any)?.message || (data as any)?.error || "Request failed";
    throw new Error(msg);
  }

  return data;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T = any>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
};
