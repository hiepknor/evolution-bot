import { HttpClient } from '@/lib/api/http-client';
import type {
  EvolutionGroupDto,
  EvolutionInstanceDto,
  EvolutionSendMediaRequest,
  EvolutionSendTextRequest
} from '@/lib/types/api';
import type {
  ConnectionState,
  Group,
  SendPayload,
  SendResult,
  TestConnectionResult
} from '@/lib/types/domain';
import type { FetchGroupsOptions, MessagingProvider } from '@/lib/providers/messaging-provider';
import {
  extractGroupAdminOnly,
  extractGroupExplicitCanSend,
  extractGroupMembersCount,
  GROUP_PERMISSION_HINT_KEY
} from '@/lib/groups/group-metadata';
import { readImageBytes } from '@/lib/media/image-path';
import { AppError } from '@/lib/utils/error';

interface EvolutionProviderOptions {
  baseUrl: string;
  apiKey: string;
}

const ADMIN_PERMISSION_DEEP_CHECK_MAX_GROUPS = 180;
const ADMIN_PERMISSION_DEEP_CHECK_TIMEOUT_MS = 12_000;
const INSTANCE_LOOKUP_TIMEOUT_MS = 8_000;
const MISSING_GROUP_RETENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const GENERIC_MISSING_GROUP_RETENTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const REFERENCE_FALLBACK_GROUP_LIMIT = 600;
const GROUP_SYNC_MAX_PASSES = 2;
const GROUP_JID_PATTERN = /([0-9a-z._:-]+@g\.us)\b/gi;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const toStringSafe = (value: unknown, depth = 0): string => {
  if (depth > 5) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const obj = asRecord(value);
  if (!obj) {
    return '';
  }

  const serialized = obj._serialized;
  if (typeof serialized === 'string') {
    return serialized;
  }

  const directCandidates = [
    obj.id,
    obj.jid,
    obj.remoteJid,
    obj.groupJid,
    obj.chatId,
    obj.value
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  const user = obj.user;
  const server = obj.server;
  if (typeof user === 'string' && typeof server === 'string') {
    return `${user}@${server}`;
  }

  for (const candidate of directCandidates) {
    const nested = toStringSafe(candidate, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return '';
};

const pickBestChatId = (...values: unknown[]): string => {
  const normalized = values
    .map((value) => toStringSafe(value))
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return '';
  }

  const unique = Array.from(new Set(normalized));
  const groupJid = unique.find((value) => value.toLowerCase().endsWith('@g.us'));
  if (groupJid) {
    return groupJid;
  }

  const anyJid = unique.find((value) => value.includes('@'));
  if (anyJid) {
    return anyJid;
  }

  return unique[0] ?? '';
};

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
};

const isIdentifierLikeName = (name: string, chatId: string): boolean => {
  const normalizedName = name.trim().toLowerCase();
  const normalizedChatId = chatId.trim().toLowerCase();
  const localPart = normalizedChatId.split('@')[0] ?? '';

  if (!normalizedName) {
    return true;
  }

  if (
    normalizedName === normalizedChatId ||
    normalizedName === localPart ||
    normalizedName.endsWith('@g.us')
  ) {
    return true;
  }

  return /^[0-9\-_.:\s]+$/.test(normalizedName);
};

const scoreGroupName = (name: string, chatId: string): number => {
  const normalized = normalizeText(name);
  if (!normalized) {
    return 0;
  }
  if (isIdentifierLikeName(normalized, chatId)) {
    return 1;
  }

  let score = 10;
  if (/[a-zA-ZÀ-ỹ]/.test(normalized)) {
    score += 2;
  }
  if (normalized.length >= 6) {
    score += 1;
  }
  if (/\s/.test(normalized)) {
    score += 1;
  }

  return score;
};

const pickBestGroupName = (chatId: string, ...candidates: unknown[]): string => {
  const uniqueCandidates = Array.from(
    new Set(
      candidates
        .map((value) => normalizeText(value))
        .filter((value) => value.length > 0)
    )
  );

  if (uniqueCandidates.length === 0) {
    return chatId;
  }

  let best = uniqueCandidates[0] ?? chatId;
  let bestScore = scoreGroupName(best, chatId);

  for (const candidate of uniqueCandidates.slice(1)) {
    const candidateScore = scoreGroupName(candidate, chatId);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return best;
};

const isLikelyGroupDtoObject = (obj: Record<string, unknown>): boolean => {
  return [
    'id',
    'jid',
    'remoteJid',
    'groupJid',
    'subject',
    'name',
    'participants',
    'isGroup',
    'groupMetadata',
    'metadata'
  ].some((key) => key in obj);
};

const collectResponseHints = (value: unknown, depth = 0): string[] => {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectResponseHints(item, depth + 1));
  }

  const obj = asRecord(value);
  if (!obj) {
    return [];
  }

  const hints: string[] = [];
  const messageKeys = ['message', 'error', 'reason', 'msg', 'detail', 'details'];
  for (const key of messageKeys) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      hints.push(candidate.trim());
    }
  }

  for (const nested of Object.values(obj)) {
    hints.push(...collectResponseHints(nested, depth + 1));
  }

  return hints;
};

