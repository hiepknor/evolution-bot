import { create } from 'zustand';
import type { Group } from '@/lib/types/domain';
import { groupsRepo } from '@/lib/db/repositories';

interface GroupsState {
  groups: Group[];
  selectedIds: Set<string>;
  searchTerm: string;
  syncing: boolean;
  lastSyncedAt?: string;
  setSearchTerm: (searchTerm: string) => void;
  toggleSelect: (chatId: string) => void;
  selectAllVisible: (chatIds: string[]) => void;
  deselectAllVisible: (chatIds: string[]) => void;
  invertSelectionVisible: (chatIds: string[]) => void;
  replaceGroups: (groups: Group[]) => Promise<void>;
  loadCached: () => Promise<void>;
  clearCache: () => Promise<void>;
  preserveSelectionAfterRefresh: (nextGroups: Group[]) => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  selectedIds: new Set<string>(),
  searchTerm: '',
  syncing: false,
  lastSyncedAt: undefined,

  setSearchTerm: (searchTerm) => set({ searchTerm }),

  toggleSelect: (chatId) => {
    const next = new Set(get().selectedIds);
    if (next.has(chatId)) {
      next.delete(chatId);
    } else {
      next.add(chatId);
    }
    set({ selectedIds: next });
  },

  selectAllVisible: (chatIds) => {
    const next = new Set(get().selectedIds);
    chatIds.forEach((id) => next.add(id));
    set({ selectedIds: next });
  },

  deselectAllVisible: (chatIds) => {
    const next = new Set(get().selectedIds);
    chatIds.forEach((id) => next.delete(id));
    set({ selectedIds: next });
  },

  invertSelectionVisible: (chatIds) => {
    const next = new Set(get().selectedIds);
    chatIds.forEach((id) => {
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
    });
    set({ selectedIds: next });
  },

  replaceGroups: async (groups) => {
    set({ syncing: true });
    try {
      await groupsRepo.replaceAll(groups);
      get().preserveSelectionAfterRefresh(groups);
      set({ groups, lastSyncedAt: new Date().toISOString() });
    } finally {
      set({ syncing: false });
    }
  },

  loadCached: async () => {
    const groups = await groupsRepo.list();
    set({
      groups,
      lastSyncedAt: groups[0]?.syncedAt
    });
  },

  clearCache: async () => {
    await groupsRepo.clear();
    set({ groups: [], selectedIds: new Set<string>(), lastSyncedAt: undefined });
  },

  preserveSelectionAfterRefresh: (nextGroups) => {
    const current = get().selectedIds;
    const allowed = new Set(nextGroups.map((group) => group.chatId));
    const next = new Set<string>();
    for (const id of current) {
      if (allowed.has(id)) {
        next.add(id);
      }
    }
    set({ selectedIds: next });
  }
}));
