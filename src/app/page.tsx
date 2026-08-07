import { AppHeader } from "@/components/app-header";
import { ServerList } from "@/components/servers/server-list";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <ServerList initialServers={servers} />
      </main>
    </div>
  );
}
