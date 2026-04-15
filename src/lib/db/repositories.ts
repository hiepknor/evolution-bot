import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db/database';
import type {
  Campaign,
  CampaignConfig,
  CampaignLog,
  CampaignTarget,
  ConnectionSettings,
  Group,
  LogLevel,
  QuickContentItem,
  TargetStatus
} from '@/lib/types/domain';
import { extractGroupAdminOnly, extractGroupMembersCount } from '@/lib/groups/group-metadata';
import { deobfuscate, obfuscate } from '@/lib/utils/crypto';

const now = () => dayjs().toISOString();

export const settingsRepo = {
  async get(): Promise<ConnectionSettings | null> {
    const db = await getDb();
    const rows = await db.select<
      Array<{
        id: string;
        base_url: string;
        api_key_obfuscated: string;
        instance_name: string;
        provider_mode: 'evolution' | 'mock';
        created_at: string;
        updated_at: string;
      }>
    >('SELECT * FROM app_settings LIMIT 1');

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      baseUrl: row.base_url,
      apiKey: deobfuscate(row.api_key_obfuscated),
      instanceName: row.instance_name,
      providerMode: row.provider_mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  async upsert(input: Pick<ConnectionSettings, 'baseUrl' | 'apiKey' | 'instanceName' | 'providerMode'>): Promise<ConnectionSettings> {
    const db = await getDb();
    const existing = await this.get();
    const id = existing?.id ?? uuidv4();
    const createdAt = existing?.createdAt ?? now();
    const updatedAt = now();

    await db.execute(
      `INSERT OR REPLACE INTO app_settings (id, base_url, api_key_obfuscated, instance_name, provider_mode, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        id,
        input.baseUrl,
        obfuscate(input.apiKey),
        input.instanceName,
        input.providerMode,
        createdAt,
        updatedAt
      ]
    );

    return {
      id,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      instanceName: input.instanceName,
      providerMode: input.providerMode,
      createdAt,
      updatedAt
    };
  }
};

export const campaignPreferencesRepo = {
  async get(): Promise<CampaignConfig | null> {
    const db = await getDb();
    const rows = await db.select<
      Array<{
        config_json: string;
      }>
    >('SELECT config_json FROM campaign_preferences LIMIT 1');

    const row = rows[0];
    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.config_json) as CampaignConfig;
    } catch {
      return null;
    }
  },

  async upsert(config: CampaignConfig): Promise<void> {
    const db = await getDb();
    const updatedAt = now();
    const rows = await db.select<Array<{ created_at: string }>>(
      'SELECT created_at FROM campaign_preferences WHERE id = $1 LIMIT 1',
      ['default']
    );
    const createdAt = rows[0]?.created_at ?? updatedAt;

    await db.execute(
      `INSERT OR REPLACE INTO campaign_preferences (id, config_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4)`,
      ['default', JSON.stringify(config), createdAt, updatedAt]
    );
  }
};

export const quickContentItemsRepo = {
  async list(): Promise<QuickContentItem[]> {
    const db = await getDb();
    const rows = await db.select<
      Array<{
        id: string;
        label: string;
        content: string;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>
    >('SELECT * FROM quick_content_items ORDER BY sort_order ASC, created_at ASC');

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      content: row.content,
      sortOrder: Number(row.sort_order ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  async create(input: Pick<QuickContentItem, 'label' | 'content'>): Promise<QuickContentItem> {
    const db = await getDb();
    const rows = await db.select<Array<{ max_sort_order: number | null }>>(
      'SELECT MAX(sort_order) AS max_sort_order FROM quick_content_items'
    );
    const sortOrder = Number(rows[0]?.max_sort_order ?? -1) + 1;
    const item: QuickContentItem = {
      id: uuidv4(),
      label: input.label.trim(),
      content: input.content.trim(),
      sortOrder,
      createdAt: now(),
      updatedAt: now()
    };

    await db.execute(
      `INSERT INTO quick_content_items (id, label, content, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [item.id, item.label, item.content, item.sortOrder, item.createdAt, item.updatedAt]
    );

    return item;
  },

  async update(id: string, input: Pick<QuickContentItem, 'label' | 'content'>): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE quick_content_items
       SET label = $1, content = $2, updated_at = $3
       WHERE id = $4`,
      [input.label.trim(), input.content.trim(), now(), id]
    );
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM quick_content_items WHERE id = $1', [id]);
  },

  async reorder(idsInOrder: string[]): Promise<void> {
    const db = await getDb();
    const updatedAt = now();

    for (const [index, id] of idsInOrder.entries()) {
      await db.execute(
        `UPDATE quick_content_items
         SET sort_order = $1, updated_at = $2
         WHERE id = $3`,
        [index, updatedAt, id]
      );
    }
  }
};

export const groupsRepo = {
  async list(): Promise<Group[]> {
    const db = await getDb();
    const rows = await db.select<
      Array<{
        id: string;
        chat_id: string;
        name: string;
        members_count: number;
        sendable: number;
        raw_json: string;
        synced_at: string;
      }>
    >('SELECT * FROM groups_cache ORDER BY name ASC');

    return rows.map((row) => {
      const raw = JSON.parse(row.raw_json) as Record<string, unknown>;
      const groupMetadata = (raw.groupMetadata ?? raw.metadata ?? {}) as Record<string, unknown>;
      const adminOnly = extractGroupAdminOnly(raw, groupMetadata);
      const parsedMembersCount = extractGroupMembersCount(raw, groupMetadata);
      const membersCount = parsedMembersCount > 0 ? parsedMembersCount : Number(row.members_count);

      return {
        id: row.id,
        chatId: row.chat_id,
        name: row.name,
        membersCount: Number.isFinite(membersCount) && membersCount > 0 ? membersCount : 0,
        sendable: Boolean(row.sendable),
        adminOnly,
        raw,
        syncedAt: row.synced_at
      };
    });
  },

  async replaceAll(groups: Group[]): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM groups_cache');

    for (const group of groups) {
      await db.execute(
        `INSERT INTO groups_cache (id, chat_id, name, members_count, sendable, raw_json, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          group.id,
          group.chatId,
          group.name,
          group.membersCount,
          group.sendable ? 1 : 0,
          JSON.stringify(group.raw),
          group.syncedAt
        ]
      );
    }
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM groups_cache');
  }
};

