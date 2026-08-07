import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { probeServers } from "@/lib/server-status";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.server.findMany({
    select: { id: true, host: true, port: true },
  });

  const status = await probeServers(servers);
  return NextResponse.json(status);
}
