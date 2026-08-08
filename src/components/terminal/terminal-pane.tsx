"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, type Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";
import { useTerminalSettings } from "@/components/terminal/terminal-settings-context";

type TerminalPaneProps = {
  serverId: string;
  active: boolean;
  onTitle?: (title: string) => void;
};

export function TerminalPane({ serverId, active, onTitle }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onTitleRef = useRef(onTitle);
  const { settings, fontFamily, theme } = useTerminalSettings();
  const settingsRef = useRef({
    fontFamily,
    fontSize: settings.fontSize,
    theme,
  });

  useEffect(() => {
    onTitleRef.current = onTitle;
  }, [onTitle]);

  useEffect(() => {
    settingsRef.current = {
      fontFamily,
      fontSize: settings.fontSize,
      theme,
    };
  }, [fontFamily, settings.fontSize, theme]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initial = settingsRef.current;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: initial.fontFamily,
      fontSize: initial.fontSize,
      lineHeight: 1.2,
      theme: initial.theme,
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

    const socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    const openSession = () => {
      const dims = fitAddon.proposeDimensions();
      socket.emit("terminal:open", {
        serverId,
        cols: dims?.cols ?? term.cols,
        rows: dims?.rows ?? term.rows,
      });
    };

    socket.on("connect", () => {
      term.writeln("\x1b[90mConnecting...\x1b[0m");
      openSession();
    });

    socket.on(
      "terminal:ready",
      (payload: { name?: string; username?: string; host?: string }) => {
        if (payload?.name) {
          onTitleRef.current?.(payload.name);
        }
        term.clear();
        term.writeln(
          `\x1b[32mConnected to ${payload.username}@${payload.host}\x1b[0m`,
        );
        term.focus();
      },
    );

    socket.on("terminal:output", (data: string) => {
      term.write(data);
    });

    socket.on("terminal:error", (payload: { message?: string }) => {
      term.writeln(
        `\r\n\x1b[31m${payload?.message ?? "Terminal error"}\x1b[0m`,
      );
    });

    socket.on("terminal:close", () => {
      term.writeln("\r\n\x1b[90mSession closed\x1b[0m");
    });

    socket.on("connect_error", (err) => {
      term.writeln(`\r\n\x1b[31mSocket error: ${err.message}\x1b[0m`);
    });

    const disposable = term.onData((data) => {
      socket.emit("terminal:input", data);
    });

    const observer = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current || !socketRef.current) return;
      fitRef.current.fit();
      socketRef.current.emit("terminal:resize", {
        cols: termRef.current.cols,
        rows: termRef.current.rows,
      });
    });
    observer.observe(containerRef.current);

    return () => {
      disposable.dispose();
      observer.disconnect();
      socket.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      socketRef.current = null;
    };
  }, [serverId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    term.options.fontFamily = fontFamily;
    term.options.fontSize = settings.fontSize;
    term.options.theme = theme;

    const frame = requestAnimationFrame(() => {
      fitRef.current?.fit();
      if (termRef.current && socketRef.current?.connected) {
        socketRef.current.emit("terminal:resize", {
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [fontFamily, settings.fontSize, theme]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      fitRef.current?.fit();
      if (termRef.current && socketRef.current?.connected) {
        socketRef.current.emit("terminal:resize", {
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        });
      }
      termRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      className={active ? "h-full w-full" : "hidden"}
      style={{ background: theme.background ?? "#0b0f14" }}
    >
      <div ref={containerRef} className="h-full w-full p-2" />
    </div>
  );
}
