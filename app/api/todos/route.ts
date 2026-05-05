import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";

export async function GET() {
  const user = await requireAuth();
  const todos = await prisma.personalTodo.findMany({
    where: { userId: user.id },
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
  return NextResponse.json({ todos });
}

export async function POST(request: Request) {
  const user = await requireAuth();
  const body = await request.json().catch(() => ({}));
  const text = sanitizeText(body.text, 200);
  if (!text || text.length < 1) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  const todo = await prisma.personalTodo.create({
    data: { userId: user.id, text },
  });
  return NextResponse.json({ todo });
}
