import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signUserJWT, attachSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    // ── Ajuste robusto del nombre del campo de hash ─────────────────────────────
    // Adapta automáticamente si tu columna se llama passwordHash / hashedPassword / password
    const hash: string | undefined =
      (user as any).passwordHash ??
      (user as any).hashedPassword ??
      (user as any).password;

    if (!hash || typeof hash !== "string") {
      // Si llega acá, tu schema no tiene un campo de hash esperado
      return NextResponse.json(
        { error: "Configuración de contraseña inválida en el usuario" },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }
    // ───────────────────────────────────────────────────────────────────────────

    const token = signUserJWT({ id: user.id, email: user.email });

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
    });
    attachSessionCookie(res, token); // cookie httpOnly
    return res;
  } catch {
    return NextResponse.json({ error: "Error en login" }, { status: 500 });
  }
}
