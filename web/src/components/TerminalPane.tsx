import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useT } from "../i18n/useT";

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

type ContextMenuState = {
  x: number;
  y: number;
  hasSelection: boolean;
};

/** xterm measures glyphs on canvas; CSS variables are not resolved there. */
const TERMINAL_FONT_FAMILY =
  '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

function wsURL() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/terminal/ws`;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}

async function readClipboard(): Promise<string> {
  if (!navigator.clipboard?.readText) {
    throw new Error("clipboard read unavailable");
  }
  return navigator.clipboard.readText();
}

export function TerminalPane({ serverId, active, onTitle }: TerminalPaneProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onTitleRef = useRef(onTitle);
  const tRef = useRef(t);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    onTitleRef.current = onTitle;
  }, [onTitle]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: 14,
      lineHeight: 1.2,
      // Custom context menu handles copy/paste; disable word-select on right-click.
      rightClickSelectsWord: false,
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

    const fitWhenReady = () => {
      fitAddon.fit();
    };
    fitWhenReady();
    void document.fonts.ready.then(fitWhenReady);

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

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setActionError(null);
      setMenu({
        x: event.clientX,
        y: event.clientY,
        hasSelection: term.hasSelection() && term.getSelection().length > 0,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        const text = term.getSelection();
        if (!text) return;
        event.preventDefault();
        void writeClipboard(text).catch(() => {
          setActionError(tRef.current("terminal.copyFailed"));
        });
      } else if (key === "v") {
        event.preventDefault();
        void readClipboard()
          .then((text) => {
            if (text) term.paste(text);
          })
          .catch(() => {
            setActionError(tRef.current("terminal.pasteFailed"));
          });
      }
    };

    const el = term.element;
    el?.addEventListener("contextmenu", onContextMenu);
    el?.addEventListener("keydown", onKeyDown);

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
      el?.removeEventListener("contextmenu", onContextMenu);
      el?.removeEventListener("keydown", onKeyDown);
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

  useEffect(() => {
    if (!menu && !actionError) return;
    const close = () => {
      setMenu(null);
      setActionError(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, actionError]);

  async function handleCopy() {
    const term = termRef.current;
    const text = term?.getSelection() ?? "";
    setMenu(null);
    if (!text) return;
    try {
      await writeClipboard(text);
      term?.focus();
    } catch {
      setActionError(t("terminal.copyFailed"));
    }
  }

  async function handlePaste() {
    const term = termRef.current;
    setMenu(null);
    if (!term) return;
    try {
      const text = await readClipboard();
      if (text) term.paste(text);
      term.focus();
    } catch {
      setActionError(t("terminal.pasteFailed"));
    }
  }

  return (
    <div
      className={active ? "relative h-full w-full" : "hidden"}
      style={{ background: "#0b0f14" }}
    >
      <div ref={containerRef} className="h-full w-full p-2" />
      {menu ? (
        <div
          role="menu"
          className="fixed z-50 min-w-28 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-sm shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!menu.hasSelection}
            className="block w-full px-3 py-1.5 text-left text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void handleCopy()}
          >
            {t("terminal.copy")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            onClick={() => void handlePaste()}
          >
            {t("terminal.paste")}
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-muted-foreground)] shadow-lg">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}
