import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { LogLevel } from '@/lib/types/domain';

export interface UiActivityLog {
  id: string;
  level: LogLevel;
  message: string;
  createdAt: string;
  count?: number;
}

interface ActivityLogState {
  uiLogs: UiActivityLog[];
  pushUiLog: (input: { level: LogLevel; message: string }) => void;
  clearUiLogs: () => void;
}

export const useActivityLogStore = create<ActivityLogState>((set) => ({
  uiLogs: [],
  pushUiLog: ({ level, message }) => {
    const entry: UiActivityLog = {
      id: uuidv4(),
      level,
      message,
      createdAt: new Date().toISOString(),
      count: 1
    };

    set((state) => {
      const previous = state.uiLogs[state.uiLogs.length - 1];
      if (
        previous &&
        previous.level === entry.level &&
        previous.message === entry.message &&
        Math.abs(new Date(entry.createdAt).getTime() - new Date(previous.createdAt).getTime()) < 60000
      ) {
        const updatedPrevious: UiActivityLog = {
          ...previous,
          createdAt: entry.createdAt,
          count: (previous.count ?? 1) + 1
        };
        const nextLogs = [...state.uiLogs];
        nextLogs[nextLogs.length - 1] = updatedPrevious;
        return {
          uiLogs: nextLogs.slice(-1000)
        };
      }

      return {
        uiLogs: [...state.uiLogs, entry].slice(-1000)
      };
    });
  },
  clearUiLogs: () => set({ uiLogs: [] })
}));
