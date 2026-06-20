/**
 * Authentication API client and token management.
 * Stores JWT in localStorage and provides helpers for all auth operations.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
  organization_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auraos_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auraos_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("auraos_token");
  localStorage.removeItem("auraos_user");
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auraos_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem("auraos_user", JSON.stringify(user));
}

// ---------------------------------------------------------------------------
// Auth-enabled fetch wrapper
// ---------------------------------------------------------------------------

export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Auth API Calls
// ---------------------------------------------------------------------------

export async function register(
  name: string,
  email: string,
  password: string,
  organizationName: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      organization_name: organizationName,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed.");
  }

  const data: AuthResponse = await res.json();
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed.");
  }

  const data: AuthResponse = await res.json();
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function fetchMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) {
      removeToken();
      return null;
    }
    const user: User = await res.json();
    setStoredUser(user);
    return user;
  } catch {
    return null;
  }
}

export function logout(): void {
  removeToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