const containsRateLimitSignal = (value: unknown, depth = 0): boolean => {
  if (depth > 8 || value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return value === 429;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return /(rate[\s_-]*over[\s_-]*limit|rate[\s_-]*limit|too many requests|\b429\b)/i.test(normalized);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsRateLimitSignal(item, depth + 1));
  }

  const obj = asRecord(value);
  if (!obj) {
    return false;
  }

  for (const key of Object.keys(obj)) {
    if (containsRateLimitSignal(key, depth + 1)) {
      return true;
    }
  }

  for (const nested of Object.values(obj)) {
    if (containsRateLimitSignal(nested, depth + 1)) {
      return true;
    }
  }

  return false;
};

const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    if (error.status === 429) {
      return true;
    }
    return containsRateLimitSignal(error.message) || containsRateLimitSignal(error.details);
  }

  if (error instanceof Error) {
    return containsRateLimitSignal(error.message);
  }

  return containsRateLimitSignal(error);
};

const extractGroupList = (value: unknown, depth = 0): EvolutionGroupDto[] => {
  if (depth > 8 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const merged: EvolutionGroupDto[] = [];
    for (const item of value) {
      merged.push(...extractGroupList(item, depth + 1));
    }
    return merged;
  }

  const obj = asRecord(value);
  if (!obj) {
    return [];
  }

  const merged: EvolutionGroupDto[] = [];

  if (isLikelyGroupDtoObject(obj)) {
    merged.push(obj as EvolutionGroupDto);
  }

  for (const [key, candidate] of Object.entries(obj)) {
    const candidateObj = asRecord(candidate);
    if (candidateObj && key.includes('@g.us')) {
      // Some payloads are object maps keyed by group JID.
      const enriched: Record<string, unknown> =
        'id' in candidateObj || 'jid' in candidateObj || 'remoteJid' in candidateObj
          ? candidateObj
          : { ...candidateObj, id: key };
      merged.push(...extractGroupList(enriched, depth + 1));
      continue;
    }

    merged.push(...extractGroupList(candidate, depth + 1));
  }

  return merged;
};

const collectGroupJidReferences = (value: unknown, depth = 0): string[] => {
  if (depth > 8 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string') {
    const matches = value.toLowerCase().match(GROUP_JID_PATTERN);
    return matches ? matches.map((item) => item.trim()) : [];
  }

  if (Array.isArray(value)) {
    const merged: string[] = [];
    for (const item of value) {
      merged.push(...collectGroupJidReferences(item, depth + 1));
    }
    return merged;
  }

  const obj = asRecord(value);
  if (!obj) {
    return [];
  }

  const merged: string[] = [];
  for (const key of Object.keys(obj)) {
    const keyMatches = key.toLowerCase().match(GROUP_JID_PATTERN);
    if (keyMatches) {
      merged.push(...keyMatches.map((item) => item.trim()));
    }
  }
  for (const nested of Object.values(obj)) {
    merged.push(...collectGroupJidReferences(nested, depth + 1));
  }
  return merged;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const normalizeIdentifier = (value: unknown): string | null => {
  const raw = toStringSafe(value).trim().toLowerCase();
  return raw.length > 0 ? raw : null;
};

const addIdentifierVariants = (target: Set<string>, value: unknown): void => {
  const normalized = normalizeIdentifier(value);
  if (!normalized) {
    return;
  }

  target.add(normalized);
  const localPart = normalized.split('@')[0] ?? '';
  const digits = localPart.replace(/\D+/g, '');
  if (digits.length > 5) {
    target.add(`${digits}@s.whatsapp.net`);
  }
};

const extractInstanceName = (entry: EvolutionInstanceDto): string => {
  return String(entry.name ?? entry.instanceName ?? entry.instance?.instanceName ?? '').trim();
};

const buildSelfIdentifiers = (entry: EvolutionInstanceDto): Set<string> => {
  const identifiers = new Set<string>();
  addIdentifierVariants(identifiers, entry.ownerJid);
  addIdentifierVariants(identifiers, entry.number);
  addIdentifierVariants(identifiers, entry.instance?.ownerJid);
  addIdentifierVariants(identifiers, entry.instance?.number);
  return identifiers;
};

const collectParticipants = (dto: EvolutionGroupDto): Array<Record<string, unknown>> => {
  const metadata = asRecord(dto.groupMetadata ?? dto.metadata);
  const rawParticipants = dto.participants ?? metadata?.participants;
  if (!Array.isArray(rawParticipants)) {
    return [];
  }
  return rawParticipants
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const isAdminRole = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'member' || normalized === 'none' || normalized === 'null') {
      return false;
    }
    if (normalized === 'admin' || normalized === 'superadmin' || normalized === 'owner') {
      return true;
    }
  }
  return null;
};

