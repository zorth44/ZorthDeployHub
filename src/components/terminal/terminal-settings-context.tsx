"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_TERMINAL_SETTINGS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  getFontOption,
  getThemeOption,
  loadTerminalSettings,
  normalizeTerminalSettings,
  saveTerminalSettings,
  type FontId,
  type TerminalSettings,
  type ThemeId,
} from "@/lib/terminal-settings";

type TerminalSettingsContextValue = {
  settings: TerminalSettings;
  fontFamily: string;
  theme: ReturnType<typeof getThemeOption>["theme"];
  setFontId: (fontId: FontId) => void;
  setFontSize: (fontSize: number) => void;
  setThemeId: (themeId: ThemeId) => void;
  updateSettings: (patch: Partial<TerminalSettings>) => void;
};

const TerminalSettingsContext =
  createContext<TerminalSettingsContextValue | null>(null);

export function TerminalSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<TerminalSettings>(
    DEFAULT_TERMINAL_SETTINGS,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadTerminalSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveTerminalSettings(settings);
  }, [hydrated, settings]);

  const updateSettings = useCallback((patch: Partial<TerminalSettings>) => {
    setSettings((prev) => normalizeTerminalSettings({ ...prev, ...patch }));
  }, []);

  const setFontId = useCallback(
    (fontId: FontId) => updateSettings({ fontId }),
    [updateSettings],
  );

  const setFontSize = useCallback(
    (fontSize: number) =>
      updateSettings({
        fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize)),
      }),
    [updateSettings],
  );

  const setThemeId = useCallback(
    (themeId: ThemeId) => updateSettings({ themeId }),
    [updateSettings],
  );

  const value = useMemo<TerminalSettingsContextValue>(() => {
    const font = getFontOption(settings.fontId);
    const theme = getThemeOption(settings.themeId);
    return {
      settings,
      fontFamily: font.family,
      theme: theme.theme,
      setFontId,
      setFontSize,
      setThemeId,
      updateSettings,
    };
  }, [settings, setFontId, setFontSize, setThemeId, updateSettings]);

  return (
    <TerminalSettingsContext.Provider value={value}>
      {children}
    </TerminalSettingsContext.Provider>
  );
}

export function useTerminalSettings() {
  const ctx = useContext(TerminalSettingsContext);
  if (!ctx) {
    throw new Error(
      "useTerminalSettings must be used within TerminalSettingsProvider",
    );
  }
  return ctx;
}
