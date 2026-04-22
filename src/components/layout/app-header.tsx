import { Settings2, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      ? connectedInstanceName ?? settings?.instanceName ?? 'Chưa có instance'
      : 'Chưa có instance';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/70 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-wide text-[hsl(var(--text-strong))]">Evo Broadcast Control</h1>
        <p className="text-sm text-muted-foreground">Điều phối nhóm WhatsApp và chiến dịch broadcast.</p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:ml-auto sm:w-auto sm:justify-end">
        <Badge
          variant="neutral"
          className="h-8 max-w-full items-center truncate px-3 text-sm leading-none sm:max-w-[220px]"
          title={displayInstance}
        >
          Phiên làm việc: {displayInstance}
        </Badge>
        <Badge
          variant={connectionStatus.tone}
          className="h-8 items-center gap-1 px-3 text-sm leading-none"
          title={statusMessage}
        >
          <Wifi className={`h-3.5 w-3.5 ${badgeState === 'checking' ? 'animate-pulse' : ''}`} />
          {connectionStatus.label}
        </Badge>
        <Button
          type="button"
          variant={connectionSettingsOpen ? 'secondary' : 'outline'}
          size="icon"
          className="h-9 w-9"
          aria-label="Mở cài đặt kết nối"
          title="Cài đặt kết nối"
          onClick={onOpenConnectionSettings}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
