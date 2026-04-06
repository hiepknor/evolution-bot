import { EvolutionProvider } from '@/lib/providers/evolution-provider';
import { MockProvider } from '@/lib/providers/mock-provider';
import type { MessagingProvider } from '@/lib/providers/messaging-provider';

export interface ProviderFactoryInput {
  mode: 'evolution' | 'mock';
  baseUrl: string;
  apiKey: string;
}

export const createProvider = (input: ProviderFactoryInput): MessagingProvider => {
  if (input.mode === 'mock') {
    return new MockProvider();
  }

  return new EvolutionProvider({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey
  });
};
