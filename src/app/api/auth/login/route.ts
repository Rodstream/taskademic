import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signUserJWT, attachSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    // Ajuste robusto por nombre de campo
    const hash: string | undefined =
      (user as any).passwordHash ?? (user as any).hashedPassword ?? (user as any).password;
    if (!hash) return NextResponse.json({ error: "Config. de contraseña inválida" }, { status: 500 });

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = signUserJWT({ id: user.id, email: user.email });
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: (user as any).name ?? null },
    });
    attachSessionCookie(res, token); // setea cookie httpOnly
    return res;
  } catch {
    return NextResponse.json({ error: "Error en login" }, { status: 500 });
  }
}
