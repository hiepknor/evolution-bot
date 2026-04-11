import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import type { MessagingProvider } from '@/lib/providers/messaging-provider';
import { composeFinalMessage } from '@/lib/templates/render-template';
import { toAppError } from '@/lib/utils/error';
import type {
  Campaign,
  CampaignTarget,
  Group,
  QueueCallbacks,
  QueueProgress,
  SendResult,
  TargetStatus
} from '@/lib/types/domain';
import { resolveGroupPermissionState } from '@/lib/groups/group-filtering';
import { randomBetween, sleep } from '@/lib/utils/delay';

export interface BroadcastQueueInput {
  provider: MessagingProvider;
  instanceName: string;
  campaign: Campaign;
  groups: Group[];
  callbacks?: QueueCallbacks;
}

export class BroadcastQueue {
  private readonly provider: MessagingProvider;
  private readonly instanceName: string;
  private readonly campaign: Campaign;
  private readonly groups: Group[];
  private readonly callbacks?: QueueCallbacks;
  private stopped = false;
  private paused = false;

  constructor(input: BroadcastQueueInput) {
    this.provider = input.provider;
    this.instanceName = input.instanceName;
    this.campaign = input.campaign;
    this.groups = input.groups;
    this.callbacks = input.callbacks;
  }

  stop(): void {
    this.stopped = true;
  }

