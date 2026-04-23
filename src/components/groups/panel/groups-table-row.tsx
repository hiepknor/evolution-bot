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
  density?: 'comfortable' | 'compact';
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
  density = 'comfortable',
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
  const isCompact = density === 'compact';
  const rowTextClass = 'text-[13px]';
  const monoTextClass = 'text-[13px]';
  const badgeTextClass = 'h-5 whitespace-nowrap px-2 text-[11px]';
  const actionButtonTextClass = 'h-6 gap-1.5 px-2.5 text-[11px] leading-none';
  const cellClass = 'px-2.5 py-1.5 align-middle';
  const centerCellClass = 'px-2 py-1.5 align-middle text-center';
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
  const permissionBadgeClass = permissionMeta.variant === 'success'
    ? 'border border-success/28 bg-success/[0.09] text-success'
    : permissionMeta.variant === 'destructive'
      ? 'border border-destructive/28 bg-destructive/[0.1] text-destructive'
      : 'border border-warning/28 bg-warning/[0.1] text-warning';

  const statusBadgeClass = statusMeta.variant === 'success'
    ? 'border border-success/28 bg-success/[0.09] text-success'
    : statusMeta.variant === 'destructive'
      ? 'border border-destructive/28 bg-destructive/[0.1] text-destructive'
      : statusMeta.variant === 'warning'
        ? 'border border-warning/28 bg-warning/[0.1] text-warning'
        : 'border border-slate-400/32 bg-slate-500/[0.14] text-slate-100';

  return (
    <tr
      ref={rowRef}
      aria-selected={selected}
      className={[
        'group border-t border-border/60 transition-[background-color,box-shadow,opacity,padding,font-size,line-height] duration-200 ease-out',
        isRunningRow
          ? 'bg-amber-500/[0.055] ring-1 ring-inset ring-amber-400/22'
          : selected
            ? 'bg-emerald-500/[0.045] ring-1 ring-inset ring-emerald-400/20'
            : 'odd:bg-card even:bg-card/97 hover:bg-primary/[0.095] hover:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.04)]',
        isSelectionBlocked ? 'opacity-70' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Checkbox */}
      <td className={`${cellClass} transition-[padding] duration-200 ease-out`}>
        <Checkbox
          className={selectedCheckboxClass}
          checked={selected}
          onCheckedChange={() => onToggleSelect(group.chatId)}
        />
      </td>

      {/* Group name */}
      <td className={`truncate ${cellClass} transition-[padding] duration-200 ease-out`} title={displayName}>
        <span className={`${rowTextClass} ${hasDistinctName ? 'text-foreground' : 'text-muted-foreground'} transition-[font-size,line-height,color] duration-200 ease-out group-hover:text-foreground`}>
          {displayName}
        </span>
      </td>

      {/* Members count */}
      <td className={`whitespace-nowrap ${cellClass} ${rowTextClass} text-right tabular-nums text-foreground/90 transition-[padding,font-size,line-height,color] duration-200 ease-out group-hover:text-foreground`}>
        {group.membersCount}
      </td>

      {/* Chat ID */}
      <td className={`${cellClass} transition-[padding] duration-200 ease-out`}>
        <span className={`block min-w-0 truncate font-mono ${monoTextClass} text-foreground/88 transition-[font-size,line-height,color] duration-200 ease-out group-hover:text-foreground`} title={group.chatId}>
          {formatChatId(group.chatId)}
        </span>
      </td>

      {/* Copy button */}
      <td className={`${centerCellClass} transition-[padding] duration-200 ease-out`}>
        <button
          type="button"
          onClick={() => void onCopyChatId(group.chatId)}
          title="Sao chép chat id"
          className={`inline-flex ${isCompact ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'} items-center justify-center rounded-md transition-colors ${
            isCopied
              ? 'text-success'
              : 'text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground'
          }`}
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3 w-3" />}
        </button>
      </td>

      {/* Permission badge */}
      <td className={`${cellClass} transition-[padding] duration-200 ease-out`}>
        <Badge
          variant={permissionMeta.variant}
          className={`${badgeTextClass} ${permissionBadgeClass}`}
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
      <td className={`${centerCellClass} transition-[padding] duration-200 ease-out`}>
        <button
          type="button"
          onClick={() => onToggleListMembership(group.chatId)}
          title={listActionTitle}
          className={`inline-flex ${actionButtonTextClass} items-center rounded-full border font-semibold transition-all ${
            !whitelistMode && listPolicy.listed
              ? 'border-warning/45 bg-warning/12 text-warning shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-warning/55 hover:bg-warning/18'
              : listPolicy.listed
                ? 'border-primary/40 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-primary/55 hover:bg-primary/16'
                : 'border-border/60 bg-background/65 text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-[0.5px] hover:border-warning/45 hover:bg-warning/12 hover:text-warning'
          }`}
        >
          {listPolicy.listed ? (
            <Minus className="h-3 w-3 shrink-0 -translate-y-px" />
          ) : (
            <Plus className="h-3 w-3 shrink-0 -translate-y-px" />
          )}
          <span className="leading-none">
            {whitelistMode
              ? listPolicy.listed
                ? 'Gỡ'
                : 'Cho phép'
              : listPolicy.listed
                ? 'Bỏ chặn'
                : 'Chặn'}
          </span>
        </button>
      </td>

      {/* Status badge */}
      <td className={`${cellClass} transition-[padding] duration-200 ease-out`}>
        <Badge variant={statusMeta.variant} className={`${badgeTextClass} ${statusBadgeClass}`}>
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
    prev.density === next.density &&
    prev.selected === next.selected &&
    prev.canSend === next.canSend &&
    prev.copiedChatId === next.copiedChatId &&
    prev.targetStatus === next.targetStatus &&
    prev.listPolicy.blocked === next.listPolicy.blocked &&
    prev.listPolicy.listed === next.listPolicy.listed
);
