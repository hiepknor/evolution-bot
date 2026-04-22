import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { panelTokens } from '@/components/layout/panel-tokens';
import { sanitizeInt } from '@/components/composer/operations/utils';
import { OperationsFilterIds } from '@/components/composer/operations/OperationsFilterIds';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

interface OperationsAdvancedSettingsProps {
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  controlsDisabled: boolean;
  config: {
    randomDelayMinMs: number;
    randomDelayMaxMs: number;
    pauseEvery: number;
    pauseDurationMs: number;
    maxAttempts: number;
    warningThreshold: number;
    whitelistMode: boolean;
  };
  setConfig: (config: Partial<{
    randomDelayMinMs: number;
    randomDelayMaxMs: number;
    pauseEvery: number;
    pauseDurationMs: number;
    maxAttempts: number;
    warningThreshold: number;
    whitelistMode: boolean;
  }>) => void;
  updateDelayMin: (raw: string) => void;
  updateDelayMax: (raw: string) => void;
  listModeLabel: string;
  chatIdCount: number;
  blacklistInput: string;
  onBlacklistInputChange: (value: string) => void;
  onBlacklistInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBlacklistInputBlur: () => void;
  blacklistItems: Array<{ chatId: string; groupName: string }>;
  groupNameByChatId: Map<string, string>;
  onRemoveBlacklistItem: (chatId: string) => void;
}

export function OperationsAdvancedSettings(props: OperationsAdvancedSettingsProps): JSX.Element {
  const {
    showAdvanced,
    setShowAdvanced,
    controlsDisabled,
    config,
    setConfig,
    updateDelayMin,
    updateDelayMax,
    listModeLabel,
    chatIdCount,
    blacklistInput,
    onBlacklistInputChange,
    onBlacklistInputKeyDown,
    onBlacklistInputBlur,
    blacklistItems,
    groupNameByChatId,
    onRemoveBlacklistItem
  } = props;

  return (
    <div className={panelTokens.section}>
      <button
        type="button"
        className={`${panelTokens.control} flex w-full items-center justify-between border border-border/40 bg-background/35 px-3 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/30`}
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        <span>Nâng cao</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            showAdvanced ? 'rotate-180 text-foreground/80' : 'text-muted-foreground/70'
          }`}
        />
      </button>

      {showAdvanced ? (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Độ trễ tối thiểu (ms)</Label>
              <Input
                type="number"
                value={config.randomDelayMinMs}
                onChange={(event) => updateDelayMin(event.target.value)}
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Độ trễ tối đa (ms)</Label>
              <Input
                type="number"
                value={config.randomDelayMaxMs}
                onChange={(event) => updateDelayMax(event.target.value)}
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Tạm dừng sau mỗi N nhóm</Label>
              <Input
                type="number"
                value={config.pauseEvery}
                onChange={(event) =>
                  setConfig({ pauseEvery: sanitizeInt(Number(event.target.value), config.pauseEvery, 0) })
                }
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Thời gian tạm dừng (ms)</Label>
              <Input
                type="number"
                value={config.pauseDurationMs}
                onChange={(event) =>
                  setConfig({
                    pauseDurationMs: sanitizeInt(Number(event.target.value), config.pauseDurationMs, 0)
                  })
                }
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Số lần thử tối đa</Label>
              <Input
                type="number"
                value={config.maxAttempts}
                onChange={(event) =>
                  setConfig({ maxAttempts: sanitizeInt(Number(event.target.value), config.maxAttempts, 1) })
                }
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Ngưỡng cảnh báo</Label>
              <Input
                type="number"
                value={config.warningThreshold}
                placeholder="0 = tắt"
                onChange={(event) =>
                  setConfig({
                    warningThreshold: sanitizeInt(Number(event.target.value), config.warningThreshold, 0)
                  })
                }
                disabled={controlsDisabled}
                className={panelTokens.control}
              />
            </div>
          </div>

          <OperationsFilterIds
            controlsDisabled={controlsDisabled}
            whitelistMode={config.whitelistMode}
            listModeLabel={listModeLabel}
            chatIdCount={chatIdCount}
            blacklistInput={blacklistInput}
            onBlacklistInputChange={onBlacklistInputChange}
            onBlacklistInputKeyDown={onBlacklistInputKeyDown}
            onBlacklistInputBlur={onBlacklistInputBlur}
            onWhitelistModeChange={(next) => setConfig({ whitelistMode: next })}
            blacklistItems={blacklistItems}
            groupNameByChatId={groupNameByChatId}
            onRemoveBlacklistItem={onRemoveBlacklistItem}
          />
        </div>
      ) : null}
    </div>
  );
}
