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
    dotClass: "bg-yellow-500",
    textClass: "text-kumo-warning"
  },
  connected: {
    label: "Connected",
    dotClass: "bg-green-500",
    textClass: "text-kumo-success"
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-red-500",
    textClass: "text-kumo-danger"
  }
};

export function ConnectionIndicator({ status }: ConnectionStatusProps) {
  const { label, dotClass, textClass } = statusConfig[status];
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className={textClass}>{label}</span>
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
      <SunIcon size={16} />
    ) : mode === "dark" ? (
      <MoonIcon size={16} />
    ) : (
      <MonitorIcon size={16} />
    );

  const label =
    mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";

  return (
    <Button
      variant="secondary"
      icon={icon}
      onClick={cycle}
      title={`Theme: ${label}`}
    >
      {label}
    </Button>
  );
}
