import { memo } from 'react';
import { Check, Copy, Minus, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
  const hasDistinctName =
    normalizedName.length > 0 && normalizeChatId(normalizedName) !== normalizedChatId;
  const displayName = hasDistinctName ? group.name : formatUnnamedGroupLabel(group.chatId);

  const permissionMeta =
    permissionState === 'allowed'
      ? { variant: 'success' as const, label: 'Gửi được' }
      : permissionState === 'blocked'
        ? {
            variant: listPolicy.blocked ? ('warning' as const) : ('destructive' as const),
            label: listPolicy.blocked ? 'Bị chặn' : 'Không gửi được'
          }
        : { variant: 'warning' as const, label: 'Cần kiểm tra' };

  const listActionTitle = whitelistMode
    ? listPolicy.listed
      ? 'Gỡ chat id khỏi danh sách cho phép'
      : 'Thêm chat id vào danh sách cho phép'
    : listPolicy.listed
      ? 'Gỡ chat id khỏi danh sách chặn'
      : 'Thêm chat id vào danh sách chặn';

  const isCopied = copiedChatId === group.chatId;

  return (
    <tr
      ref={rowRef}
      aria-selected={selected}
      className={[
        'border-t border-border/60 transition-colors',
        isRunningRow
          ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-400/35'
          : selected
            ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40'
            : 'odd:bg-card even:bg-card/90 hover:bg-muted/15',
        isSelectionBlocked ? 'opacity-60' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Checkbox */}
      <td className="bg-inherit px-3 py-2 align-middle">
        <Checkbox
          className={selectedCheckboxClass}
          checked={selected}
          onCheckedChange={() => onToggleSelect(group.chatId)}
        />
      </td>

      {/* Group name */}
      <td className="truncate px-3 py-2 align-middle" title={displayName}>
        <span className={`text-sm ${hasDistinctName ? 'text-foreground' : 'text-muted-foreground'}`}>
          {displayName}
        </span>
      </td>

      {/* Members count */}
      <td className="whitespace-nowrap px-3 py-2 align-middle text-right text-sm tabular-nums text-foreground/80">
        {group.membersCount}
      </td>

      {/* Chat ID */}
      <td className="px-3 py-2 align-middle">
        <span className="block min-w-0 truncate font-mono text-xs text-foreground/70" title={group.chatId}>
          {formatChatId(group.chatId)}
        </span>
      </td>

      {/* Copy button */}
      <td className="px-2 py-2 align-middle text-center">
        <button
          type="button"
          onClick={() => void onCopyChatId(group.chatId)}
          title="Sao chép chat id"
          className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            isCopied
              ? 'text-success'
              : 'text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground'
          }`}
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3 w-3" />}
        </button>
      </td>

      {/* Permission badge */}
      <td className="px-3 py-2 align-middle">
        <Badge
          variant={permissionMeta.variant}
          className="whitespace-nowrap"
          title={
            listPolicy.blocked
              ? (listPolicy.reason ?? 'Nhóm này bị chặn bởi cấu hình danh sách.')
              : isSelectionBlocked
                ? 'Nhóm này đang bị chặn theo quyền gửi.'
                : undefined
          }
        >
          {permissionMeta.label}
        </Badge>
      </td>

      {/* List action button */}
      <td className="px-3 py-2 align-middle text-center">
        <button
          type="button"
          onClick={() => onToggleListMembership(group.chatId)}
          title={listActionTitle}
          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
            !whitelistMode && listPolicy.listed
              ? 'border-warning/40 bg-warning/8 text-warning hover:bg-warning/15'
              : listPolicy.listed
                ? 'border-primary/35 bg-primary/8 text-primary hover:bg-primary/15'
                : 'border-border/50 bg-background/30 text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground'
          }`}
        >
          {listPolicy.listed ? (
            <Minus className="h-2.5 w-2.5" />
          ) : (
            <Plus className="h-2.5 w-2.5" />
          )}
          {whitelistMode
            ? listPolicy.listed
              ? 'Gỡ'
              : 'Cho phép'
            : listPolicy.listed
              ? 'Bỏ chặn'
              : 'Chặn'}
        </button>
      </td>

      {/* Status badge */}
      <td className="px-3 py-2 align-middle">
        <Badge variant={statusMeta.variant} className="whitespace-nowrap">
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
