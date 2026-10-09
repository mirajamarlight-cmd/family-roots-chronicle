import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { SESSION_COOKIE } from "@/server/auth/session";

const MAX_AGE_SEC = 30 * 24 * 60 * 60;

export function readSessionToken(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export function writeSessionCookie(token: string, expiresAt: Date): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: MAX_AGE_SEC,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
