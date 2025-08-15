import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { signToken } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { email, password, name } = schema.parse(await req.json());

    // ¿ya existe?
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hash, name },
      select: { id: true, email: true, name: true },
    });

    const token = signToken({ userId: user.id, email: user.email });
    return NextResponse.json({ user, token }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 400 });
  }
}
