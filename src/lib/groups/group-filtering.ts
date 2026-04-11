import type { CampaignTarget, Group, TargetStatus } from '@/lib/types/domain';
import {
  extractGroupExplicitCanSend,
  GROUP_PERMISSION_HINT_KEY
} from '@/lib/groups/group-metadata';

export type GroupStatusFilterMode = 'all' | 'sent' | 'pending' | 'dry-run-success';
export type GroupPermissionFilterMode = 'all' | 'allowed' | 'blocked' | 'unknown';
export type GroupPermissionState = Exclude<GroupPermissionFilterMode, 'all'>;

export interface GroupFilterCounts {
  status: {
    all: number;
    sent: number;
    dryRunSuccess: number;
    pending: number;
  };
  permission: {
    all: number;
    allowed: number;
    blocked: number;
    unknown: number;
  };
}

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

const matchesSearch = (group: Group, searchTerm: string): boolean => {
  const normalizedTerm = searchTerm.trim().toLowerCase();
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

const isSentStatus = (status: TargetStatus | undefined): boolean => status === 'sent';

const isDryRunSuccessStatus = (status: TargetStatus | undefined): boolean =>
  status === 'dry-run-success';

const matchesStatusMode = (
  group: Group,
  statusFilterMode: GroupStatusFilterMode,
  statusByChatId: Map<string, TargetStatus>
): boolean => {
  const status = statusByChatId.get(group.chatId);

  if (statusFilterMode === 'all') {
    return true;
  }
  if (statusFilterMode === 'dry-run-success') {
    return isDryRunSuccessStatus(status);
  }
  if (statusFilterMode === 'sent') {
    return isSentStatus(status);
  }

  return !isSentStatus(status) && !isDryRunSuccessStatus(status);
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
  statusByChatId
}: {
  groups: Group[];
  searchTerm: string;
  minMembers: number | null;
  statusFilterMode: GroupStatusFilterMode;
  permissionFilterMode: GroupPermissionFilterMode;
  statusByChatId: Map<string, TargetStatus>;
}): Group[] =>
  groups.filter((group) => {
    if (!matchesSearch(group, searchTerm)) {
      return false;
    }
    if (minMembers !== null && group.membersCount < minMembers) {
      return false;
    }
    if (!matchesStatusMode(group, statusFilterMode, statusByChatId)) {
      return false;
    }
    return matchesPermissionMode(group, permissionFilterMode);
  });

export const countGroupsByMode = (
  groups: Group[],
  statusByChatId: Map<string, TargetStatus>
): GroupFilterCounts => {
  let sent = 0;
  let dryRunSuccess = 0;
  let pending = 0;
  let allowed = 0;
  let blocked = 0;
  let unknown = 0;

  for (const group of groups) {
    const status = statusByChatId.get(group.chatId);
    if (isSentStatus(status)) {
      sent += 1;
    } else if (isDryRunSuccessStatus(status)) {
      dryRunSuccess += 1;
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
      dryRunSuccess,
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
