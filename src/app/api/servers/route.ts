import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serverSchema } from "@/lib/validations/server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(servers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = serverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const server = await prisma.server.create({
    data: parsed.data,
  });

  return NextResponse.json(server, { status: 201 });
}
