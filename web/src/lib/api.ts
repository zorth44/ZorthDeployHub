export type ServerRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remark: string | null;
};

export type OnlineStatus = "online" | "offline" | "unknown";

export async function fetchServers(): Promise<ServerRecord[]> {
  const res = await fetch("/api/servers", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load servers");
  return (await res.json()) as ServerRecord[];
}

export async function fetchStatus(): Promise<Record<string, OnlineStatus>> {
  const res = await fetch("/api/servers/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load status");
  return (await res.json()) as Record<string, OnlineStatus>;
}
