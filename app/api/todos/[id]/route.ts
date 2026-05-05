import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.personalTodo.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.personalTodo.update({
    where: { id },
    data: { completed: typeof body.completed === "boolean" ? body.completed : existing.completed },
  });
  return NextResponse.json({ todo: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const existing = await prisma.personalTodo.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.personalTodo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
