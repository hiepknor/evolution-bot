import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  applyGroupFilters,
  createGroupStatusMap,
  parseMinMembersInput,
  type GroupFilterCounts,
  type GroupPermissionFilterMode,
  type GroupStatusFilterMode
} from '@/lib/groups/group-filtering';
import type { Group, Campaign, CampaignTarget } from '@/lib/types/domain';
import { normalizeChatId, resolveEffectivePermissionState } from '@/components/groups/panel/shared';

const statusFilterLabel: Record<GroupStatusFilterMode, string> = {
  all: 'Tất cả',
  pending: 'Chưa gửi',
  sent: 'Đã gửi',
  'dry-run-success': 'Chạy thử'
};

const permissionFilterLabel: Record<GroupPermissionFilterMode, string> = {
  all: 'Mọi quyền',
  allowed: 'Gửi được',
  unknown: 'Cần kiểm tra',
  blocked: 'Không gửi được'
};

interface UseGroupsFilterParams {
  groups: Group[];
  targets: CampaignTarget[];
  campaignConfig: Campaign['config'];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export function useGroupsFilter({
  groups,
  targets,
  campaignConfig,
  searchTerm,
  setSearchTerm
}: UseGroupsFilterParams) {
  const [statusFilterMode, setStatusFilterMode] = useState<GroupStatusFilterMode>('all');
  const [permissionFilterMode, setPermissionFilterMode] = useState<GroupPermissionFilterMode>('all');
  const [minMembersInput, setMinMembersInput] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchInputComposing, setSearchInputComposing] = useState(false);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    if (searchInputComposing) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchTerm !== searchInputValue) {
        setSearchTerm(searchInputValue);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchInputComposing, searchInputValue, searchTerm, setSearchTerm]);

  const minMembers = useMemo(() => parseMinMembersInput(minMembersInput), [minMembersInput]);
  const groupStatusByChatId = useMemo(() => createGroupStatusMap(targets), [targets]);
  const normalizedConfigList = useMemo(
    () =>
      Array.from(
        new Set(
          campaignConfig.blacklist
            .map((item) => normalizeChatId(item))
            .filter(Boolean)
        )
      ),
    [campaignConfig.blacklist]
  );

  const configuredListSet = useMemo(() => new Set(normalizedConfigList), [normalizedConfigList]);
  const listPolicyByChatId = useMemo(() => {
    const policy = new Map<string, { listed: boolean; blocked: boolean; reason: string | null }>();
    for (const group of groups) {
      const listed = configuredListSet.has(normalizeChatId(group.chatId));
      const blocked = campaignConfig.whitelistMode ? !listed : listed;
      const reason = blocked
        ? campaignConfig.whitelistMode
          ? 'Ngoài danh sách cho phép'
          : 'Nằm trong danh sách chặn'
        : null;
      policy.set(group.chatId, { listed, blocked, reason });
    }
    return policy;
  }, [campaignConfig.whitelistMode, configuredListSet, groups]);

  const filteredForCounts = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm: deferredSearchTerm,
        minMembers,
        statusFilterMode: 'all',
        permissionFilterMode: 'all',
        statusByChatId: groupStatusByChatId
      }),
    [deferredSearchTerm, groupStatusByChatId, groups, minMembers]
  );

  const filteredBySearchAndStatus = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm: deferredSearchTerm,
        minMembers,
        statusFilterMode,
        permissionFilterMode: 'all',
        statusByChatId: groupStatusByChatId
      }),
    [deferredSearchTerm, groupStatusByChatId, groups, minMembers, statusFilterMode]
  );

  const filtered = useMemo(
    () =>
      filteredBySearchAndStatus.filter((group) => {
        const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
        const permissionState = resolveEffectivePermissionState(group, blockedByList);
        if (permissionFilterMode === 'all') {
          return true;
        }
        return permissionState === permissionFilterMode;
      }),
    [filteredBySearchAndStatus, listPolicyByChatId, permissionFilterMode]
  );

  const filterCounts = useMemo<GroupFilterCounts>(() => {
    let sent = 0;
    let dryRunSuccess = 0;
    let pending = 0;
    let allowed = 0;
    let blocked = 0;
    let unknown = 0;

    for (const group of filteredForCounts) {
      const status = groupStatusByChatId.get(group.chatId);
      if (status === 'sent') {
        sent += 1;
      } else if (status === 'dry-run-success') {
        dryRunSuccess += 1;
      } else {
        pending += 1;
      }

      const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
      const permissionState = resolveEffectivePermissionState(group, blockedByList);
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
        all: filteredForCounts.length,
        sent,
        dryRunSuccess,
        pending
      },
      permission: {
        all: filteredForCounts.length,
        allowed,
        blocked,
        unknown
      }
    };
  }, [filteredForCounts, groupStatusByChatId, listPolicyByChatId]);

  const clearSearchInput = () => {
    setSearchInputValue('');
    setSearchTerm('');
  };

  const hasSearchFilter = searchInputValue.trim().length > 0;
  const hasMinMembersFilter = minMembers !== null;
  const hasStatusFilter = statusFilterMode !== 'all';
  const hasPermissionFilter = permissionFilterMode !== 'all';
  const hasAnyFilter =
    hasSearchFilter || hasMinMembersFilter || hasStatusFilter || hasPermissionFilter;

  const clearAllFilters = () => {
    clearSearchInput();
    setStatusFilterMode('all');
    setPermissionFilterMode('all');
    setMinMembersInput('');
  };

  return {
    searchInputValue,
    setSearchInputValue,
    searchInputComposing,
    setSearchInputComposing,
    clearSearchInput,
    statusFilterMode,
    setStatusFilterMode,
    permissionFilterMode,
    setPermissionFilterMode,
    minMembersInput,
    setMinMembersInput,
    minMembers,
    showAdvancedFilters,
    setShowAdvancedFilters,
    filtered,
    filterCounts,
    groupStatusByChatId,
    listPolicyByChatId,
    normalizedConfigList,
    hasAnyFilter,
    hasSearchFilter,
    hasStatusFilter,
    hasPermissionFilter,
    hasMinMembersFilter,
    statusFilterLabel,
    permissionFilterLabel,
    clearAllFilters
  };
}