export const campaignsRepo = {
  async recoverInterrupted(): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE campaigns
       SET status = 'failed', finished_at = COALESCE(finished_at, $1)
       WHERE status = 'running'`,
      [now()]
    );
  },

  async insert(campaign: Campaign): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO campaigns (
        id, name, image_path, caption_template, intro_text, title_text, footer_text,
        plain_text_fallback, emoji_mode, dry_run, status, total_targets, sent_count,
        failed_count, skipped_count, checksum, started_at, finished_at, config_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        campaign.id,
        campaign.name,
        campaign.imagePath ?? null,
        campaign.captionTemplate,
        campaign.introText,
        campaign.titleText,
        campaign.footerText,
        campaign.plainTextFallback,
        campaign.emojiMode,
        campaign.dryRun ? 1 : 0,
        campaign.status,
        campaign.totalTargets,
        campaign.sentCount,
        campaign.failedCount,
        campaign.skippedCount,
        campaign.checksum,
        campaign.startedAt ?? null,
        campaign.finishedAt ?? null,
        JSON.stringify(campaign.config)
      ]
    );
  },

  async updateStatus(id: string, status: Campaign['status'], summary: Pick<Campaign, 'sentCount' | 'failedCount' | 'skippedCount' | 'finishedAt'>): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE campaigns
       SET status = $1, sent_count = $2, failed_count = $3, skipped_count = $4, finished_at = $5
       WHERE id = $6`,
      [status, summary.sentCount, summary.failedCount, summary.skippedCount, summary.finishedAt ?? null, id]
    );
  },

  async list(limit = 20): Promise<Campaign[]> {
    const db = await getDb();
    const rows = await db.select<Array<Record<string, unknown>>>(
      'SELECT * FROM campaigns ORDER BY started_at DESC LIMIT $1',
      [limit]
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      imagePath: row.image_path ? String(row.image_path) : undefined,
      captionTemplate: String(row.caption_template ?? ''),
      introText: String(row.intro_text ?? ''),
      titleText: String(row.title_text ?? ''),
      footerText: String(row.footer_text ?? ''),
      plainTextFallback: String(row.plain_text_fallback ?? ''),
      emojiMode: row.emoji_mode as Campaign['emojiMode'],
      dryRun: Boolean(row.dry_run),
      status: row.status as Campaign['status'],
      totalTargets: Number(row.total_targets ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      skippedCount: Number(row.skipped_count ?? 0),
      startedAt: row.started_at ? String(row.started_at) : undefined,
      finishedAt: row.finished_at ? String(row.finished_at) : undefined,
      config: JSON.parse(String(row.config_json ?? '{}')) as Campaign['config'],
      checksum: String(row.checksum ?? '')
    }));
  },

  async latestChecksum(): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<Array<{ checksum: string }>>(
      'SELECT checksum FROM campaigns ORDER BY started_at DESC LIMIT 1'
    );
    return rows[0]?.checksum ?? null;
  },

  async remove(campaignId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM campaign_logs WHERE campaign_id = $1', [campaignId]);
    await db.execute('DELETE FROM campaign_targets WHERE campaign_id = $1', [campaignId]);
    await db.execute('DELETE FROM campaigns WHERE id = $1', [campaignId]);
  }
};

