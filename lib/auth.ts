// lib/auth.ts
import jwt, { JwtPayload } from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "dev_secret_change_me";

// Payload que usamos en el JWT
export type TokenPayload = JwtPayload & { sub: number; email: string };

// === FIRMA Y VERIFICACIÓN =====================================================
export function signUserJWT(user: { id: number; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email } as TokenPayload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyJWT(token?: string): TokenPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// === EXTRACCIÓN DE USUARIO DESDE LA REQUEST ==================================
export function getUserFromRequest(
  req: NextRequest
): { userId: number; email: string } | null {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    const payload = verifyJWT(token);
    if (payload) return { userId: payload.sub, email: payload.email };
  }
  // 2) Cookie httpOnly 'session_token'
  const cookie = req.cookies.get("session_token")?.value;
  const payload = verifyJWT(cookie);
  return payload ? { userId: payload.sub, email: payload.email } : null;
}

// === COOKIES EN RESPUESTA (para login/logout) =================================
export function attachSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set({
    name: "session_token",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
  return res;
}

export function clearSessionCookieOn(res: NextResponse): NextResponse {
  res.cookies.delete("session_token");
  return res;
}
