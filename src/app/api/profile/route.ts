// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

// ---- type guard: garantiza un id numérico ----
type AuthLike = { id: number | string };

function requireAuthId(auth: unknown): { id: number } | null {
  const a = auth as AuthLike | null;
  if (!a || a.id === undefined || a.id === null) return null;
  const idNum = typeof a.id === 'string' ? parseInt(a.id, 10) : a.id;
  if (Number.isNaN(idNum)) return null;
  return { id: idNum };
}
// ----------------------------------------------

export async function GET(req: NextRequest) {
  const authRaw = await getUserFromRequest(req);
  const auth = requireAuthId(authRaw);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const authRaw = await getUserFromRequest(req);
  const auth = requireAuthId(authRaw);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const newPassword = typeof body.password === 'string' ? body.password.trim() : undefined;

  if (!name && !newPassword) {
    return NextResponse.json({ error: 'No se enviaron cambios' }, { status: 400 });
  }

  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name;

  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }
    data.password = await bcrypt.hash(newPassword, 10); // guarda hash bcrypt en el mismo campo
  }

  const updated = await prisma.user.update({
    where: { id: auth.id },
    data,
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ user: updated });
}
