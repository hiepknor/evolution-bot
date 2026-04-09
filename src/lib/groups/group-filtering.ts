import type { CampaignTarget, Group, TargetStatus } from '@/lib/types/domain';
import {
  extractGroupExplicitCanSend,
  GROUP_PERMISSION_HINT_KEY
} from '@/lib/groups/group-metadata';

export type GroupStatusFilterMode = 'all' | 'sent' | 'pending';
export type GroupPermissionFilterMode = 'all' | 'allowed' | 'blocked' | 'unknown';
export type GroupPermissionState = Exclude<GroupPermissionFilterMode, 'all'>;

export interface GroupFilterCounts {
  status: {
    all: number;
    sent: number;
    pending: number;
  };
  permission: {
    all: number;
    allowed: number;
    blocked: number;
    unknown: number;
  };
}

const sentStatuses = new Set<TargetStatus>(['sent', 'dry-run-success']);
const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

export const parseMinMembersInput = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
};

export const createGroupStatusMap = (targets: CampaignTarget[]): Map<string, TargetStatus> => {
  const result = new Map<string, TargetStatus>();
  for (const target of targets) {
    result.set(target.chatId, target.status);
  }
  return result;
};

export const createSentStatusMap = (targets: CampaignTarget[]): Map<string, boolean> => {
  const result = new Map<string, boolean>();
  const statusByChatId = createGroupStatusMap(targets);

  for (const [chatId, status] of statusByChatId.entries()) {
    result.set(chatId, sentStatuses.has(status));
  }

  return result;
};

const matchesSearch = (group: Group, normalizedTerm: string): boolean => {
  if (!normalizedTerm) {
    return true;
  }

  return (
    group.name.toLowerCase().includes(normalizedTerm) ||
    group.chatId.toLowerCase().includes(normalizedTerm)
  );
};

export const resolveGroupPermissionState = (group: Group): GroupPermissionState => {
  const raw = asRecord(group.raw) ?? {};
  const rawHint = raw[GROUP_PERMISSION_HINT_KEY];
  const hintedCanSend =
    typeof rawHint === 'boolean'
      ? rawHint
      : rawHint === null
        ? null
        : extractGroupExplicitCanSend(raw);

  if (!group.sendable || hintedCanSend === false) {
    return 'blocked';
  }
  if (hintedCanSend === true) {
    return 'allowed';
  }
  if (group.adminOnly) {
    return 'unknown';
  }
  return 'allowed';
};

const matchesStatusMode = (
  group: Group,
  statusFilterMode: GroupStatusFilterMode,
  sentStatusByChatId: Map<string, boolean>
): boolean => {
  const sent = sentStatusByChatId.get(group.chatId) === true;

  if (statusFilterMode === 'all') {
    return true;
  }
  if (statusFilterMode === 'sent') {
    return sent;
  }

  return !sent;
};

const matchesPermissionMode = (
  group: Group,
  permissionFilterMode: GroupPermissionFilterMode
): boolean => {
  if (permissionFilterMode === 'all') {
    return true;
  }
  return resolveGroupPermissionState(group) === permissionFilterMode;
};

export const applyGroupFilters = ({
  groups,
  searchTerm,
  minMembers,
  statusFilterMode,
  permissionFilterMode,
  sentStatusByChatId
}: {
  groups: Group[];
  searchTerm: string;
  minMembers: number | null;
  statusFilterMode: GroupStatusFilterMode;
  permissionFilterMode: GroupPermissionFilterMode;
  sentStatusByChatId: Map<string, boolean>;
}): Group[] => {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  return groups.filter((group) => {
    if (!matchesSearch(group, normalizedTerm)) {
      return false;
    }
    if (minMembers !== null && group.membersCount < minMembers) {
      return false;
    }
    if (!matchesStatusMode(group, statusFilterMode, sentStatusByChatId)) {
      return false;
    }
    return matchesPermissionMode(group, permissionFilterMode);
  });
};

export const countGroupsByMode = (
  groups: Group[],
  sentStatusByChatId: Map<string, boolean>
): GroupFilterCounts => {
  let sent = 0;
  let pending = 0;
  let allowed = 0;
  let blocked = 0;
  let unknown = 0;

  for (const group of groups) {
    if (sentStatusByChatId.get(group.chatId) === true) {
      sent += 1;
    } else {
      pending += 1;
    }

    const permissionState = resolveGroupPermissionState(group);
    if (permissionState === 'allowed') {
      allowed += 1;
    } else if (permissionState === 'blocked') {
      blocked += 1;
    } else {
      unknown += 1;
    }
  }

  return {
    status: {
      all: groups.length,
      sent,
      pending
    },
    permission: {
      all: groups.length,
      allowed,
      blocked,
      unknown
    }
  };
};
