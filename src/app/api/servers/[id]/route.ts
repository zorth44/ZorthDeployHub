import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serverSchema } from "@/lib/validations/server";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.server.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = serverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const server = await prisma.server.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(server);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.server.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  await prisma.server.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
