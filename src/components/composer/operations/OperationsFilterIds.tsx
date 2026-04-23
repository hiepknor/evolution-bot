import { Filter, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { normalizeChatId } from '@/components/composer/operations/utils';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

interface OperationsFilterIdsProps {
  controlsDisabled: boolean;
  whitelistMode: boolean;
  listModeLabel: string;
  chatIdCount: number;
  blacklistInput: string;
  onBlacklistInputChange: (value: string) => void;
  onBlacklistInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBlacklistInputBlur: () => void;
  onWhitelistModeChange: (next: boolean) => void;
  blacklistItems: Array<{ chatId: string; groupName: string }>;
  groupNameByChatId: Map<string, string>;
  onRemoveBlacklistItem: (chatId: string) => void;
}

export function OperationsFilterIds({
  controlsDisabled,
  whitelistMode,
  listModeLabel,
  chatIdCount,
  blacklistInput,
  onBlacklistInputChange,
  onBlacklistInputKeyDown,
  onBlacklistInputBlur,
  onWhitelistModeChange,
  blacklistItems,
  groupNameByChatId,
  onRemoveBlacklistItem
}: OperationsFilterIdsProps): JSX.Element {
  return (
    <div className="space-y-2.5 rounded-lg border border-border/30 bg-muted/[0.06] p-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/40 text-accent-foreground">
          <Filter className="h-3 w-3" />
        </div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Danh sách lọc</p>
      </div>

      {/* Whitelist mode toggle row */}
      <button
        type="button"
        disabled={controlsDisabled}
        onClick={() => onWhitelistModeChange(!whitelistMode)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
          whitelistMode
            ? 'border-primary/30 bg-primary/[0.07]'
            : 'border-border/35 bg-background/40 hover:bg-background/60'
        )}
      >
        <div className="text-left">
          <p className="text-xs font-medium text-foreground">Chế độ danh sách cho phép</p>
          <p className="text-[10px] text-muted-foreground">
            {whitelistMode ? 'Chỉ gửi tới nhóm trong danh sách' : 'Chặn nhóm trong danh sách'}
          </p>
        </div>
        {/* Visual toggle */}
        <div className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          whitelistMode ? 'border-primary/50 bg-primary/20' : 'border-border/50 bg-muted/30'
        )}>
          <div className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full border transition-all',
            whitelistMode
              ? 'left-[18px] border-primary/60 bg-primary'
              : 'left-0.5 border-border/50 bg-muted-foreground/40'
          )} />
        </div>
      </button>

      {/* List label + input */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{listModeLabel}</p>
          {chatIdCount > 0 && (
            <span className="inline-flex h-4 items-center rounded-full border border-border/35 bg-background/50 px-1.5 text-[10px] tabular-nums text-muted-foreground">
              {chatIdCount}
            </span>
          )}
        </div>
        <Input
          placeholder="Nhập chat id, nhấn Enter để thêm"
          value={blacklistInput}
          onChange={(event) => onBlacklistInputChange(event.target.value)}
          onKeyDown={onBlacklistInputKeyDown}
          onBlur={onBlacklistInputBlur}
          disabled={controlsDisabled}
          className={`${panelTokens.control} border-border/40 bg-background/60 font-mono text-xs`}
        />
        <p className="text-[10px] text-muted-foreground/70">
          Dạng <span className="font-mono">...@g.us</span>. Dán nhiều id phân tách bằng dấu phẩy, khoảng trắng hoặc xuống dòng rồi nhấn Enter.
        </p>
      </div>

      {/* Blacklist items — compact rows */}
      {blacklistItems.length > 0 ? (
        <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
          {blacklistItems.map(({ chatId, groupName }) => (
            <div
              key={chatId}
              className="group flex items-center gap-2 rounded-md border border-border/30 bg-background/40 px-2.5 py-1.5 transition-colors hover:border-border/50 hover:bg-background/60"
              title={groupNameByChatId.get(normalizeChatId(chatId)) ?? 'Chưa tìm thấy tên nhóm trong cache'}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-4 text-foreground">
                  {groupName}
                </p>
                <p className="truncate font-mono text-[10px] leading-4 text-muted-foreground">
                  {chatId}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none"
                onClick={() => onRemoveBlacklistItem(chatId)}
                disabled={controlsDisabled}
                aria-label={`Xóa ${chatId}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/60">Chưa có chat id trong danh sách.</p>
      )}
    </div>
  );
}
