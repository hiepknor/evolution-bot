import { z } from 'zod';
import type { ConnectionSettings } from '@/lib/types/domain';

export type ConnectionInput = Pick<
  ConnectionSettings,
  'baseUrl' | 'apiKey' | 'instanceName' | 'providerMode'
>;

const DEFAULT_MOCK_BASE_URL = 'http://localhost:8080';
const DEFAULT_MOCK_API_KEY = 'mock-key';
const DEFAULT_MOCK_INSTANCE = 'mock-instance';

const hasProtocol = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

export const normalizeBaseUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const withProtocol = hasProtocol(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/$/, '');
};

export const isValidHttpBaseUrl = (raw: string): boolean => {
  const normalized = normalizeBaseUrl(raw);
  if (!normalized) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const connectionSettingsSchema = z
  .object({
    baseUrl: z.string(),
    apiKey: z.string(),
    instanceName: z.string(),
    providerMode: z.enum(['evolution', 'mock'])
  })
  .superRefine((value, ctx) => {
    if (value.providerMode !== 'evolution') {
      return;
    }

    if (!value.baseUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: 'Base URL là bắt buộc'
      });
    } else if (!isValidHttpBaseUrl(value.baseUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: 'URL không hợp lệ (chỉ hỗ trợ http/https)'
      });
    }

    if (!value.apiKey.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiKey'],
        message: 'API key là bắt buộc'
      });
    }

    if (!value.instanceName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['instanceName'],
        message: 'Tên instance là bắt buộc'
      });
    }
  });

export type ConnectionFormValues = z.infer<typeof connectionSettingsSchema>;

export const normalizeConnectionInput = (
  values: ConnectionFormValues,
  fallback?: Partial<ConnectionInput>
): ConnectionInput => {
  const baseUrl = values.baseUrl.trim();
  const apiKey = values.apiKey.trim();
  const instanceName = values.instanceName.trim();

  if (values.providerMode === 'mock') {
    return {
      providerMode: 'mock',
      baseUrl: normalizeBaseUrl(baseUrl || fallback?.baseUrl || DEFAULT_MOCK_BASE_URL),
      apiKey: apiKey || fallback?.apiKey?.trim() || DEFAULT_MOCK_API_KEY,
      instanceName: instanceName || fallback?.instanceName?.trim() || DEFAULT_MOCK_INSTANCE
    };
  }

  return {
    providerMode: 'evolution',
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    instanceName
  };
};
