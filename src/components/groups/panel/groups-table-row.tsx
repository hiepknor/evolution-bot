import { memo } from 'react';
import { Check, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Group, TargetStatus } from '@/lib/types/domain';
import {
  formatChatId,
  formatUnnamedGroupLabel,
  getGroupStatusMeta,
  normalizeChatId,
  resolveEffectivePermissionState,
  selectedCheckboxClass
} from '@/components/groups/panel/shared';

interface GroupsTableRowProps {
  group: Group;
  targetStatus: TargetStatus | undefined;
  listPolicy: { listed: boolean; blocked: boolean; reason: string | null };
  selected: boolean;
  canSend: boolean;
  copiedChatId: string | null;
  whitelistMode: boolean;
  onToggleSelect: (chatId: string) => void;
  onCopyChatId: (chatId: string) => Promise<void>;
  onToggleListMembership: (chatId: string) => void;
  rowRef: (element: HTMLTableRowElement | null) => void;
}

export function GroupsTableRow({
  group,
  targetStatus,
  listPolicy,
  selected,
  canSend,
  copiedChatId,
  whitelistMode,
  onToggleSelect,
  onCopyChatId,
  onToggleListMembership,
  rowRef
}: GroupsTableRowProps): JSX.Element {
  const permissionState = resolveEffectivePermissionState(group, listPolicy.blocked);
  const statusMeta = getGroupStatusMeta(targetStatus, permissionState, listPolicy.blocked);
  const isRunningRow = targetStatus === 'running';
  const isSelectionBlocked = !canSend;
  const normalizedName = group.name.trim();
  const normalizedChatId = normalizeChatId(group.chatId);
  const hasDistinctName = normalizedName.length > 0 && normalizeChatId(normalizedName) !== normalizedChatId;
  const displayName = hasDistinctName ? group.name : formatUnnamedGroupLabel(group.chatId);
  const permissionMeta =
    permissionState === 'allowed'
      ? { variant: 'success' as const, label: 'Gửi được' }
      : permissionState === 'blocked'
        ? {
            variant: listPolicy.blocked ? 'warning' as const : 'destructive' as const,
            label: listPolicy.blocked ? 'Bị chặn' : 'Không gửi được'
          }
        : { variant: 'warning' as const, label: 'Cần kiểm tra' };

  const listActionLabel = whitelistMode
    ? listPolicy.listed
      ? 'Gỡ DS cho phép'
      : 'Thêm DS cho phép'
    : listPolicy.listed
      ? 'Bỏ chặn'
      : 'Chặn';

  const listActionTitle = whitelistMode
    ? listPolicy.listed
      ? 'Gỡ chat id khỏi danh sách cho phép'
      : 'Thêm chat id vào danh sách cho phép'
    : listPolicy.listed
      ? 'Gỡ chat id khỏi danh sách chặn'
      : 'Thêm chat id vào danh sách chặn';

  const listActionClass = !whitelistMode && listPolicy.listed
    ? 'h-7 rounded-full border-warning/45 bg-warning/10 px-2.5 text-xs text-warning hover:bg-warning/20'
    : 'h-7 rounded-full border-border/65 bg-background/30 px-2.5 text-xs text-foreground/90 hover:bg-background/60';

  return (
    <tr
      ref={rowRef}
      aria-selected={selected}
      className={`border-t border-border/70 ${
        isRunningRow
          ? 'bg-amber-500/12 ring-1 ring-inset ring-amber-400/40'
          : selected
            ? 'bg-emerald-500/12 ring-1 ring-inset ring-emerald-400/35'
            : 'odd:bg-card even:bg-card/95'
      } ${isSelectionBlocked ? 'opacity-70' : ''} hover:bg-muted/20`}
    >
      <td className="bg-inherit px-3 py-2.5 align-middle">
        <Checkbox
          className={selectedCheckboxClass}
          checked={selected}
          onCheckedChange={() => onToggleSelect(group.chatId)}
        />
      </td>
      <td className="truncate px-3 py-2.5 align-middle text-sm" title={displayName}>
        <span className={hasDistinctName ? 'text-foreground' : 'text-muted-foreground'}>{displayName}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-right text-sm tabular-nums">{group.membersCount}</td>
      <td className="px-3 py-2.5 align-middle">
        <span className="block min-w-0 truncate font-mono text-sm" title={group.chatId}>
          {formatChatId(group.chatId)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle text-center">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2.5 text-xs"
          onClick={() => void onCopyChatId(group.chatId)}
          title="Sao chép chat id"
        >
          {copiedChatId === group.chatId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <Badge
          variant={permissionMeta.variant}
          className="whitespace-nowrap"
          title={
            listPolicy.blocked
              ? listPolicy.reason ?? 'Nhóm này bị chặn bởi cấu hình danh sách.'
              : isSelectionBlocked
                ? 'Nhóm này đang bị chặn theo quyền gửi.'
                : undefined
          }
        >
          {permissionMeta.label}
        </Badge>
      </td>
      <td className="px-3 py-2.5 align-middle text-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={listActionClass}
          onClick={() => onToggleListMembership(group.chatId)}
          title={listActionTitle}
        >
          {listActionLabel}
        </Button>
      </td>
      <td className="px-3 py-2.5 align-middle text-left">
        <Badge variant={statusMeta.variant} className="whitespace-nowrap justify-start">
          {statusMeta.label}
        </Badge>
      </td>
    </tr>
  );
}

export const MemoizedGroupsTableRow = memo(
  GroupsTableRow,
  (prev, next) =>
    prev.group.chatId === next.group.chatId &&
    prev.group.membersCount === next.group.membersCount &&
    prev.selected === next.selected &&
    prev.canSend === next.canSend &&
    prev.copiedChatId === next.copiedChatId &&
    prev.targetStatus === next.targetStatus &&
    prev.listPolicy.blocked === next.listPolicy.blocked &&
    prev.listPolicy.listed === next.listPolicy.listed
);
