import type { Campaign, CampaignTarget } from '@/lib/types/domain';

const sanitize = (value: string | number | undefined): string => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

export const campaignTargetsToCsv = (
  campaign: Campaign,
  targets: CampaignTarget[]
): string => {
  const header = [
    'campaign_id',
    'campaign_name',
    'chat_id',
    'group_name',
    'status',
    'attempts',
    'last_error',
    'started_at',
    'finished_at'
  ];

  const rows = targets.map((target) =>
    [
      campaign.id,
      campaign.name,
      target.chatId,
      target.groupName,
      target.status,
      target.attempts,
      target.lastError,
      target.startedAt,
      target.finishedAt
    ]
      .map(sanitize)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};
