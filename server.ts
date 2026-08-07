import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { attachTerminalSocket } from "./src/lib/terminal/socket-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.APP_HOSTNAME || "localhost";
const listenHost = process.env.LISTEN_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      void handle(req, res, parsedUrl);
    });

    attachTerminalSocket(httpServer);

    httpServer.listen(port, listenHost, () => {
      console.log(`> ZorthDeployHub ready on http://${listenHost}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
