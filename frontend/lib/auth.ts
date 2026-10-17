"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const API_BASE = "/api/backend";
// Dev-only storage; move to httpOnly cookies when deploying.
const TOKEN_KEY = "jaypilot_token";

export type User = { id: number; name: string; email: string; created_at: string };

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => window.localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}

async function post(path: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, "Something went wrong. Please try again."));
  return data;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await post("/auth/login", { email, password });
  setToken(data.access_token);
  return data.user as User;
}

export async function register(name: string, email: string, password: string): Promise<{ emailSent: boolean }> {
  const data = await post("/auth/register", { name, email, password });
  return { emailSent: data?.email_sent !== false };
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  await post("/auth/verify-email", { email, code });
}

export async function resendVerification(email: string): Promise<void> {
  await post("/auth/resend-verification", { email });
}

export async function fetchMe(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    if (response.status === 401) clearToken();
    return response.ok ? ((await response.json()) as User) : null;
  } catch {
    return null;
  }
}

// Verifies the token with the backend on every mount; the stored token alone is never trusted.
export function useRequireUser(): { user: User | null; signOut: () => void } {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    fetchMe().then((me) => {
      if (!active) return;
      if (me) setUser(me);
      else router.replace("/signin");
    });
    return () => {
      active = false;
    };
  }, [router]);

  function signOut() {
    clearToken();
    router.push("/");
  }

  return { user, signOut };
}