const resolveParticipantAdminState = (participant: Record<string, unknown>): boolean | null => {
  const adminState = isAdminRole(participant.admin);
  if (adminState !== null) {
    return adminState;
  }

  const isAdmin = isAdminRole(participant.isAdmin);
  if (isAdmin !== null) {
    return isAdmin;
  }

  const isSuperAdmin = isAdminRole(participant.isSuperAdmin);
  if (isSuperAdmin !== null) {
    return isSuperAdmin;
  }

  return null;
};

const resolveSelfAdminPermission = (
  dto: EvolutionGroupDto,
  selfIdentifiers: Set<string>
): boolean | null => {
  if (selfIdentifiers.size === 0) {
    return null;
  }

  const participants = collectParticipants(dto);
  if (participants.length === 0) {
    return null;
  }

  let hasSelfParticipant = false;

  for (const participant of participants) {
    const participantIdentifiers = new Set<string>();
    addIdentifierVariants(participantIdentifiers, participant.phoneNumber);
    addIdentifierVariants(participantIdentifiers, participant.id);
    addIdentifierVariants(participantIdentifiers, participant.jid);
    addIdentifierVariants(participantIdentifiers, participant.participant);

    const isSelf = Array.from(participantIdentifiers).some((id) => selfIdentifiers.has(id));
    if (!isSelf) {
      continue;
    }

    hasSelfParticipant = true;
    const adminState = resolveParticipantAdminState(participant);
    if (adminState === true) {
      return true;
    }
  }

  return hasSelfParticipant ? false : null;
};

const applyAdminPermissionHint = (
  group: Group,
  canSendByAdminCheck: boolean | null
): Group => {
  const raw = asRecord(group.raw) ?? {};
  const rawWithHint: Record<string, unknown> = {
    ...raw,
    [GROUP_PERMISSION_HINT_KEY]: canSendByAdminCheck
  };

  if (canSendByAdminCheck === false) {
    return {
      ...group,
      sendable: false,
      raw: rawWithHint
    };
  }

  if (canSendByAdminCheck === true) {
    return {
      ...group,
      sendable: true,
      raw: rawWithHint
    };
  }

  return {
    ...group,
    raw: rawWithHint
  };
};

const resolveGroupPermissionHint = (group: Group): boolean | null => {
  const raw = asRecord(group.raw) ?? {};
  const rawHint = raw[GROUP_PERMISSION_HINT_KEY];
  if (typeof rawHint === 'boolean') {
    return rawHint;
  }
  if (rawHint === null) {
    return null;
  }
  return extractGroupExplicitCanSend(raw);
};

const extractReusablePermissionHint = (group: Group): boolean | undefined => {
  const hint = resolveGroupPermissionHint(group);
  return typeof hint === 'boolean' ? hint : undefined;
};

const normalizeGroup = (dto: EvolutionGroupDto): Group => {
  const groupMetadata = (dto.groupMetadata ?? dto.metadata ?? {}) as Record<string, unknown>;
  const rawGroup = dto as Record<string, unknown>;
  const key = asRecord(dto.key);
  const chatId = pickBestChatId(
    dto.jid,
    dto.remoteJid,
    dto.groupJid,
    dto.chatId,
    key?.remoteJid,
    key?.id,
    key?.participant,
    groupMetadata.id,
    groupMetadata.jid,
    groupMetadata.groupJid,
    groupMetadata.remoteJid,
    dto.id
  );
  const name = pickBestGroupName(
    chatId,
    dto.subject,
    groupMetadata.subject,
    dto.name,
    groupMetadata.name,
    groupMetadata.title,
    groupMetadata.groupName,
    dto.pushName,
    dto.pushname,
    dto.notifyName,
    dto.notify,
    dto.conversation,
    dto.chatName,
    key?.name,
    key?.subject
  );
  const membersCount = extractGroupMembersCount(rawGroup, groupMetadata);
  const adminOnly = extractGroupAdminOnly(rawGroup, groupMetadata);
  const explicitCanSend = extractGroupExplicitCanSend(rawGroup, groupMetadata);
  const looksLikeGroupChat = chatId.endsWith('@g.us') || dto.isGroup === true;
  const sendable = looksLikeGroupChat && explicitCanSend !== false;
  const rawWithHint: Record<string, unknown> =
    explicitCanSend === null
      ? dto
      : {
          ...dto,
          [GROUP_PERMISSION_HINT_KEY]: explicitCanSend
        };

  return {
    id: chatId,
    chatId,
    name,
    membersCount,
    sendable,
    adminOnly,
    raw: rawWithHint,
    syncedAt: new Date().toISOString()
  };
};

