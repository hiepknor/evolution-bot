import type { Group, TargetStatus } from '@/lib/types/domain';
import { resolveGroupPermissionState, type GroupPermissionState } from '@/lib/groups/group-filtering';

export const formatChatId = (chatId: string): string => {
  if (chatId.length <= 24) {
    return chatId;
  }
  return `${chatId.slice(0, 12)}...${chatId.slice(-8)}`;
};

export const formatUnnamedGroupLabel = (chatId: string): string => {
  const base = chatId.split('@')[0]?.trim() ?? '';
  if (!base) {
    return 'Nhóm chưa có tên';
  }
  const suffix = base.slice(-4);
  return `Nhóm chưa có tên (${suffix})`;
};

export const normalizeChatId = (chatId: string): string => chatId.trim().toLowerCase();

export const resolveEffectivePermissionState = (
  group: Group,
  blockedByList: boolean
): GroupPermissionState => (blockedByList ? 'blocked' : resolveGroupPermissionState(group));

export const selectedCheckboxClass =
  'border-border/70 data-[state=checked]:border-emerald-400/90 data-[state=checked]:bg-emerald-500/90 data-[state=checked]:text-emerald-50';

export const stickyHeaderCellClass =
  'sticky top-0 z-20 bg-card px-3 py-2.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]';

export const getGroupStatusMeta = (
  status: TargetStatus | undefined,
  permissionState: GroupPermissionState,
  blockedByList = false
): { label: string; variant: 'secondary' | 'success' | 'warning' | 'destructive' } => {
  if ((!status || status === 'pending') && blockedByList) {
    return { label: 'Bị chặn', variant: 'warning' };
  }

  if ((!status || status === 'pending') && permissionState === 'blocked') {
    return { label: 'Không gửi được', variant: 'destructive' };
  }

  if (!status || status === 'pending') {
    return { label: 'Chưa gửi', variant: 'secondary' };
  }

  if (status === 'running') {
    return { label: 'Đang gửi', variant: 'warning' };
  }

  if (status === 'sent') {
    return { label: 'Đã gửi', variant: 'success' };
  }

  if (status === 'dry-run-success') {
    return { label: 'Chạy thử', variant: 'success' };
  }

  if (status === 'failed') {
    return { label: 'Lỗi gửi', variant: 'destructive' };
  }

  if (status === 'skipped') {
    return { label: 'Bỏ qua', variant: 'warning' };
  }

  return { label: 'Đã dừng', variant: 'secondary' };
};
