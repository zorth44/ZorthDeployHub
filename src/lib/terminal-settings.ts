import type { ITheme } from "@xterm/xterm";

export const TERMINAL_SETTINGS_KEY = "zorth-terminal-settings";

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_DEFAULT = 14;

export type FontId =
  | "jetbrains"
  | "fira-code"
  | "geist-mono"
  | "ibm-plex-mono"
  | "source-code-pro"
  | "system";

export type ThemeId =
  | "default"
  | "dracula"
  | "one-dark"
  | "nord"
  | "solarized-dark"
  | "monokai"
  | "github-light";

export type TerminalSettings = {
  fontId: FontId;
  fontSize: number;
  themeId: ThemeId;
};

export type FontOption = {
  id: FontId;
  label: string;
  family: string;
};

export type ThemeOption = {
  id: ThemeId;
  label: string;
  theme: ITheme;
};

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    family:
      "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "fira-code",
    label: "Fira Code",
    family:
      "var(--font-fira-code), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "geist-mono",
    label: "Geist Mono",
    family:
      "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    family:
      "var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "source-code-pro",
    label: "Source Code Pro",
    family:
      "var(--font-source-code-pro), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "system",
    label: "System Mono",
    family: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
];

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "default",
    label: "Default",
    theme: {
      background: "#0b0f14",
      foreground: "#e5e7eb",
      cursor: "#34d399",
      cursorAccent: "#0b0f14",
      selectionBackground: "#334155",
      black: "#0b0f14",
      red: "#f87171",
      green: "#34d399",
      yellow: "#fbbf24",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#22d3ee",
      white: "#e5e7eb",
      brightBlack: "#64748b",
      brightRed: "#fca5a5",
      brightGreen: "#6ee7b7",
      brightYellow: "#fcd34d",
      brightBlue: "#93c5fd",
      brightMagenta: "#d8b4fe",
      brightCyan: "#67e8f9",
      brightWhite: "#f8fafc",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    theme: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
      cursorAccent: "#282a36",
      selectionBackground: "#44475a",
      black: "#21222c",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#bd93f9",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#f8f8f2",
      brightBlack: "#6272a4",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92d0",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    theme: {
      background: "#282c34",
      foreground: "#abb2bf",
      cursor: "#528bff",
      cursorAccent: "#282c34",
      selectionBackground: "#3e4451",
      black: "#282c34",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#abb2bf",
      brightBlack: "#5c6370",
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "nord",
    label: "Nord",
    theme: {
      background: "#2e3440",
      foreground: "#d8dee9",
      cursor: "#d8dee9",
      cursorAccent: "#2e3440",
      selectionBackground: "#434c5e",
      black: "#3b4252",
      red: "#bf616a",
      green: "#a3be8c",
      yellow: "#ebcb8b",
      blue: "#81a1c1",
      magenta: "#b48ead",
      cyan: "#88c0d0",
      white: "#e5e9f0",
      brightBlack: "#4c566a",
      brightRed: "#bf616a",
      brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b",
      brightBlue: "#81a1c1",
      brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb",
      brightWhite: "#eceff4",
    },
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    theme: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#839496",
      cursorAccent: "#002b36",
      selectionBackground: "#073642",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#002b36",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    theme: {
      background: "#272822",
      foreground: "#f8f8f2",
      cursor: "#f8f8f0",
      cursorAccent: "#272822",
      selectionBackground: "#49483e",
      black: "#272822",
      red: "#f92672",
      green: "#a6e22e",
      yellow: "#f4bf75",
      blue: "#66d9ef",
      magenta: "#ae81ff",
      cyan: "#a1efe4",
      white: "#f8f8f2",
      brightBlack: "#75715e",
      brightRed: "#f92672",
      brightGreen: "#a6e22e",
      brightYellow: "#f4bf75",
      brightBlue: "#66d9ef",
      brightMagenta: "#ae81ff",
      brightCyan: "#a1efe4",
      brightWhite: "#f9f8f5",
    },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    theme: {
      background: "#ffffff",
      foreground: "#1f2328",
      cursor: "#0969da",
      cursorAccent: "#ffffff",
      selectionBackground: "#b6e3ff",
      black: "#24292f",
      red: "#cf222e",
      green: "#116329",
      yellow: "#4d2d00",
      blue: "#0969da",
      magenta: "#8250df",
      cyan: "#1b7c83",
      white: "#6e7781",
      brightBlack: "#57606a",
      brightRed: "#a40e26",
      brightGreen: "#1a7f37",
      brightYellow: "#633c01",
      brightBlue: "#218bff",
      brightMagenta: "#a475f9",
      brightCyan: "#3192aa",
      brightWhite: "#8c959f",
    },
  },
];

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontId: "jetbrains",
  fontSize: FONT_SIZE_DEFAULT,
  themeId: "default",
};

const FONT_IDS = new Set(FONT_OPTIONS.map((font) => font.id));
const THEME_IDS = new Set(THEME_OPTIONS.map((theme) => theme.id));

export function getFontOption(fontId: FontId): FontOption {
  return FONT_OPTIONS.find((font) => font.id === fontId) ?? FONT_OPTIONS[0];
}

export function getThemeOption(themeId: ThemeId): ThemeOption {
  return (
    THEME_OPTIONS.find((theme) => theme.id === themeId) ?? THEME_OPTIONS[0]
  );
}

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return FONT_SIZE_DEFAULT;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

export function normalizeTerminalSettings(
  input: Partial<TerminalSettings> | null | undefined,
): TerminalSettings {
  const fontId =
    input?.fontId && FONT_IDS.has(input.fontId)
      ? input.fontId
      : DEFAULT_TERMINAL_SETTINGS.fontId;
  const themeId =
    input?.themeId && THEME_IDS.has(input.themeId)
      ? input.themeId
      : DEFAULT_TERMINAL_SETTINGS.themeId;
  const fontSize = clampFontSize(
    input?.fontSize ?? DEFAULT_TERMINAL_SETTINGS.fontSize,
  );

  return { fontId, fontSize, themeId };
}

export function loadTerminalSettings(): TerminalSettings {
  if (typeof window === "undefined") {
    return DEFAULT_TERMINAL_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(TERMINAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_TERMINAL_SETTINGS;
    return normalizeTerminalSettings(JSON.parse(raw) as Partial<TerminalSettings>);
  } catch {
    return DEFAULT_TERMINAL_SETTINGS;
  }
}

export function saveTerminalSettings(settings: TerminalSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TERMINAL_SETTINGS_KEY,
      JSON.stringify(normalizeTerminalSettings(settings)),
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}
