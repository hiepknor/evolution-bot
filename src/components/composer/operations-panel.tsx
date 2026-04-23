import { AlertTriangle, Zap } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useActivityLogStore } from '@/stores/use-activity-log-store';
import { useComposerStore } from '@/stores/use-composer-store';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { buildCampaignName } from '@/components/composer/operations/utils';
import { useOperationsSummary } from '@/components/composer/operations/hooks/use-operations-summary';
import { useOperationsForm } from '@/components/composer/operations/hooks/use-operations-form';
import { useCampaignExecution } from '@/components/composer/operations/hooks/use-campaign-execution';
import { OperationsReadiness } from '@/components/composer/operations/OperationsReadiness';
import { OperationsCampaignHeader } from '@/components/composer/operations/OperationsCampaignHeader';
import { OperationsBasicControls } from '@/components/composer/operations/OperationsBasicControls';
import { OperationsAdvancedSettings } from '@/components/composer/operations/OperationsAdvancedSettings';
import { OperationsCTARow } from '@/components/composer/operations/OperationsCTARow';
import { OperationsEmergencyStop } from '@/components/composer/operations/OperationsEmergencyStop';

export function OperationsPanel(): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const pushUiLog = useActivityLogStore((state) => state.pushUiLog);
  const groups = useGroupsStore((state) => state.groups);
  const selectedIdsSet = useGroupsStore((state) => state.selectedIds);
  const composer = useComposerStore();
  const campaignStore = useCampaignStore();

  const summary = useOperationsSummary({
    settings,
    badgeState,
    groups,
    selectedIdsSet,
    composer,
    campaignStore
  });

  const form = useOperationsForm({
    composer,
    campaignStore,
    controlsDisabled: summary.controlsDisabled,
    groupNameByChatId: summary.groupNameByChatId,
    pushUiLog
  });

  const execution = useCampaignExecution({
    campaignStore,
    settings,
    groups,
    selectedIds: summary.selectedIds,
    composer,
    canSend: summary.canSend,
    hasConnectionConfig: summary.hasConnectionConfig,
    isConnected: summary.isConnected,
    hasTargets: summary.hasTargets,
    hasContent: summary.hasContent,
    hasTemplateErrors: summary.hasTemplateErrors,
    templateErrors: summary.templateErrors,
    controlsDisabled: summary.controlsDisabled,
    campaignName: form.campaignName,
    setCampaignName: form.setCampaignName,
    setDryRun: form.setDryRun,
    setConfirmOpen: form.setConfirmOpen,
    setConfirmDuplicateWarning: form.setConfirmDuplicateWarning,
    pushUiLog
  });

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-sm font-semibold leading-none text-foreground">Vận hành</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 space-y-3">
        {campaignStore.duplicateWarning ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {campaignStore.duplicateWarning}
          </div>
        ) : null}

        {summary.warningThresholdHit ? (
          <div
            className={
              summary.highVolumeRisk
                ? 'flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning'
                : 'flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary'
            }
          >
            <AlertTriangle className="h-4 w-4" />
            {summary.highVolumeRisk
              ? `Khối lượng gửi rất lớn: ${summary.effectiveTargetCount} nhóm (ngưỡng ${campaignStore.config.warningThreshold}). Nên chia nhỏ theo nhiều đợt để an toàn hơn.`
              : `Khối lượng gửi lớn: ${summary.effectiveTargetCount} nhóm (ngưỡng ${campaignStore.config.warningThreshold}). Nên chạy thử trước khi gửi thật.`}
          </div>
        ) : null}

        {summary.permissionBlockedCount > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <p className="font-medium">
              Dự kiến bỏ qua {summary.permissionBlockedCount}/{summary.effectiveTargetCount} nhóm do
              không có quyền gửi.
            </p>
            <p className="mt-1">
              Có thể xử lý tối đa {summary.permissionAllowedCount} nhóm.
              {summary.permissionBlockedPreview
                ? ` Ví dụ: ${summary.permissionBlockedPreview}${
                    summary.permissionBlockedCount > 3
                      ? ` +${summary.permissionBlockedCount - 3} nhóm khác.`
                      : '.'
                  }`
                : ''}
            </p>
          </div>
        ) : null}

        {summary.hasTemplateErrors ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Mẫu nội dung có lỗi cú pháp.</p>
            <p className="mt-1">{summary.templateErrors[0]?.message}</p>
          </div>
        ) : null}
        {!summary.hasTemplateErrors && summary.displayedTemplateWarnings.length > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <p className="font-medium">Lưu ý trước khi gửi</p>
            <p className="mt-1">{summary.displayedTemplateWarnings[0]?.message}</p>
          </div>
        ) : null}

        <OperationsReadiness
          readiness={summary.readiness}
          canSend={summary.canSend}
          running={campaignStore.running}
          missingReadinessReasons={summary.missingReadinessReasons}
          executionBadgeHint={summary.executionBadgeHint}
          executionDisabledReason={summary.executionDisabledReason}
        />

        <OperationsCampaignHeader
          campaignName={form.campaignName}
          controlsDisabled={summary.controlsDisabled}
          onCampaignNameChange={form.setCampaignName}
          onResetCampaignName={() => form.setCampaignName(buildCampaignName())}
        />

        <OperationsBasicControls
          activeProfile={summary.activeProfile}
          controlsDisabled={summary.controlsDisabled}
          onApplyProfile={form.applyProfile}
        />

        <OperationsAdvancedSettings
          showAdvanced={form.showAdvanced}
          setShowAdvanced={form.setShowAdvanced}
          controlsDisabled={summary.controlsDisabled}
          config={campaignStore.config}
          setConfig={campaignStore.setConfig}
          updateDelayMin={form.updateDelayMin}
          updateDelayMax={form.updateDelayMax}
          listModeLabel={summary.listModeLabel}
          chatIdCount={summary.chatIdCount}
          blacklistInput={form.blacklistInput}
          onBlacklistInputChange={form.setBlacklistInput}
          onBlacklistInputKeyDown={form.onBlacklistInputKeyDown}
          onBlacklistInputBlur={form.commitBlacklistInput}
          blacklistItems={form.blacklistItems}
          groupNameByChatId={summary.groupNameByChatId}
          onRemoveBlacklistItem={form.removeBlacklistItem}
        />

        <OperationsCTARow
          selectedCount={summary.selectedCount}
          effectiveTargetCount={summary.effectiveTargetCount}
          permissionAllowedCount={summary.permissionAllowedCount}
          executionBlocked={summary.executionBlocked}
          executionDisabledReason={summary.executionDisabledReason}
          executionBadgeHint={summary.executionBadgeHint}
          running={campaignStore.running}
          stopping={campaignStore.stopping}
          paused={campaignStore.paused}
          hasActiveCampaign={Boolean(campaignStore.activeCampaign)}
          onDryRun={() => void execution.executeCampaign(true)}
          onSend={() => void execution.executeCampaign(false)}
          onExportCsv={() => void campaignStore.exportLatestCsv()}
        />

        <OperationsEmergencyStop
          running={campaignStore.running}
          stopping={campaignStore.stopping}
          paused={campaignStore.paused}
          hasQueue={Boolean(campaignStore.queue)}
          onTogglePause={execution.togglePause}
          onEmergencyStop={execution.emergencyStop}
        />

        <AlertDialog
          open={form.confirmOpen}
          onOpenChange={(open) => {
            form.setConfirmOpen(open);
            if (!open) {
              form.setConfirmDuplicateWarning(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{form.dryRun ? 'Xác nhận chạy thử' : 'Xác nhận gửi'}</AlertDialogTitle>
              <AlertDialogDescription>
                Chiến dịch <strong>{form.campaignName}</strong> sẽ xử lý{' '}
                <strong>{summary.effectiveTargetCount}</strong> nhóm.
              </AlertDialogDescription>
              {!form.dryRun && form.confirmDuplicateWarning ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  {form.confirmDuplicateWarning} Trùng theo tiêu chí: ảnh + nội dung + nhóm nhận.
                </div>
              ) : null}
              {summary.permissionBlockedCount > 0 ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  Dự kiến bỏ qua {summary.permissionBlockedCount}/{summary.effectiveTargetCount} nhóm do
                  không có quyền gửi. Có thể xử lý tối đa {summary.permissionAllowedCount} nhóm.
                </div>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => void execution.confirmExecution(form.dryRun)}>
                {form.dryRun ? 'Bắt đầu chạy thử' : form.confirmDuplicateWarning ? 'Vẫn gửi' : 'Bắt đầu gửi'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