const mergeGroupSnapshots = (current: Group, incoming: Group, preferIncomingOnNameTie = false): Group => {
  const currentName = normalizeText(current.name);
  const incomingName = normalizeText(incoming.name);
  const currentNameScore = scoreGroupName(currentName, current.chatId);
  const incomingNameScore = scoreGroupName(incomingName, incoming.chatId);
  const shouldUseIncomingName =
    incomingNameScore > currentNameScore ||
    (preferIncomingOnNameTie && incomingNameScore === currentNameScore);
  const selectedName = shouldUseIncomingName ? incomingName : currentName;

  return {
    ...current,
    name: selectedName || current.chatId,
    membersCount: Math.max(current.membersCount, incoming.membersCount),
    sendable: current.sendable && incoming.sendable,
    adminOnly: current.adminOnly || incoming.adminOnly,
    raw: incoming.raw,
    syncedAt: incoming.syncedAt
  };
};

const looksLikeGroup = (dto: EvolutionGroupDto, normalized: Group): boolean => {
  if (normalized.chatId.endsWith('@g.us')) {
    return true;
  }

  if (dto.isGroup === true) {
    return true;
  }

  if (typeof dto.subject === 'string' && dto.subject.trim().length > 0) {
    return true;
  }

  const metadata = asRecord(dto.groupMetadata ?? dto.metadata);
  if (metadata && (metadata.id || metadata.subject || metadata.participants)) {
    return true;
  }

  return false;
};

const toBooleanFlag = (value: unknown): boolean | null => {
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
  }
  return null;
};

const hasTruthyFlagByKeys = (sources: Record<string, unknown>[], keys: string[]): boolean => {
  for (const source of sources) {
    for (const key of keys) {
      if (toBooleanFlag(source[key]) === true) {
        return true;
      }
    }
  }
  return false;
};

const hasNonEmptyIdentifierByKeys = (sources: Record<string, unknown>[], keys: string[]): boolean => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (value === null || value === undefined) {
        continue;
      }

      const normalized = toStringSafe(value).trim();
      if (normalized.length > 0) {
        return true;
      }
    }
  }
  return false;
};

