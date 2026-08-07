import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { getToken } from "next-auth/jwt";
import { terminalSessionManager } from "@/lib/terminal/session-manager";

type OpenPayload = {
  serverId: string;
  cols?: number;
  rows?: number;
};

type ResizePayload = {
  cols: number;
  rows: number;
};

function getCookieHeader(socket: Socket) {
  const header = socket.request.headers.cookie;
  if (!header) return "";
  return Array.isArray(header) ? header.join(";") : header;
}

async function authorizeSocket(socket: Socket) {
  const token = await getToken({
    req: {
      headers: {
        cookie: getCookieHeader(socket),
      },
    },
    secret: process.env.AUTH_SECRET,
  });
  return token;
}

export function attachTerminalSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: {
      origin: false,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = await authorizeSocket(socket);
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.user = token;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("terminal:open", async (payload: OpenPayload) => {
      try {
        if (!payload?.serverId) {
          socket.emit("terminal:error", { message: "serverId is required" });
          return;
        }

        const cols = Math.max(20, Math.min(payload.cols ?? 80, 500));
        const rows = Math.max(10, Math.min(payload.rows ?? 24, 200));

        const server = await terminalSessionManager.open({
          socketId: socket.id,
          serverId: payload.serverId,
          cols,
          rows,
          onData: (data) => {
            socket.emit("terminal:output", data);
          },
          onClose: () => {
            socket.emit("terminal:close");
          },
          onError: (message) => {
            socket.emit("terminal:error", { message });
          },
        });

        socket.emit("terminal:ready", {
          serverId: server.id,
          name: server.name,
          host: server.host,
          username: server.username,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to open terminal";
        socket.emit("terminal:error", { message });
      }
    });

    socket.on("terminal:input", (data: string) => {
      if (typeof data !== "string") return;
      terminalSessionManager.write(socket.id, data);
    });

    socket.on("terminal:resize", (payload: ResizePayload) => {
      if (!payload) return;
      const cols = Math.max(20, Math.min(payload.cols ?? 80, 500));
      const rows = Math.max(10, Math.min(payload.rows ?? 24, 200));
      terminalSessionManager.resize(socket.id, cols, rows);
    });

    socket.on("disconnect", () => {
      terminalSessionManager.close(socket.id);
    });
  });

  return io;
}
