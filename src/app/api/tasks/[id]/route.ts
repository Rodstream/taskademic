import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth"; 

// PATCH - actualizar tarea (con ownership)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await req.json();
    const task = await prisma.task.update({
      where: { id },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        dueDate: data.dueDate
          ? new Date(data.dueDate) // recibe string "YYYY-MM-DD"
          : existing.dueDate,
        completed:
          typeof data.completed === "boolean" ? data.completed : existing.completed,
      },
    });

    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 400 });
  }
}

// DELETE - eliminar tarea (con ownership)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 400 });
  }
}
