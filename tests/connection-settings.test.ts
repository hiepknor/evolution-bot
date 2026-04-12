import { describe, expect, it } from 'vitest';
import {
  connectionSettingsSchema,
  isValidHttpBaseUrl,
  normalizeBaseUrl,
  normalizeConnectionInput
} from '@/lib/connection/connection-settings';

describe('connection settings normalization', () => {
  it('normalizes base url by adding protocol and trimming slash', () => {
    expect(normalizeBaseUrl(' localhost:8080/ ')).toBe('http://localhost:8080');
    expect(normalizeBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
  });

  it('validates only http/https urls for evolution mode', () => {
    expect(isValidHttpBaseUrl('localhost:8080')).toBe(true);
    expect(isValidHttpBaseUrl('https://api.example.com')).toBe(true);
    expect(isValidHttpBaseUrl('ftp://api.example.com')).toBe(false);
  });

  it('fills safe defaults for mock mode when fields are blank', () => {
    const normalized = normalizeConnectionInput({
      providerMode: 'mock',
      baseUrl: ' ',
      apiKey: '',
      instanceName: ''
    });

    expect(normalized).toEqual({
      providerMode: 'mock',
      baseUrl: 'http://localhost:8080',
      apiKey: 'mock-key',
      instanceName: 'mock-instance'
    });
  });

  it('accepts evolution mode when normalized base url is valid', () => {
    const parsed = connectionSettingsSchema.safeParse({
      providerMode: 'evolution',
      baseUrl: 'localhost:8080',
      apiKey: 'key',
      instanceName: 'main'
    });

    expect(parsed.success).toBe(true);
  });
});