const hasSpecialRetentionMarker = (group: Group): boolean => {
  const raw = asRecord(group.raw) ?? {};
  const metadata = asRecord(raw.groupMetadata ?? raw.metadata) ?? {};
  const sources = [
    raw,
    metadata,
    asRecord(raw.groupInfo),
    asRecord(metadata.groupInfo),
    asRecord(raw.attrs),
    asRecord(metadata.attrs)
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  const archivedKeys = [
    'archived',
    'isArchived',
    'is_archived',
    'hidden',
    'isHidden',
    'is_hidden',
    'isHiddenChat'
  ];
  if (hasTruthyFlagByKeys(sources, archivedKeys)) {
    return true;
  }

  const announcementKeys = ['announce', 'isAnnounce', 'announcement', 'isAnnouncement'];
  if (hasTruthyFlagByKeys(sources, announcementKeys)) {
    return true;
  }

  const communityKeys = [
    'community',
    'isCommunity',
    'isCommunityGroup',
    'isCommunityAnnouncement',
    'isCommunityAnnounce',
    'isSubgroup',
    'isSubGroup',
    'isLinkedGroup',
    'isAnnouncementGroup'
  ];
  if (hasTruthyFlagByKeys(sources, communityKeys)) {
    return true;
  }

  const parentLinkKeys = [
    'parent',
    'parentGroupJid',
    'parentGroupId',
    'parentJid',
    'parentId',
    'linkedParent',
    'linkedParentJid',
    'linkedGroupJid',
    'communityJid',
    'communityId'
  ];
  return hasNonEmptyIdentifierByKeys(sources, parentLinkKeys);
};

const shouldRetainMissingGroup = (
  group: Group,
  nowMs: number,
  allowGenericRetention: boolean
): boolean => {
  if (!group.chatId.endsWith('@g.us')) {
    return false;
  }

  const syncedAtMs = Date.parse(group.syncedAt);
  if (!Number.isFinite(syncedAtMs)) {
    return false;
  }

  const ageMs = nowMs - syncedAtMs;
  if (ageMs < 0) {
    return false;
  }

  if (hasSpecialRetentionMarker(group)) {
    return ageMs <= MISSING_GROUP_RETENTION_WINDOW_MS;
  }

  return allowGenericRetention && ageMs <= GENERIC_MISSING_GROUP_RETENTION_WINDOW_MS;
};

type GroupFetchSource = 'fetchAllGroups' | 'findChats' | 'findContacts' | 'referenceFallback';
type RemoteGroupFetchSource = Exclude<GroupFetchSource, 'referenceFallback'>;
type SourceRequestVariant = 'primary' | 'fallback';

const groupSourcePriority: Record<GroupFetchSource, number> = {
  referenceFallback: 0,
  findContacts: 1,
  findChats: 2,
  fetchAllGroups: 3
};

const remoteGroupSources: RemoteGroupFetchSource[] = ['fetchAllGroups', 'findChats', 'findContacts'];

const isReferenceFallbackGroup = (group: Group): boolean => {
  const raw = asRecord(group.raw);
  return raw?.__fromReferenceFallback === true;
};

export class EvolutionProvider implements MessagingProvider {
  private readonly client: HttpClient;

  constructor(options: EvolutionProviderOptions) {
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeoutMs: 20_000
    });
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await this.client.request<Record<string, unknown>>({
        path: '/instance/fetchInstances'
      });
      return { ok: true, message: 'Connection established', details: res };
    } catch (error) {
      const appError = error instanceof AppError ? error : undefined;
      return {
        ok: false,
        message: appError?.message ?? 'Connection failed',
        details: appError
          ? {
              code: appError.code,
              status: appError.status,
              message: appError.message,
              details: appError.details
            }
          : undefined
      };
    }
  }

  async fetchInstances(): Promise<string[]> {
    const data = await this.client.request<EvolutionInstanceDto[] | Record<string, unknown>>({
      path: '/instance/fetchInstances'
    });

    if (Array.isArray(data)) {
      return data
        .map((entry) => extractInstanceName(entry))
        .filter((item): item is string => Boolean(item));
    }

    return [];
  }

  async fetchGroups(instanceName: string, options?: FetchGroupsOptions): Promise<Group[]> {
    const trimmedInstanceName = instanceName.trim();
    if (!trimmedInstanceName) {
      throw new AppError('INVALID_INSTANCE', 'Instance name is required');
    }
    const encodedInstanceName = encodeURIComponent(trimmedInstanceName);

    const requests: Array<{
      source: RemoteGroupFetchSource;
      variant: SourceRequestVariant;
      path: string;
      method?: 'GET' | 'POST';
      body?: unknown;
      timeoutMs?: number;
    }> = [
      {
        source: 'fetchAllGroups',
        variant: 'primary',
        path: `/group/fetchAllGroups/${encodedInstanceName}?getParticipants=false`,
        timeoutMs: 300_000
      },
      {
        source: 'fetchAllGroups',
        variant: 'fallback',
        path: `/group/fetchAllGroups/${encodedInstanceName}`,
        method: 'POST',
        body: { getParticipants: false },
        timeoutMs: 120_000
      },
      {
        source: 'findChats',
        variant: 'primary',
        path: `/chat/findChats/${encodedInstanceName}`,
        method: 'POST',
        body: {},
        timeoutMs: 45_000
      },
      {
        source: 'findChats',
        variant: 'fallback',
        path: `/chat/findChats/${encodedInstanceName}`,
        timeoutMs: 25_000
      },
      {
        source: 'findContacts',
        variant: 'primary',
        path: `/chat/findContacts/${encodedInstanceName}`,
        method: 'POST',
        body: {},
        timeoutMs: 45_000
      },
      {
        source: 'findContacts',
        variant: 'fallback',
        path: `/chat/findContacts/${encodedInstanceName}`,
        timeoutMs: 25_000
      }
    ];

    let lastError: unknown;
    let hadSuccessfulResponse = false;
    let hadRequestFailure = false;
    let hadRateLimitFailure = false;
    const responseHints: string[] = [];
    const diagnostics: string[] = [];
    const referencedGroupJids = new Set<string>();

    const groupsByChatId = new Map<string, Group>();
    const sourceByChatId = new Map<string, GroupFetchSource>();
    const reusablePermissionByChatId = new Map<string, boolean>();
    for (const previousGroup of options?.previousGroups ?? []) {
      if (!previousGroup.chatId.endsWith('@g.us')) {
        continue;
      }
      const hint = extractReusablePermissionHint(previousGroup);
      if (typeof hint === 'boolean') {
        reusablePermissionByChatId.set(previousGroup.chatId, hint);
      }
    }

    const mergeGroupBySource = (incomingGroup: Group, incomingSource: GroupFetchSource): void => {
      const existingGroup = groupsByChatId.get(incomingGroup.chatId);
      if (!existingGroup) {
        groupsByChatId.set(incomingGroup.chatId, incomingGroup);
        sourceByChatId.set(incomingGroup.chatId, incomingSource);
        return;
      }

      const existingSource = sourceByChatId.get(incomingGroup.chatId) ?? 'findChats';
      if (groupSourcePriority[incomingSource] >= groupSourcePriority[existingSource]) {
        groupsByChatId.set(
          incomingGroup.chatId,
          mergeGroupSnapshots(existingGroup, incomingGroup, true)
        );
        sourceByChatId.set(incomingGroup.chatId, incomingSource);
        return;
      }

      groupsByChatId.set(
        incomingGroup.chatId,
        mergeGroupSnapshots(incomingGroup, existingGroup, true)
      );
    };

    let totalFallbackAdded = 0;
    const addReferenceFallbackGroups = (passIndex: number): number => {
      let addedInPass = 0;

      for (const groupJid of referencedGroupJids) {
        if (groupsByChatId.has(groupJid)) {
          continue;
        }
        if (totalFallbackAdded >= REFERENCE_FALLBACK_GROUP_LIMIT) {
          break;
        }

        const fallbackGroup: Group = {
          id: groupJid,
          chatId: groupJid,
          name: groupJid,
          membersCount: 0,
          sendable: true,
          adminOnly: false,
          raw: {
            id: groupJid,
            __fromReferenceFallback: true
          },
          syncedAt: new Date().toISOString()
        };
        mergeGroupBySource(fallbackGroup, 'referenceFallback');
        totalFallbackAdded += 1;
        addedInPass += 1;
      }

      if (addedInPass > 0) {
        diagnostics.push(`pass=${passIndex} reference-fallback-added=${addedInPass}`);
      }

      return addedInPass;
    };

    const countReferenceFallbackGroups = (): number => {
      let count = 0;
      for (const group of groupsByChatId.values()) {
        if (isReferenceFallbackGroup(group)) {
          count += 1;
        }
      }
      return count;
    };

    const runSyncPass = async (
      passIndex: number,
      activeRequests: Array<{
        source: RemoteGroupFetchSource;
        variant: SourceRequestVariant;
        path: string;
        method?: 'GET' | 'POST';
        body?: unknown;
        timeoutMs?: number;
      }>
    ): Promise<{
      requestFailures: number;
      fallbackAdded: number;
      sourceAttempts: Map<RemoteGroupFetchSource, number>;
      sourceSuccesses: Map<RemoteGroupFetchSource, number>;
      sourceAccepted: Map<RemoteGroupFetchSource, number>;
    }> => {
      const sourceAttempts = new Map<RemoteGroupFetchSource, number>();
      const sourceSuccesses = new Map<RemoteGroupFetchSource, number>();
      const sourceAccepted = new Map<RemoteGroupFetchSource, number>();
      let hadAnyRequestError = false;
      const responses = await Promise.all(
        activeRequests.map(async (req) => {
          sourceAttempts.set(req.source, (sourceAttempts.get(req.source) ?? 0) + 1);
          try {
            const data = await this.client.request<unknown>({
              method: req.method,
              path: req.path,
              body: req.body,
              timeoutMs: req.timeoutMs
            });
            return { req, data };
          } catch (error) {
            return { req, error };
          }
        })
      );

      for (const result of responses) {
        if ('error' in result) {
          hadAnyRequestError = true;
          hadRequestFailure = true;
          if (isRateLimitError(result.error)) {
            hadRateLimitFailure = true;
          }
          lastError = result.error;
          const errorMessage =
            result.error instanceof Error ? result.error.message : 'request failed';
          diagnostics.push(
            `pass=${passIndex} ${result.req.method ?? 'GET'} ${result.req.path}: failed (${errorMessage})`
          );
          continue;
        }

        sourceSuccesses.set(result.req.source, (sourceSuccesses.get(result.req.source) ?? 0) + 1);
        hadSuccessfulResponse = true;
        responseHints.push(...collectResponseHints(result.data));
        for (const jid of collectGroupJidReferences(result.data)) {
          referencedGroupJids.add(jid);
        }

        const extracted = extractGroupList(result.data);
        const normalized = extracted
          .map((dto) => ({ dto, group: normalizeGroup(dto) }))
          .filter(({ group }) => group.chatId.length > 0);
        const accepted = normalized.filter(
          ({ dto, group }) => group.chatId.endsWith('@g.us') || looksLikeGroup(dto, group)
        );
        diagnostics.push(
          `pass=${passIndex} ${result.req.variant} ${result.req.method ?? 'GET'} ${result.req.path}: raw=${extracted.length}, valid=${normalized.length}, kept=${accepted.length}`
        );
        sourceAccepted.set(result.req.source, (sourceAccepted.get(result.req.source) ?? 0) + accepted.length);

        for (const { group } of accepted) {
          mergeGroupBySource(group, result.req.source);
        }
      }

      let requestFailures = 0;
      for (const [source, attempts] of sourceAttempts.entries()) {
        if (attempts <= 0) {
          continue;
        }
        const successes = sourceSuccesses.get(source) ?? 0;
        if (successes > 0) {
          diagnostics.push(`pass=${passIndex} source=${source}: success=${successes}/${attempts}`);
          continue;
        }
        requestFailures += 1;
        diagnostics.push(`pass=${passIndex} source=${source}: success=0/${attempts}`);
      }
      if (requestFailures > 0) {
        hadRequestFailure = true;
      }
      if (hadAnyRequestError && requestFailures === 0) {
        requestFailures = 1;
      }

      return {
        requestFailures,
        fallbackAdded: addReferenceFallbackGroups(passIndex),
        sourceAttempts,
        sourceSuccesses,
        sourceAccepted
      };
    };

    const primaryRequests = requests.filter((req) => req.variant === 'primary');
    const firstPass = await runSyncPass(1, primaryRequests);

    const unresolvedAfterFirstPass = countReferenceFallbackGroups();
    const sourcesNeedingFallback = new Set<RemoteGroupFetchSource>();

    for (const source of remoteGroupSources) {
      const attempts = firstPass.sourceAttempts.get(source) ?? 0;
      if (attempts === 0) {
        continue;
      }
      const successes = firstPass.sourceSuccesses.get(source) ?? 0;
      const accepted = firstPass.sourceAccepted.get(source) ?? 0;
      if (successes === 0 || accepted === 0) {
        sourcesNeedingFallback.add(source);
      }
    }

    if (unresolvedAfterFirstPass > 0) {
      sourcesNeedingFallback.add('fetchAllGroups');
    }

    const shouldRunSecondPass =
      GROUP_SYNC_MAX_PASSES >= 2 &&
      !hadRateLimitFailure &&
      sourcesNeedingFallback.size > 0;

    if (shouldRunSecondPass) {
      const fallbackRequests = requests.filter((req) => req.variant === 'fallback');
      if (fallbackRequests.length > 0) {
        await runSyncPass(2, fallbackRequests);
      }
    }

    const nowMs = Date.now();

    for (const previousGroup of options?.previousGroups ?? []) {
      if (groupsByChatId.has(previousGroup.chatId)) {
        continue;
      }
      if (hadRateLimitFailure) {
        groupsByChatId.set(previousGroup.chatId, previousGroup);
        continue;
      }
      if (!shouldRetainMissingGroup(previousGroup, nowMs, hadRequestFailure)) {
        continue;
      }
      groupsByChatId.set(previousGroup.chatId, previousGroup);
    }

    if (groupsByChatId.size > 0) {
      const unresolvedAdminOnlyGroups: Group[] = [];
      for (const group of groupsByChatId.values()) {
        if (!group.adminOnly) {
          continue;
        }
        const currentHint = resolveGroupPermissionHint(group);
        if (typeof currentHint === 'boolean') {
          continue;
        }
        const reusableHint = reusablePermissionByChatId.get(group.chatId);
        if (typeof reusableHint === 'boolean') {
          groupsByChatId.set(group.chatId, applyAdminPermissionHint(group, reusableHint));
          continue;
        }
        unresolvedAdminOnlyGroups.push(group);
      }

      if (
        unresolvedAdminOnlyGroups.length > 0 &&
        groupsByChatId.size <= ADMIN_PERMISSION_DEEP_CHECK_MAX_GROUPS
      ) {
        try {
          const [instancesData, detailsPayload] = await Promise.all([
            this.client.request<EvolutionInstanceDto[] | Record<string, unknown>>({
              path: '/instance/fetchInstances',
              timeoutMs: INSTANCE_LOOKUP_TIMEOUT_MS
            }),
            this.client.request<unknown>({
              path: `/group/fetchAllGroups/${encodedInstanceName}?getParticipants=true`,
              timeoutMs: ADMIN_PERMISSION_DEEP_CHECK_TIMEOUT_MS
            })
          ]);

          if (Array.isArray(instancesData)) {
            const selectedInstance = instancesData.find((entry) => {
              const name = extractInstanceName(entry).toLowerCase();
              return name.length > 0 && name === trimmedInstanceName.toLowerCase();
            });
            const selfIdentifiers = selectedInstance ? buildSelfIdentifiers(selectedInstance) : new Set<string>();

            if (selfIdentifiers.size > 0) {
              const detailedGroups = extractGroupList(detailsPayload);
              const adminPermissionByChatId = new Map<string, boolean | null>();

              for (const dto of detailedGroups) {
                const normalized = normalizeGroup(dto);
                if (!normalized.chatId) {
                  continue;
                }
                const selfAdminPermission = resolveSelfAdminPermission(dto, selfIdentifiers);
                adminPermissionByChatId.set(normalized.chatId, selfAdminPermission);
              }

              for (const group of unresolvedAdminOnlyGroups) {
                const hint = adminPermissionByChatId.get(group.chatId);
                groupsByChatId.set(group.chatId, applyAdminPermissionHint(group, hint ?? null));
              }
            }
          }
        } catch {
          // Best-effort enrichment: keep fallback "Chỉ admin (cần kiểm tra)" if participant-level check fails.
        }
      }

      return Array.from(groupsByChatId.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
      );
    }

    if (hadSuccessfulResponse) {
      if (hadRateLimitFailure) {
        throw new AppError(
          'FETCH_GROUPS_RATE_LIMITED',
          'Evo API đang bị giới hạn tốc độ (rate-overlimit). Vui lòng đợi 2-5 phút rồi đồng bộ lại.'
        );
      }

      const normalizedHints = Array.from(
        new Set(
          responseHints
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((item) => !/success|ok|200/i.test(item))
        )
      );

      if (normalizedHints.length > 0) {
        throw new AppError(
          'FETCH_GROUPS_EMPTY',
          `Không tải được danh sách nhóm: ${normalizedHints.slice(0, 2).join(' | ')}`
        );
      }

      throw new AppError(
        'FETCH_GROUPS_EMPTY',
        `Evo API phản hồi nhưng không có nhóm hợp lệ. ${diagnostics.slice(0, 3).join(' | ')}`
      );
    }

    if (hadRateLimitFailure) {
      throw new AppError(
        'FETCH_GROUPS_RATE_LIMITED',
        'Evo API đang bị giới hạn tốc độ (rate-overlimit). Vui lòng đợi 2-5 phút rồi đồng bộ lại.'
      );
    }

    throw lastError ?? new AppError('FETCH_GROUPS_FAILED', 'Failed to fetch groups');
  }

  async sendMediaToChat(
    instanceName: string,
    chatId: string,
    media: SendPayload
  ): Promise<SendResult> {
    if (!media.imagePath && !media.plainText) {
      throw new AppError('INVALID_PAYLOAD', 'Image or plain text is required');
    }

    if (media.imagePath) {
      const bytes = await readImageBytes(media.imagePath);
      const base64 = bytesToBase64(bytes);
      const body: EvolutionSendMediaRequest = {
        number: chatId,
        mediatype: 'image',
        media: base64,
        caption: media.caption
      };

      const result = await this.client.request<Record<string, unknown>>({
        method: 'POST',
        path: `/message/sendMedia/${instanceName}`,
        body
      });

      return {
        ok: true,
        providerMessageId: String(result?.key ?? ''),
        raw: result
      };
    }

    const textPayload: EvolutionSendTextRequest = {
      number: chatId,
      text: media.plainText ?? media.caption
    };

    const textResult = await this.client.request<Record<string, unknown>>({
      method: 'POST',
      path: `/message/sendText/${instanceName}`,
      body: textPayload
    });

    return {
      ok: true,
      providerMessageId: String(textResult?.key ?? ''),
      raw: textResult
    };
  }

  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    const data = await this.client.request<Record<string, unknown>>({
      path: `/instance/connectionState/${instanceName}`
    });

    const instance = asRecord(data.instance);
    const state = String(instance?.state ?? data.state ?? 'unknown');
    return {
      isConnected: state.toLowerCase().includes('open') || state.toLowerCase().includes('connected'),
      instanceName,
      state,
      raw: data
    };
  }
}

export { normalizeGroup };
