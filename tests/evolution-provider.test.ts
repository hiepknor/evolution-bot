import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvolutionProvider } from '@/lib/providers/evolution-provider';
import { GROUP_PERMISSION_HINT_KEY } from '@/lib/groups/group-metadata';
import type { Group } from '@/lib/types/domain';

describe('evolution provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps groups from API payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        { jid: '123@g.us', subject: 'Group 1', size: 33 },
        { id: '456@g.us', name: 'Group 2', participants: [{}, {}] }
      ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');
    const first = groups[0];
    const second = groups[1];

    expect(groups).toHaveLength(2);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.chatId).toBe('123@g.us');
    expect(first?.membersCount).toBe(33);
    expect(second?.membersCount).toBe(2);
  });

  it('does not misclassify non-JSON 401 responses as network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const result = await provider.testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
    expect(result.message).not.toContain('Cannot reach server');
  });

  it('normalizes base URL without protocol to http:// for requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: '43.153.208.222:8080', apiKey: 'x' });
    await provider.testConnection();

    expect(fetchSpy).toHaveBeenCalled();
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0] ?? '')).toContain('http://43.153.208.222:8080/instance/fetchInstances');
  });

  it('uses prioritized group endpoint and avoids fallback chat downgrade', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ jid: '111@g.us', subject: 'Group One', size: 10, announce: true }])
        } as Response;
      }

      if (url.includes('/chat/findChats/instance-a')) {
        throw new Error('chat fallback should not run when primary group endpoint succeeds');
      }

      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Not found' })
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(1);
    expect(groups.find((item) => item.chatId === '111@g.us')?.membersCount).toBe(10);
    expect(groups.find((item) => item.chatId === '111@g.us')?.adminOnly).toBe(true);
  });

  it('extracts groups from object-map payload and metadata id fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            groups: {
              first: {
                name: 'Map Group 1',
                id: { _serialized: '333@g.us' },
                participants: [{}, {}, {}]
              },
              second: {
                metadata: {
                  id: { user: '444', server: 'g.us' },
                  subject: 'Map Group 2',
                  participants: [{}, {}]
                }
              }
            }
          }
        })
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(2);
    expect(groups.some((item) => item.chatId === '333@g.us')).toBe(true);
    expect(groups.some((item) => item.chatId === '444@g.us')).toBe(true);
  });

  it('does not miss nested groups when root object also has generic id field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 'request-123',
          data: {
            groups: [
              { jid: '555@g.us', subject: 'Nested Group', size: 4 },
              { jid: '666@g.us', subject: 'Nested Group 2', size: 6 }
            ]
          }
        })
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(2);
    expect(groups.some((item) => item.chatId === '555@g.us')).toBe(true);
    expect(groups.some((item) => item.chatId === '666@g.us')).toBe(true);
  });

  it('parses chat id from nested id object formats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          groups: [
            {
              name: 'Nested Id Group',
              id: { id: '777@g.us' },
              size: 9
            }
          ]
        })
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chatId).toBe('777@g.us');
  });

  it('prefers group jid from key.remoteJid instead of plain id fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'POST') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: 'chat-plain-id',
                key: { remoteJid: '888@g.us' },
                name: 'Group via key.remoteJid'
              }
            ])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chatId).toBe('888@g.us');
  });

  it('prefers better group name from available payload fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ jid: '999@g.us', name: '999', subject: 'Rolex Dealers VN' }])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('Rolex Dealers VN');
  });

  it('uses metadata subject as group name when root name is id-like', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            id: '1203123123@g.us',
            name: '1203123123',
            metadata: { subject: 'AP PP ROLEX' }
          }
        ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('AP PP ROLEX');
  });

  it('extracts members count from alternative fields and participant maps', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { jid: '101@g.us', participantsCount: '123' },
          { jid: '102@g.us', metadata: { participantCount: '45' } },
          { jid: '103@g.us', participants: { '0': {}, '1': {}, '2': {} } }
        ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups.find((item) => item.chatId === '101@g.us')?.membersCount).toBe(123);
    expect(groups.find((item) => item.chatId === '102@g.us')?.membersCount).toBe(45);
    expect(groups.find((item) => item.chatId === '103@g.us')?.membersCount).toBe(3);
  });

  it('parses admin-only flags from string and numeric payload values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { jid: '201@g.us', announce: 'false' },
          { jid: '202@g.us', metadata: { announce: 'true' } },
          { jid: '203@g.us', onlyAdminsCanSend: 0 },
          { jid: '204@g.us', metadata: { onlyAdminCanSend: 1 } }
        ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups.find((item) => item.chatId === '201@g.us')?.adminOnly).toBe(false);
    expect(groups.find((item) => item.chatId === '202@g.us')?.adminOnly).toBe(true);
    expect(groups.find((item) => item.chatId === '203@g.us')?.adminOnly).toBe(false);
    expect(groups.find((item) => item.chatId === '204@g.us')?.adminOnly).toBe(true);
  });

  it('enriches admin-only groups with participant admin check for current instance', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '301@g.us', subject: 'Need Admin', announce: true, size: 10 },
              { id: '302@g.us', subject: 'Open Group', announce: false, size: 12 }
            ])
        } as Response;
      }

      if (url.includes('/instance/fetchInstances')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                name: 'instance-a',
                ownerJid: '10001@s.whatsapp.net'
              }
            ])
        } as Response;
      }

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=true') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: '301@g.us',
                announce: true,
                participants: [{ phoneNumber: '10001@s.whatsapp.net', admin: null }]
              },
              {
                id: '302@g.us',
                announce: false,
                participants: [{ phoneNumber: '10001@s.whatsapp.net', admin: 'admin' }]
              }
            ])
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Not found' })
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    const adminOnlyGroup = groups.find((item) => item.chatId === '301@g.us');
    const openGroup = groups.find((item) => item.chatId === '302@g.us');

    expect(adminOnlyGroup?.adminOnly).toBe(true);
    expect(adminOnlyGroup?.sendable).toBe(false);
    expect(adminOnlyGroup?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBe(false);
    expect(openGroup?.sendable).toBe(true);
  });

  it('reuses cached permission hints to avoid deep admin check requests', async () => {
    let deepCheckCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ id: '301@g.us', subject: 'Need Admin', announce: true, size: 10 }])
        } as Response;
      }

      if (url.includes('/instance/fetchInstances') || url.includes('getParticipants=true')) {
        deepCheckCalls += 1;
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Not found' })
      } as Response;
    });

    const previousGroups: Group[] = [
      {
        id: '301@g.us',
        chatId: '301@g.us',
        name: 'Need Admin',
        membersCount: 10,
        sendable: false,
        adminOnly: true,
        raw: { [GROUP_PERMISSION_HINT_KEY]: false },
        syncedAt: new Date().toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(deepCheckCalls).toBe(0);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sendable).toBe(false);
    expect(groups[0]?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBe(false);
  });

  it('returns failed connection result on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthorized' })
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const result = await provider.testConnection();

    expect(result.ok).toBe(false);
  });
});
