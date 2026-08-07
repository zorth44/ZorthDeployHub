import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

type TerminalPaneProps = {
  serverId: string;
  active: boolean;
  onTitle?: (title: string) => void;
};

type WSMessage = {
  type: string;
  name?: string;
  username?: string;
  host?: string;
  data?: string;
  message?: string;
};

function wsURL() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/terminal/ws`;
}

export function TerminalPane({ serverId, active, onTitle }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onTitleRef = useRef(onTitle);

  useEffect(() => {
    onTitleRef.current = onTitle;
  }, [onTitle]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: "#0b0f14",
        foreground: "#e5e7eb",
        cursor: "#34d399",
        selectionBackground: "#334155",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const linksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    const socket = new WebSocket(wsURL());
    socketRef.current = socket;

    const send = (payload: Record<string, unknown>) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    };

    const openSession = () => {
      const dims = fitAddon.proposeDimensions();
      send({
        type: "terminal:open",
        serverId,
        cols: dims?.cols ?? term.cols,
        rows: dims?.rows ?? term.rows,
      });
    };

    socket.addEventListener("open", () => {
      term.writeln("\x1b[90mConnecting...\x1b[0m");
      openSession();
    });

    socket.addEventListener("message", (event) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(String(event.data)) as WSMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "terminal:ready":
          if (msg.name) onTitleRef.current?.(msg.name);
          term.clear();
          term.writeln(
            `\x1b[32mConnected to ${msg.username}@${msg.host}\x1b[0m`,
          );
          term.focus();
          break;
        case "terminal:output":
          if (msg.data) term.write(msg.data);
          break;
        case "terminal:error":
          term.writeln(
            `\r\n\x1b[31m${msg.message ?? "Terminal error"}\x1b[0m`,
          );
          break;
        case "terminal:close":
          term.writeln("\r\n\x1b[90mSession closed\x1b[0m");
          break;
      }
    });

    socket.addEventListener("error", () => {
      term.writeln("\r\n\x1b[31mSocket error\x1b[0m");
    });

    const disposable = term.onData((data) => {
      send({ type: "terminal:input", data });
    });

    const observer = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current || !socketRef.current) return;
      fitRef.current.fit();
      send({
        type: "terminal:resize",
        cols: termRef.current.cols,
        rows: termRef.current.rows,
      });
    });
    observer.observe(containerRef.current);

    return () => {
      disposable.dispose();
      observer.disconnect();
      socket.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      socketRef.current = null;
    };
  }, [serverId]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      fitRef.current?.fit();
      if (
        termRef.current &&
        socketRef.current?.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            type: "terminal:resize",
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          }),
        );
      }
      termRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      className={active ? "h-full w-full" : "hidden"}
      style={{ background: "#0b0f14" }}
    >
      <div ref={containerRef} className="h-full w-full p-2" />
    </div>
  );
}
