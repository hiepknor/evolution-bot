import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Campaign, CampaignTarget } from '@/lib/types/domain';
import { useActivityLogStore } from '@/stores/use-activity-log-store';
import { normalizeChatId } from '@/components/groups/panel/shared';

interface UseGroupsPanelControllerParams {
  activeCampaign: Campaign | null | undefined;
  targets: CampaignTarget[];
  queueCurrentTarget: CampaignTarget | undefined;
  running: boolean;
  whitelistMode: boolean;
  normalizedConfigList: string[];
  setCampaignConfig: (partial: Partial<Campaign['config']>) => void;
}

export function useGroupsPanelController({
  activeCampaign,
  targets,
  queueCurrentTarget,
  running,
  whitelistMode,
  normalizedConfigList,
  setCampaignConfig
}: UseGroupsPanelControllerParams) {
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);
  const pushUiLog = useActivityLogStore((state) => state.pushUiLog);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const lastAutoScrolledChatIdRef = useRef<string | null>(null);

  const activeCampaignDisplay = useMemo(() => {
    if (!activeCampaign) {
      return { label: 'chưa có', title: 'Trạng thái theo chiến dịch: chưa có' };
    }

    const campaignName = activeCampaign.name?.trim() ?? '';
    const campaignId = activeCampaign.id?.trim() ?? '';
    const preferredLabel = campaignName || campaignId;
    if (!preferredLabel) {
      return { label: 'chưa có', title: 'Trạng thái theo chiến dịch: chưa có' };
    }

    const compactLabel =
      !campaignName && preferredLabel.length > 26
        ? `${preferredLabel.slice(0, 12)}...${preferredLabel.slice(-8)}`
        : preferredLabel;

    return { label: compactLabel, title: `Trạng thái theo chiến dịch: ${preferredLabel}` };
  }, [activeCampaign]);

  const activeRunningChatId = useMemo(() => {
    if (!running) {
      return null;
    }

    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (target?.status === 'running') {
        return target.chatId;
      }
    }

    if (queueCurrentTarget?.status === 'running') {
      return queueCurrentTarget.chatId;
    }

    return null;
  }, [queueCurrentTarget?.chatId, queueCurrentTarget?.status, running, targets]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext = tag === 'input' || tag === 'textarea' || target?.isContentEditable === true;
      if (!isTypingContext) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!running || !activeRunningChatId || lastAutoScrolledChatIdRef.current === activeRunningChatId) {
      return;
    }

    const rowEl = rowRefs.current.get(activeRunningChatId);
    if (!rowEl || !tableViewportRef.current?.contains(rowEl)) {
      return;
    }

    lastAutoScrolledChatIdRef.current = activeRunningChatId;
    rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeRunningChatId, running]);

  useEffect(() => {
    if (!running) {
      lastAutoScrolledChatIdRef.current = null;
    }
  }, [running]);

  const copyChatId = async (chatId: string) => {
    try {
      await navigator.clipboard.writeText(chatId);
      setCopiedChatId(chatId);
      window.setTimeout(() => {
        setCopiedChatId((prev) => (prev === chatId ? null : prev));
      }, 1400);
    } catch {
      pushUiLog({ level: 'warn', message: 'Không thể sao chép chat id. Vui lòng cấp quyền clipboard.' });
    }
  };

  const toggleListMembership = (chatId: string) => {
    const normalizedChatId = normalizeChatId(chatId);
    const nextList = new Set(normalizedConfigList);
    const listed = nextList.has(normalizedChatId);
    if (listed) {
      nextList.delete(normalizedChatId);
    } else {
      nextList.add(normalizedChatId);
    }

    const nextBlacklist = Array.from(nextList).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    setCampaignConfig({ blacklist: nextBlacklist });

    const listLabel = whitelistMode ? 'danh sách cho phép' : 'danh sách chặn';
    const actionLabel = listed ? 'gỡ khỏi' : 'thêm vào';
    pushUiLog({ level: 'info', message: `Đã ${actionLabel} ${chatId} ${listLabel}.` });
  };

  return {
    copiedChatId,
    searchInputRef: searchInputRef as RefObject<HTMLInputElement>,
    tableViewportRef,
    rowRefs,
    activeCampaignDisplay,
    copyChatId,
    toggleListMembership
  };
}
