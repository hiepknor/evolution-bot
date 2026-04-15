export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    base_url TEXT NOT NULL,
    api_key_obfuscated TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    provider_mode TEXT NOT NULL DEFAULT 'evolution',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS groups_cache (
    id TEXT PRIMARY KEY,
    chat_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    members_count INTEGER NOT NULL DEFAULT 0,
    sendable INTEGER NOT NULL DEFAULT 1,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_path TEXT,
    caption_template TEXT NOT NULL,
    intro_text TEXT NOT NULL,
    title_text TEXT NOT NULL,
    footer_text TEXT NOT NULL,
    plain_text_fallback TEXT NOT NULL,
    emoji_mode TEXT NOT NULL,
    dry_run INTEGER NOT NULL,
    status TEXT NOT NULL,
    total_targets INTEGER NOT NULL,
    sent_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    config_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS campaign_targets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    members_count INTEGER NOT NULL,
    rendered_caption TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    last_error TEXT,
    started_at TEXT,
    finished_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );`,
  `CREATE TABLE IF NOT EXISTS campaign_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    target_id TEXT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    meta_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );`,
  `CREATE TABLE IF NOT EXISTS campaign_preferences (
    id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS quick_content_items (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_groups_cache_chat_id ON groups_cache(chat_id);`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id ON campaign_targets(campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON campaign_logs(campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_quick_content_items_sort_order ON quick_content_items(sort_order, created_at);`
];
