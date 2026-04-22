import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { panelTokens } from '@/components/layout/panel-tokens';
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
    <div className={panelTokens.section}>
      <div className="flex items-center justify-between">
        <Label className={panelTokens.fieldLabel}>Bật chế độ danh sách cho phép</Label>
        <Checkbox
          checked={whitelistMode}
          onCheckedChange={(value) => onWhitelistModeChange(value === true)}
          disabled={controlsDisabled}
        />
      </div>
      <div className="space-y-1">
        <Label className={panelTokens.fieldLabel}>
          {listModeLabel} ({chatIdCount})
        </Label>
        <Input
          placeholder="Nhập chat id, nhấn Enter để thêm"
          value={blacklistInput}
          onChange={(event) => onBlacklistInputChange(event.target.value)}
          onKeyDown={onBlacklistInputKeyDown}
          onBlur={onBlacklistInputBlur}
          disabled={controlsDisabled}
          className={panelTokens.control}
        />
        <p className="text-xs text-muted-foreground">
          Chỉ nhận chat id nhóm dạng <code className="font-mono">...@g.us</code>. Có thể dán nhiều id,
          phân tách bằng dấu phẩy, khoảng trắng hoặc xuống dòng rồi nhấn Enter.
        </p>
        {blacklistItems.length > 0 ? (
          <div className="max-h-72 overflow-y-auto pr-1 pt-1">
            <div className="flex flex-wrap gap-2">
              {blacklistItems.map(({ chatId, groupName }) => (
                <div
                  key={chatId}
                  className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-border/40 bg-background/50 px-3 py-1.5 text-xs text-foreground"
                >
                  <span className="min-w-0">
                    <span
                      className="block max-w-[230px] truncate text-[11px] font-medium leading-4 text-foreground"
                      title={groupNameByChatId.get(normalizeChatId(chatId)) ?? 'Chưa tìm thấy tên nhóm trong cache hiện tại'}
                    >
                      {groupName}
                    </span>
                    <span className="block max-w-[230px] truncate font-mono text-[11px] leading-4 text-muted-foreground">
                      {chatId}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => onRemoveBlacklistItem(chatId)}
                    disabled={controlsDisabled}
                    aria-label={`Xóa ${chatId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Chưa có chat id trong danh sách.</p>
        )}
      </div>
    </div>
  );
}
