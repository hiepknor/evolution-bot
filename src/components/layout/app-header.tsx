import { Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/stores/use-settings-store';

const badgeVariant = (
  state: 'connected' | 'disconnected' | 'checking'
): 'success' | 'warning' | 'destructive' => {
  if (state === 'connected') return 'success';
  if (state === 'checking') return 'warning';
  return 'destructive';
};

const badgeLabel = (state: 'connected' | 'disconnected' | 'checking'): string => {
  if (state === 'connected') return 'Đã kết nối';
  if (state === 'checking') return 'Đang kiểm tra';
  return 'Mất kết nối';
};

export function AppHeader(): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const connectedInstanceName = useSettingsStore((state) => state.connectedInstanceName);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const displayInstance =
    badgeState === 'connected'
      ? connectedInstanceName ?? settings?.instanceName ?? 'chưa có instance'
      : 'chưa có instance';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/70 px-4 py-3 backdrop-blur">
      <div className="min-w-[280px] flex-1">
        <h1 className="text-lg font-semibold tracking-wide text-[hsl(var(--text-strong))]">
          Evo Broadcast Control
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản lý nhóm WhatsApp và chạy chiến dịch broadcast qua Evolution API.
        </p>
      </div>

      <div className="ml-auto flex min-w-[250px] items-center justify-end gap-2">
        <Badge
          variant="outline"
          className="h-9 max-w-[220px] items-center truncate font-mono text-xs leading-none"
          title={displayInstance}
        >
          {displayInstance}
        </Badge>
        <Badge variant={badgeVariant(badgeState)} className="h-9 items-center gap-1 px-3 text-xs leading-none">
          <Wifi className={`h-3 w-3 ${badgeState === 'checking' ? 'animate-pulse' : ''}`} />
          {badgeLabel(badgeState)}
        </Badge>
      </div>
    </header>
  );
}
