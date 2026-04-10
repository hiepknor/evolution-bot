const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

export const GROUP_PERMISSION_HINT_KEY = '__broadcastCanSend';

const toNumberSafe = (value: unknown, depth = 0): number | null => {
  if (depth > 3) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const obj = asRecord(value);
  if (!obj) {
    return null;
  }

  for (const key of ['value', 'count', 'size', 'total', 'length']) {
    const nested = toNumberSafe(obj[key], depth + 1);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
};

const countParticipants = (value: unknown): number | null => {
  if (Array.isArray(value)) {
    return value.length;
  }

  const fromPrimitive = toNumberSafe(value);
  if (fromPrimitive !== null) {
    return fromPrimitive;
  }

  const obj = asRecord(value);
  if (!obj) {
    return null;
  }

  const fromList = countParticipants(obj.list ?? obj.items ?? obj.participants);
  if (fromList !== null) {
    return fromList;
  }

  const keys = Object.keys(obj);
  const mapLike =
    keys.length > 0 && keys.every((key) => key.includes('@') || /^[0-9]+$/.test(key));
  if (mapLike) {
    return keys.length;
  }

  return null;
};

const toBooleanSafe = (value: unknown, depth = 0): boolean | null => {
  if (depth > 3) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['true', '1', 'yes', 'y', 'on', 'enabled'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off', 'disabled'].includes(normalized)) {
      return false;
    }
    return null;
  }

  const obj = asRecord(value);
  if (!obj) {
    return null;
  }

  for (const key of ['value', 'enabled', 'isEnabled', 'active', 'status']) {
    const nested = toBooleanSafe(obj[key], depth + 1);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
};

const toAdminBoolean = (value: unknown, depth = 0): boolean | null => {
  if (depth > 4) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (
      ['true', '1', 'yes', 'y', 'on', 'enabled', 'admin', 'superadmin', 'owner', 'creator'].includes(
        normalized
      )
    ) {
      return true;
    }
    if (
      ['false', '0', 'no', 'n', 'off', 'disabled', 'member', 'participant', 'user', 'none', 'null'].includes(
        normalized
      )
    ) {
      return false;
    }
    return null;
  }

  const obj = asRecord(value);
  if (!obj) {
    return null;
  }

  for (const key of ['isAdmin', 'admin', 'role', 'isOwner', 'owner', 'type', 'status', 'value']) {
    const nested = toAdminBoolean(obj[key], depth + 1);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
};

const extractBooleanByKeys = (
  source: Record<string, unknown>,
  keys: string[]
): boolean | null => {
  for (const key of keys) {
    const parsed = toBooleanSafe(source[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const collectPermissionSources = (
  group: Record<string, unknown>,
  metadata: Record<string, unknown>
): Record<string, unknown>[] => {
  const nestedKeys = [
    'settings',
    'permissions',
    'groupSettings',
    'groupInfo',
    'chat',
    'attrs'
  ];
  const sources: Record<string, unknown>[] = [group, metadata];

  for (const source of [group, metadata]) {
    for (const key of nestedKeys) {
      const nested = asRecord(source[key]);
      if (nested) {
        sources.push(nested);
      }
    }
  }

  return sources;
};

const extractNumberByKeys = (
  source: Record<string, unknown>,
  keys: string[]
): number[] => {
  const values: number[] = [];
  for (const key of keys) {
    const parsed = toNumberSafe(source[key]);
    if (parsed !== null) {
      values.push(parsed);
    }
  }
  return values;
};

export const extractGroupMembersCount = (
  group: Record<string, unknown>,
  groupMetadata?: Record<string, unknown>
): number => {
  const metadata = groupMetadata ?? asRecord(group.groupMetadata ?? group.metadata) ?? {};
  const countKeys = [
    'size',
    'participantsCount',
    'participantCount',
    'membersCount',
    'memberCount',
    'participants_count',
    'participant_count',
    'members_count',
    'member_count',
    'numParticipants',
    'numMembers'
  ];

  const candidates = [
    ...extractNumberByKeys(group, countKeys),
    ...extractNumberByKeys(metadata, countKeys),
    countParticipants(group.participants),
    countParticipants(groupMetadata?.participants),
    countParticipants(metadata.participants)
  ]
    .filter((value): value is number => value !== null)
    .map((value) => Math.max(0, Math.floor(value)));

  if (candidates.length === 0) {
    return 0;
  }

  return Math.max(...candidates);
};

export const extractGroupAdminOnly = (
  group: Record<string, unknown>,
  groupMetadata?: Record<string, unknown>
): boolean => {
  const metadata = groupMetadata ?? asRecord(group.groupMetadata ?? group.metadata) ?? {};
  const keys = [
    'onlyAdminsCanSend',
    'onlyAdminCanSend',
    'adminsOnlyCanSend',
    'adminOnly',
    'onlyAdmin',
    'adminsOnly',
    'isAdminsOnly',
    'announce',
    'isAnnounce',
    'only_admins_can_send',
    'admin_only',
    'only_admin',
    'is_announce'
  ];

  const metadataValue = extractBooleanByKeys(metadata, keys);
  if (metadataValue !== null) {
    return metadataValue;
  }

  const groupValue = extractBooleanByKeys(group, keys);
  if (groupValue !== null) {
    return groupValue;
  }

  return false;
};

export const extractGroupExplicitCanSend = (
  group: Record<string, unknown>,
  groupMetadata?: Record<string, unknown>
): boolean | null => {
  const metadata = groupMetadata ?? asRecord(group.groupMetadata ?? group.metadata) ?? {};
  const sources = collectPermissionSources(group, metadata);
  const readOnlyKeys = [
    'readOnly',
    'readonly',
    'isReadOnly',
    'isReadonly',
    'read_only',
    'is_read_only'
  ];
  const writableKeys = [
    'canSend',
    'canSendMessage',
    'canSendMessages',
    'sendMessage',
    'sendMessages',
    'canMessage',
    'isSendable',
    'canWrite',
    'isWritable',
    'writeable',
    'writable',
    'writePermission',
    'canPost',
    'canPostMessage',
    'canPostMessages',
    'allowSend',
    'allowedToSend',
    'isAllowedToSend'
  ];
  const adminStatusKeys = [
    'isAdmin',
    'admin',
    'role',
    'userRole',
    'participantRole',
    'isGroupAdmin',
    'participantIsAdmin',
    'meIsAdmin',
    'isCurrentUserAdmin',
    'currentUserIsAdmin',
    'userIsAdmin',
    'isOwner',
    'owner'
  ];

  let hasPositive = false;
  let adminStatus: boolean | null = null;

  for (const source of sources) {
    const readOnly = extractBooleanByKeys(source, readOnlyKeys);
    if (readOnly === true) {
      return false;
    }
    if (readOnly === false) {
      hasPositive = true;
    }
  }

  for (const source of sources) {
    const writable = extractBooleanByKeys(source, writableKeys);
    if (writable === false) {
      return false;
    }
    if (writable === true) {
      hasPositive = true;
    }
  }

  for (const source of sources) {
    if (adminStatus !== null) {
      break;
    }
    for (const key of adminStatusKeys) {
      const parsed = toAdminBoolean(source[key]);
      if (parsed !== null) {
        adminStatus = parsed;
        break;
      }
    }
  }

  if (hasPositive) {
    return true;
  }

  if (extractGroupAdminOnly(group, metadata) && adminStatus !== null) {
    return adminStatus;
  }

  return null;
};
