import { describe, expect, it } from 'vitest';
import {
  applyGroupFilters,
  countGroupsByMode,
  resolveGroupPermissionState
} from '@/lib/groups/group-filtering';
import { GROUP_PERMISSION_HINT_KEY } from '@/lib/groups/group-metadata';
import type { Group } from '@/lib/types/domain';

const now = new Date().toISOString();

const groups: Group[] = [
  {
    id: 'g-1',
    chatId: '111@g.us',
    name: 'Allowed',
    membersCount: 20,
    sendable: true,
    adminOnly: false,
    raw: {},
    syncedAt: now
  },
  {
    id: 'g-2',
    chatId: '222@g.us',
    name: 'AdminOnly',
    membersCount: 15,
    sendable: true,
    adminOnly: true,
    raw: {},
    syncedAt: now
  },
  {
    id: 'g-3',
    chatId: '333@s.whatsapp.net',
    name: 'Blocked',
    membersCount: 0,
    sendable: false,
    adminOnly: false,
    raw: {},
    syncedAt: now
  }
];

const groupsWithHints: Group[] = [
  {
    ...groups[1]!,
    raw: {
      [GROUP_PERMISSION_HINT_KEY]: true
    }
  },
  {
    ...groups[0]!,
    raw: {
      [GROUP_PERMISSION_HINT_KEY]: false
    }
  }
];

describe('group filtering', () => {
  it('classifies permission states correctly', () => {
    const g1 = groups[0]!;
    const g2 = groups[1]!;
    const g3 = groups[2]!;
    expect(resolveGroupPermissionState(g1)).toBe('allowed');
    expect(resolveGroupPermissionState(g2)).toBe('unknown');
    expect(resolveGroupPermissionState(g3)).toBe('blocked');
  });

  it('filters by status + permission and computes counts', () => {
    const sentStatusByChatId = new Map<string, boolean>([
      ['111@g.us', false],
      ['222@g.us', true],
      ['333@s.whatsapp.net', false]
    ]);

    const filtered = applyGroupFilters({
      groups,
      searchTerm: '',
      minMembers: null,
      statusFilterMode: 'pending',
      permissionFilterMode: 'allowed',
      sentStatusByChatId
    });
    expect(filtered.map((item) => item.chatId)).toEqual(['111@g.us']);

    const counts = countGroupsByMode(groups, sentStatusByChatId);
    expect(counts.status).toEqual({ all: 3, sent: 1, pending: 2 });
    expect(counts.permission).toEqual({ all: 3, allowed: 1, unknown: 1, blocked: 1 });
  });

  it('prefers explicit API hint for admin-only permission state', () => {
    const hintedAllowed = groupsWithHints[0]!;
    const hintedBlocked = groupsWithHints[1]!;
    expect(resolveGroupPermissionState(hintedAllowed)).toBe('allowed');
    expect(resolveGroupPermissionState(hintedBlocked)).toBe('blocked');
  });
});
