import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
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

function FieldGroup({ label }: { label: string }) {
  return (
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
  );
}

function NumInput({
  value,
  onChange,
  disabled,
  placeholder
}: {
  value: number;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${panelTokens.control} border-border/40 bg-background/60 tabular-nums`}
    />
  );
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
      {/* Toggle header */}
      <button
        type="button"
        className={cn(
          panelTokens.control,
          'flex w-full items-center gap-2.5 border border-border/40 bg-background/35 px-3 text-left transition-colors hover:bg-muted/30'
        )}
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
          showAdvanced ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'
        )}>
          <SlidersHorizontal className="h-3 w-3" />
        </div>
        <span className={cn(
          'flex-1 text-sm font-medium',
          showAdvanced ? 'text-foreground' : 'text-muted-foreground'
        )}>
          Nâng cao
        </span>
        <ChevronDown className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200',
          showAdvanced ? 'rotate-180 text-foreground/70' : 'text-muted-foreground/50'
        )} />
      </button>

      {showAdvanced ? (
        <div className="space-y-3 pt-1">
          {/* Delay group */}
          <div className="space-y-1.5">
            <FieldGroup label="Độ trễ ngẫu nhiên (ms)" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Tối thiểu</p>
                <NumInput
                  value={config.randomDelayMinMs}
                  onChange={updateDelayMin}
                  disabled={controlsDisabled}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Tối đa</p>
                <NumInput
                  value={config.randomDelayMaxMs}
                  onChange={updateDelayMax}
                  disabled={controlsDisabled}
                />
              </div>
            </div>
          </div>

          {/* Pause group */}
          <div className="space-y-1.5">
            <FieldGroup label="Tạm dừng định kỳ" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Sau mỗi N nhóm</p>
                <NumInput
                  value={config.pauseEvery}
                  onChange={(v) => setConfig({ pauseEvery: sanitizeInt(Number(v), config.pauseEvery, 0) })}
                  disabled={controlsDisabled}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Thời gian (ms)</p>
                <NumInput
                  value={config.pauseDurationMs}
                  onChange={(v) => setConfig({ pauseDurationMs: sanitizeInt(Number(v), config.pauseDurationMs, 0) })}
                  disabled={controlsDisabled}
                />
              </div>
            </div>
          </div>

          {/* Limits group */}
          <div className="space-y-1.5">
            <FieldGroup label="Giới hạn và cảnh báo" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Số lần thử tối đa</p>
                <NumInput
                  value={config.maxAttempts}
                  onChange={(v) => setConfig({ maxAttempts: sanitizeInt(Number(v), config.maxAttempts, 1) })}
                  disabled={controlsDisabled}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Ngưỡng cảnh báo</p>
                <NumInput
                  value={config.warningThreshold}
                  onChange={(v) => setConfig({ warningThreshold: sanitizeInt(Number(v), config.warningThreshold, 0) })}
                  disabled={controlsDisabled}
                  placeholder="0 = tắt"
                />
              </div>
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
