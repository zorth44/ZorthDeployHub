import fs from "fs";
import { Client, type ClientChannel } from "ssh2";
import { prisma } from "@/lib/prisma";

export type TerminalSession = {
  socketId: string;
  serverId: string;
  client: Client;
  stream: ClientChannel | null;
};

function loadPrivateKey() {
  const keyPath = process.env.SSH_PRIVATE_KEY_PATH;
  if (!keyPath) {
    throw new Error("SSH_PRIVATE_KEY_PATH is not configured");
  }
  if (!fs.existsSync(keyPath)) {
    throw new Error(`SSH private key not found at ${keyPath}`);
  }
  return fs.readFileSync(keyPath);
}

export class TerminalSessionManager {
  private sessions = new Map<string, TerminalSession>();

  get(socketId: string) {
    return this.sessions.get(socketId);
  }

  async open(options: {
    socketId: string;
    serverId: string;
    cols: number;
    rows: number;
    onData: (data: string) => void;
    onClose: () => void;
    onError: (message: string) => void;
  }) {
    this.close(options.socketId);

    const server = await prisma.server.findUnique({
      where: { id: options.serverId },
    });

    if (!server) {
      throw new Error("Server not found");
    }

    const privateKey = loadPrivateKey();
    const client = new Client();

    const session: TerminalSession = {
      socketId: options.socketId,
      serverId: options.serverId,
      client,
      stream: null,
    };
    this.sessions.set(options.socketId, session);

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.close(options.socketId);
        reject(new Error(message));
      };

      client.on("ready", () => {
        client.shell(
          {
            term: "xterm-256color",
            cols: options.cols,
            rows: options.rows,
          },
          (err, stream) => {
            if (err) {
              fail(err.message);
              return;
            }

            session.stream = stream;
            settled = true;
            resolve();

            stream.on("data", (chunk: Buffer) => {
              options.onData(chunk.toString("utf8"));
            });

            stream.stderr.on("data", (chunk: Buffer) => {
              options.onData(chunk.toString("utf8"));
            });

            stream.on("close", () => {
              this.close(options.socketId);
              options.onClose();
            });
          },
        );
      });

      client.on("error", (err) => {
        const message = err.message || "SSH connection failed";
        if (!settled) {
          fail(message);
        } else {
          options.onError(message);
          this.close(options.socketId);
          options.onClose();
        }
      });

      client.on("close", () => {
        if (!settled) {
          fail("SSH connection closed");
          return;
        }
        this.close(options.socketId);
        options.onClose();
      });

      client.connect({
        host: server.host,
        port: server.port,
        username: server.username,
        privateKey,
        readyTimeout: 20_000,
        // Internal team tool: accept host keys. known_hosts is still mounted for ops.
        hostVerifier: () => true,
      });
    });

    return server;
  }

  write(socketId: string, data: string) {
    const session = this.sessions.get(socketId);
    session?.stream?.write(data);
  }

  resize(socketId: string, cols: number, rows: number) {
    const session = this.sessions.get(socketId);
    session?.stream?.setWindow(rows, cols, 0, 0);
  }

  close(socketId: string) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    this.sessions.delete(socketId);

    try {
      session.stream?.close();
    } catch {
      // ignore
    }

    try {
      session.client.end();
    } catch {
      // ignore
    }
  }
}

export const terminalSessionManager = new TerminalSessionManager();
