// src/services/api.ts
// Tiny fetch wrapper with base URL from env + token handling + 401 broadcast

let AUTH_TOKEN: string | null = localStorage.getItem("token") || null;

export function setApiToken(token: string | null) {
  AUTH_TOKEN = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

// Normalize base: ensures trailing /api is present once
function getBase() {
  const raw = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
  return raw.replace(/\/+$/, ""); // strip trailing slash
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T = any>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const base = getBase(); // e.g. http://host:3000/api
  // Accept both absolute and relative paths; if relative, prefix with base
  const url = /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  // Unauthorized → tell app
  if (res.status === 401) {
    window.dispatchEvent(new Event("app:unauthorized"));
    throw new Error("Unauthorized");
  }

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path, "GET"),
  post: <T = any>(path: string, body?: unknown) => request<T>(path, "POST", body),
  put:  <T = any>(path: string, body?: unknown) => request<T>(path, "PUT", body),
  patch:<T = any>(path: string, body?: unknown) => request<T>(path, "PATCH", body),
  del:  <T = any>(path: string) => request<T>(path, "DELETE"),
};
