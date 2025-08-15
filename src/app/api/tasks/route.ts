import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
// Si usas auth por token, importa tu helper
import { getUserFromRequest } from '@/lib/auth'; // ajusta el path si fuera distinto

const createSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(), // ISO
});

export async function GET(req: NextRequest) {
  const auth = getUserFromRequest?.(req); // si no usas auth, quita estas 2 líneas y el where
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  });

  // evita cache
  const res = NextResponse.json({ tasks });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function POST(req: NextRequest) {
  const auth = getUserFromRequest?.(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, dueDate } = createSchema.parse(body);

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: auth.userId,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bad request' }, { status: 400 });
  }
}
