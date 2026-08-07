import net from "net";

export type OnlineStatus = "online" | "offline";

export function probeTcp(
  host: string,
  port: number,
  timeoutMs = 2000,
): Promise<OnlineStatus> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (status: OnlineStatus) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("online"));
    socket.once("timeout", () => finish("offline"));
    socket.once("error", () => finish("offline"));
    socket.connect(port, host);
  });
}

export async function probeServers(
  servers: Array<{ id: string; host: string; port: number }>,
): Promise<Record<string, OnlineStatus>> {
  const entries = await Promise.all(
    servers.map(async (server) => {
      const status = await probeTcp(server.host, server.port);
      return [server.id, status] as const;
    }),
  );
  return Object.fromEntries(entries);
}
