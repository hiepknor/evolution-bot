import { Loader2, RadioTower, Settings2, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { getConnectionStatusPresentation } from '@/lib/connection/connection-status';
import { useSettingsStore } from '@/stores/use-settings-store';

interface AppHeaderProps {
  connectionSettingsOpen: boolean;
  onOpenConnectionSettings: () => void;
}

export function AppHeader({ connectionSettingsOpen, onOpenConnectionSettings }: AppHeaderProps): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const connectedInstanceName = useSettingsStore((state) => state.connectedInstanceName);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const statusMessage = useSettingsStore((state) => state.statusMessage);
  const connectionStatus = getConnectionStatusPresentation(badgeState, statusMessage);
  const displayInstance =
    badgeState === 'connected'
      ? (connectedInstanceName ?? settings?.instanceName ?? 'Chưa có instance')
      : 'Chưa có instance';

  const statusPillClass =
    connectionStatus.tone === 'success'
      ? 'border-success/40 bg-success/[0.1] text-success'
      : connectionStatus.tone === 'warning'
        ? 'border-warning/40 bg-warning/[0.1] text-warning'
        : connectionStatus.tone === 'destructive'
          ? 'border-destructive/40 bg-destructive/[0.1] text-destructive'
          : 'border-border/50 bg-muted/25 text-muted-foreground';

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border/80 bg-card/70 px-4 py-2.5 backdrop-blur">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <RadioTower className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-none tracking-wide text-[hsl(var(--text-strong))]">
            Evo Broadcast Control
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Điều phối nhóm WhatsApp và chiến dịch broadcast.
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Instance pill */}
        <div
          className="hidden items-center gap-1.5 rounded-full border border-border/35 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex"
          title={displayInstance}
        >
          <div className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            badgeState === 'connected' ? 'bg-success shadow-[0_0_5px_hsl(var(--success))]' : 'bg-muted-foreground/40'
          )} />
          <span className="max-w-[180px] truncate">{displayInstance}</span>
        </div>

        {/* Connection status pill */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            statusPillClass
          )}
          title={statusMessage}
        >
          {badgeState === 'checking' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wifi className="h-3 w-3" />
          )}
          {connectionStatus.label}
        </div>

        {/* Settings button */}
        <Button
          type="button"
          variant={connectionSettingsOpen ? 'secondary' : 'outline'}
          size="icon"
          className="h-8 w-8 rounded-lg border-border/50"
          aria-label="Mở cài đặt kết nối"
          title="Cài đặt kết nối"
          onClick={onOpenConnectionSettings}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
