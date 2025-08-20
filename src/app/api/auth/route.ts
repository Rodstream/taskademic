import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, clearSessionCookieOn } from "@/lib/auth";

// Devuelve el usuario actual leyendo el token de la cookie httpOnly
export async function GET(req: NextRequest) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    // No lanza 401 para facilitar el flujo del cliente
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user });
}

// Logout: elimina cookie y devuelve ok
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOn(res);
  return res;
}
