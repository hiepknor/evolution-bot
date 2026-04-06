import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { AppError } from '@/lib/utils/error';

export interface HttpClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpClient {
  private readonly baseUrls: string[];
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  private static hasTauriRuntime(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  }

  private static async requestFetch(input: string, init: RequestInit): Promise<Response> {
    if (HttpClient.hasTauriRuntime()) {
      return (await tauriFetch(input, init)) as Response;
    }
    return fetch(input, init);
  }

  constructor(options: HttpClientOptions) {
    this.baseUrls = HttpClient.resolveBaseUrls(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  private static resolveBaseUrls(rawBaseUrl: string): string[] {
    const trimmed = rawBaseUrl.trim();
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    const normalized = withProtocol.replace(/\/$/, '');
    let parsed: URL;

    try {
      parsed = new URL(normalized);
    } catch {
      return [normalized];
    }

    const candidates: string[] = [parsed.toString().replace(/\/$/, '')];
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol;

    // Packaged desktop builds may resolve localhost differently (IPv4/IPv6).
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      const withHost = (nextHost: string): string => {
        const url = new URL(parsed.toString());
        url.hostname = nextHost;
        return url.toString().replace(/\/$/, '');
      };

      // Keep deterministic order: localhost -> 127.0.0.1 -> [::1]
      if (host !== 'localhost') {
        candidates.push(withHost('localhost'));
      }
      if (host !== '127.0.0.1') {
        candidates.push(withHost('127.0.0.1'));
      }
      if (host !== '::1' && host !== '[::1]') {
        // URL normalizes IPv6 host into bracket notation automatically.
        candidates.push(withHost('::1'));
      }
    }

    if (protocol === 'http:' || protocol === 'https:') {
      return Array.from(new Set(candidates));
    }

    return [normalized];
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const baseUrls = this.baseUrls.length > 0 ? this.baseUrls : [''];
    const perAttemptTimeoutMs = Math.max(4_000, Math.floor(timeoutMs / baseUrls.length));
    const networkErrors: string[] = [];

    for (const baseUrl of baseUrls) {
      const abortController = new AbortController();
      const timer = setTimeout(() => abortController.abort(), perAttemptTimeoutMs);

      try {
        const response = await HttpClient.requestFetch(`${baseUrl}${options.path}`, {
          method: options.method ?? 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey
              ? {
                  apikey: this.apiKey,
                  Authorization: `Bearer ${this.apiKey}`
                }
              : {}),
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: abortController.signal
        });

        const text = await response.text();
        let data: unknown;
        if (text) {
          try {
            data = JSON.parse(text) as unknown;
          } catch {
            data = text;
          }
        }

        if (!response.ok) {
          throw new AppError(
            'HTTP_ERROR',
            `Request failed with ${response.status}`,
            response.status,
            data
          );
        }

        return data as T;
      } catch (error) {
        if (error instanceof AppError) {
          // API reached but returned non-2xx; no point trying another host alias.
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          networkErrors.push(`${baseUrl} (timeout ${perAttemptTimeoutMs}ms)`);
          continue;
        }

        const rawMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'unknown network error';

        if (/not allowed by acl|plugin:http\\|fetch/i.test(rawMessage)) {
          throw new AppError('HTTP_ACL', `HTTP permission denied: ${rawMessage}`);
        }

        const statusMatch = rawMessage.match(/\b([45]\d{2})\b/);
        if (statusMatch) {
          const statusCode = Number(statusMatch[1]);
          if (Number.isInteger(statusCode)) {
            throw new AppError('HTTP_ERROR', `Request failed with ${statusCode}`, statusCode);
          }
        }

        networkErrors.push(`${baseUrl} (${rawMessage})`);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AppError(
      'NETWORK_ERROR',
      `Cannot reach server. Tried: ${baseUrls.join(', ')}`,
      undefined,
      { attempts: networkErrors }
    );
  }
}
