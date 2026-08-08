"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTerminalSettings } from "@/components/terminal/terminal-settings-context";
import {
  FONT_OPTIONS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  THEME_OPTIONS,
  type FontId,
  type ThemeId,
} from "@/lib/terminal-settings";

type TerminalSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TerminalSettingsDialog({
  open,
  onOpenChange,
}: TerminalSettingsDialogProps) {
  const { settings, setFontId, setFontSize, setThemeId } =
    useTerminalSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminal Appearance</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="terminal-font">Font</Label>
            <select
              id="terminal-font"
              value={settings.fontId}
              onChange={(event) => setFontId(event.target.value as FontId)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="terminal-font-size">Font size</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.fontSize}px
              </span>
            </div>
            <input
              id="terminal-font-size"
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={settings.fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{FONT_SIZE_MIN}px</span>
              <span>{FONT_SIZE_MAX}px</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map((option) => {
                const selected = settings.themeId === option.id;
                const bg = option.theme.background ?? "#000";
                const fg = option.theme.foreground ?? "#fff";
                const cursor = option.theme.cursor ?? fg;
                const accent =
                  option.theme.green ?? option.theme.blue ?? cursor;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setThemeId(option.id as ThemeId)}
                    className={`rounded-lg border p-2 text-left transition-colors ${
                      selected
                        ? "border-ring ring-3 ring-ring/40"
                        : "border-border hover:border-ring/60"
                    }`}
                    aria-pressed={selected}
                  >
                    <div
                      className="mb-2 overflow-hidden rounded-md border border-black/10"
                      style={{ background: bg }}
                    >
                      <div className="flex h-8 items-end gap-1 px-2 pb-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: accent }}
                        />
                        <span
                          className="h-1.5 flex-1 rounded-sm opacity-80"
                          style={{ background: fg }}
                        />
                        <span
                          className="h-3 w-0.5 rounded-sm"
                          style={{ background: cursor }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
