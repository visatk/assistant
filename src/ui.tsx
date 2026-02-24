import { Button } from "@cloudflare/kumo";
import { SunIcon, MoonIcon, MonitorIcon } from "@phosphor-icons/react";
import { useTheme } from "./hooks";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface ConnectionStatusProps {
  status: ConnectionStatus;
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  connecting: {
    label: "Connecting...",
    dotClass: "bg-kumo-warning animate-pulse",
    textClass: "text-kumo-warning"
  },
  connected: {
    label: "Connected",
    dotClass: "bg-kumo-success shadow-[0_0_8px_rgba(22,163,74,0.6)]",
    textClass: "text-kumo-success"
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-kumo-danger",
    textClass: "text-kumo-danger"
  }
};

export function ConnectionIndicator({ status }: ConnectionStatusProps) {
  const { label, dotClass, textClass } = statusConfig[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-kumo-line bg-kumo-recessed px-2 py-1 md:px-3 md:py-1.5" role="status" aria-live="polite">
      <span className={`size-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className={`${textClass} hidden text-xs font-semibold sm:inline-block`}>{label}</span>
    </div>
  );
}

export function ModeToggle() {
  const { mode, setMode } = useTheme();

  const cycle = () => {
    const modes = ["system", "light", "dark"] as const;
    const idx = modes.indexOf(mode);
    setMode(modes[(idx + 1) % modes.length]);
  };

  const icon =
    mode === "light" ? (
      <SunIcon size={18} weight="fill" />
    ) : mode === "dark" ? (
      <MoonIcon size={18} weight="fill" />
    ) : (
      <MonitorIcon size={18} weight="fill" />
    );

  const label =
    mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";

  return (
    <Button
      variant="secondary"
      icon={icon}
      onClick={cycle}
      title={`Theme: ${label}`}
      className="px-2"
    >
      <span className="hidden sm:inline-block">{label}</span>
    </Button>
  );
}
