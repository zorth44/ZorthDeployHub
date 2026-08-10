import type { OnlineStatus } from "../lib/api";
import { useT } from "../i18n/useT";

export function StatusDot({ status, showLabel = false }: { status: OnlineStatus; showLabel?: boolean }) {
  const t = useT();
  const color =
    status === "online"
      ? "bg-emerald-400"
      : status === "offline"
        ? "bg-red-400"
        : "bg-zinc-500";

  const label =
    status === "online"
      ? t("status.online")
      : status === "offline"
        ? t("status.offline")
        : t("status.unknown");

  return (
    <span className="inline-flex items-center gap-1.5" title={label} aria-label={label}>
      <span className={`inline-block size-2 shrink-0 rounded-full ${color} ${status === "online" ? "shadow-[0_0_10px_rgba(52,211,153,0.45)]" : ""}`} />
      {showLabel ? <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">{label}</span> : null}
    </span>
  );
}