  pause(): void {
    if (!this.stopped) {
      this.paused = true;
    }
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.paused && !this.stopped) {
      await sleep(200);
    }
  }

  private async sleepWithControl(ms: number): Promise<void> {
    const totalMs = Math.max(0, Math.floor(ms));
    if (totalMs <= 0) {
      return;
    }
    const deadline = Date.now() + totalMs;

    while (!this.stopped) {
      await this.waitWhilePaused();
      if (this.stopped) {
        return;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return;
      }
      await sleep(Math.min(200, remaining));
    }
  }

  private createUniqueRandomTag(usedTags: Set<string>): string {
    const min = 100;
    const max = 999;
    const rangeSize = max - min + 1;

    if (usedTags.size >= rangeSize) {
      return `#${randomBetween(min, max)}`;
    }

    let next = `#${randomBetween(min, max)}`;
    let guard = 0;
    while (usedTags.has(next) && guard < rangeSize * 2) {
      next = `#${randomBetween(min, max)}`;
      guard += 1;
    }
    usedTags.add(next);
    return next;
  }

  private emitProgress(state: {
    processed: number;
    sent: number;
    dryRunSuccess: number;
    failed: number;
    skipped: number;
    averageMs: number;
    currentTarget?: CampaignTarget;
  }): void {
    const remaining = Math.max(this.groups.length - state.processed, 0);
    const etaMs = Math.floor(remaining * state.averageMs);
    const payload: QueueProgress = {
      campaignId: this.campaign.id,
      total: this.groups.length,
      processed: state.processed,
      sent: state.sent,
      dryRunSuccess: state.dryRunSuccess,
      failed: state.failed,
      skipped: state.skipped,
      etaMs,
      currentTarget: state.currentTarget
    };

    this.callbacks?.onProgress?.(payload);
  }

  private mkTarget(group: Group, index: number, randomTag: string): CampaignTarget {
    const renderedCaption = composeFinalMessage({
      introText: this.campaign.introText,
      titleText: this.campaign.titleText,
      captionTemplate: this.campaign.captionTemplate,
      footerText: this.campaign.footerText,
      context: {
        group_name: group.name,
        index,
        members: group.membersCount,
        date: dayjs().format('YYYY-MM-DD'),
        rand_tag: randomTag
      }
    });

    return {
      id: uuidv4(),
      campaignId: this.campaign.id,
      chatId: group.chatId,
      groupName: group.name,
      membersCount: group.membersCount,
      renderedCaption,
      status: 'pending',
      attempts: 0
    };
  }

  async run(): Promise<{ summary: QueueProgress; targets: CampaignTarget[] }> {
    const startedAt = Date.now();
    const targets: CampaignTarget[] = [];
    let sent = 0;
    let dryRunSuccess = 0;
    let failed = 0;
    let skipped = 0;
    const usedRandomTags = new Set<string>();

    this.callbacks?.onLog?.({
      campaignId: this.campaign.id,
      level: 'info',
      message: `Bắt đầu chiến dịch với ${this.groups.length} nhóm nhận`
    });

    for (const [index, group] of this.groups.entries()) {
      await this.waitWhilePaused();
      const randomTag = this.createUniqueRandomTag(usedRandomTags);
      const target = this.mkTarget(group, index + 1, randomTag);
      target.startedAt = new Date().toISOString();

      if (this.stopped) {
        target.status = 'cancelled';
        target.finishedAt = new Date().toISOString();
        targets.push(target);
        skipped += 1;
        this.callbacks?.onTargetUpdate?.(target);
        const processed = targets.length;
        const elapsed = Date.now() - startedAt;
        const averageMs = processed > 0 ? elapsed / processed : 1000;
        this.emitProgress({
          processed,
          sent,
          dryRunSuccess,
          failed,
          skipped,
          averageMs,
          currentTarget: target
        });
        continue;
      }

      if (resolveGroupPermissionState(group) === 'blocked') {
        target.status = 'skipped';
        target.lastError = !group.sendable
          ? 'Nhóm không có quyền gửi'
          : 'Nhóm bị chặn theo metadata quyền gửi';
        target.finishedAt = new Date().toISOString();
        targets.push(target);
        skipped += 1;
        this.callbacks?.onTargetUpdate?.(target);
        this.callbacks?.onLog?.({
          campaignId: this.campaign.id,
          targetId: target.id,
          level: 'warn',
          message: `Bỏ qua ${group.name}`,
          meta: { reason: target.lastError }
        });
        const processed = targets.length;
        const elapsed = Date.now() - startedAt;
        const averageMs = processed > 0 ? elapsed / processed : 1000;
        this.emitProgress({
          processed,
          sent,
          dryRunSuccess,
          failed,
          skipped,
          averageMs,
          currentTarget: target
        });
        continue;
      }

      target.status = 'running';
      this.callbacks?.onTargetUpdate?.(target);

      const maxAttempts = Math.max(this.campaign.config.maxAttempts, 1);
      let finalStatus: TargetStatus = 'failed';

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await this.waitWhilePaused();
        if (this.stopped) {
          finalStatus = 'cancelled';
          break;
        }
        target.attempts = attempt;

        if (this.campaign.dryRun) {
          await this.sleepWithControl(120 + Math.floor(Math.random() * 200));
          finalStatus = 'dry-run-success';
          break;
        }

        let result: SendResult;
        try {
          result = await this.provider.sendMediaToChat(this.instanceName, group.chatId, {
            imagePath: this.campaign.imagePath,
            caption: target.renderedCaption,
            plainText: this.campaign.plainTextFallback
          });
        } catch (error) {
          const appError = toAppError(error, 'SEND_FAILED');
          result = {
            ok: false,
            statusCode: appError.status,
            error: appError.message,
            raw: appError.details as Record<string, unknown> | undefined
          };
        }

        if (result.ok) {
          finalStatus = 'sent';
          break;
        }

        target.lastError = result.error ?? 'Lỗi gửi không xác định';

        if (attempt < maxAttempts) {
          this.callbacks?.onLog?.({
            campaignId: this.campaign.id,
            targetId: target.id,
            level: 'warn',
            message: `Thử lại ${attempt}/${maxAttempts - 1} cho ${group.name}`,
            meta: { error: target.lastError }
          });
        }
      }

      target.status = finalStatus;
      target.finishedAt = new Date().toISOString();
      targets.push(target);

      if (finalStatus === 'sent') {
        sent += 1;
      } else if (finalStatus === 'dry-run-success') {
        dryRunSuccess += 1;
      } else if (finalStatus === 'cancelled') {
        skipped += 1;
      } else {
        failed += 1;
      }

      this.callbacks?.onTargetUpdate?.(target);
      this.callbacks?.onLog?.({
        campaignId: this.campaign.id,
        targetId: target.id,
        level:
          finalStatus === 'sent' || finalStatus === 'dry-run-success'
            ? 'success'
            : finalStatus === 'cancelled'
              ? 'warn'
              : 'error',
        message:
          finalStatus === 'sent'
            ? `Đã gửi tới ${target.groupName}`
            : finalStatus === 'dry-run-success'
              ? `Chạy thử thành công tới ${target.groupName}`
            : finalStatus === 'cancelled'
              ? `Đã hủy gửi tới ${target.groupName}`
              : `Gửi thất bại tới ${target.groupName}`,
        meta: {
          attempts: target.attempts,
          status: finalStatus,
          error: target.lastError
        }
      });

      const processed = targets.length;
      const elapsed = Date.now() - startedAt;
      const averageMs = processed > 0 ? elapsed / processed : 1000;

      this.emitProgress({
        processed,
        sent,
        dryRunSuccess,
        failed,
        skipped,
        averageMs,
        currentTarget: target
      });

      if (!this.stopped && index < this.groups.length - 1) {
        if (this.campaign.config.pauseEvery > 0 && (index + 1) % this.campaign.config.pauseEvery === 0) {
          await this.sleepWithControl(this.campaign.config.pauseDurationMs);
        }

        const jitter = randomBetween(
          this.campaign.config.randomDelayMinMs,
          this.campaign.config.randomDelayMaxMs
        );
        await this.sleepWithControl(jitter);
      }
    }

    const elapsed = Date.now() - startedAt;
    const summary: QueueProgress = {
      campaignId: this.campaign.id,
      total: this.groups.length,
      processed: targets.length,
      sent,
      dryRunSuccess,
      failed,
      skipped,
      etaMs: 0,
      currentTarget: targets[targets.length - 1]
    };

    this.callbacks?.onLog?.({
      campaignId: this.campaign.id,
      level: 'info',
      message: `Chiến dịch hoàn tất sau ${Math.round(elapsed / 1000)} giây`
    });
    await this.callbacks?.onFinish?.(summary);

    return { summary, targets };
  }
}