export const targetsRepo = {
  async insertMany(targets: CampaignTarget[]): Promise<void> {
    const db = await getDb();
    for (const target of targets) {
      await db.execute(
        `INSERT INTO campaign_targets (
          id, campaign_id, chat_id, group_name, members_count, rendered_caption,
          status, attempts, last_error, started_at, finished_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          target.id,
          target.campaignId,
          target.chatId,
          target.groupName,
          target.membersCount,
          target.renderedCaption,
          target.status,
          target.attempts,
          target.lastError ?? null,
          target.startedAt ?? null,
          target.finishedAt ?? null
        ]
      );
    }
  },

  async update(target: CampaignTarget): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE campaign_targets
       SET status=$1, attempts=$2, last_error=$3, started_at=$4, finished_at=$5, rendered_caption=$6
       WHERE id=$7`,
      [
        target.status,
        target.attempts,
        target.lastError ?? null,
        target.startedAt ?? null,
        target.finishedAt ?? null,
        target.renderedCaption,
        target.id
      ]
    );
  },

  async upsert(target: CampaignTarget): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT OR REPLACE INTO campaign_targets (
        id, campaign_id, chat_id, group_name, members_count, rendered_caption,
        status, attempts, last_error, started_at, finished_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        target.id,
        target.campaignId,
        target.chatId,
        target.groupName,
        target.membersCount,
        target.renderedCaption,
        target.status,
        target.attempts,
        target.lastError ?? null,
        target.startedAt ?? null,
        target.finishedAt ?? null
      ]
    );
  },

  async byCampaign(campaignId: string): Promise<CampaignTarget[]> {
    const db = await getDb();
    const rows = await db.select<Array<Record<string, unknown>>>(
      'SELECT * FROM campaign_targets WHERE campaign_id = $1 ORDER BY rowid ASC',
      [campaignId]
    );

    return rows.map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id),
      chatId: String(row.chat_id),
      groupName: String(row.group_name),
      membersCount: Number(row.members_count),
      renderedCaption: String(row.rendered_caption),
      status: row.status as TargetStatus,
      attempts: Number(row.attempts ?? 0),
      lastError: row.last_error ? String(row.last_error) : undefined,
      startedAt: row.started_at ? String(row.started_at) : undefined,
      finishedAt: row.finished_at ? String(row.finished_at) : undefined
    }));
  }
};

export const logsRepo = {
  async insert(input: Omit<CampaignLog, 'id' | 'createdAt'>): Promise<CampaignLog> {
    const db = await getDb();
    const id = uuidv4();
    const createdAt = now();
    await db.execute(
      `INSERT INTO campaign_logs (id, campaign_id, target_id, level, message, meta_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        input.campaignId,
        input.targetId ?? null,
        input.level,
        input.message,
        input.meta ? JSON.stringify(input.meta) : null,
        createdAt
      ]
    );

    return {
      id,
      createdAt,
      ...input
    };
  },

  async byCampaign(campaignId: string): Promise<CampaignLog[]> {
    const db = await getDb();
    const rows = await db.select<Array<Record<string, unknown>>>(
      'SELECT * FROM campaign_logs WHERE campaign_id = $1 ORDER BY created_at ASC',
      [campaignId]
    );

    return rows.map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id),
      targetId: row.target_id ? String(row.target_id) : undefined,
      level: row.level as LogLevel,
      message: String(row.message),
      meta: row.meta_json ? (JSON.parse(String(row.meta_json)) as Record<string, unknown>) : undefined,
      createdAt: String(row.created_at)
    }));
  }
};
