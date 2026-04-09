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

  it('unions groups from fetchAllGroups and findChats by chat id', async () => {
    let fetchAllCalled = false;
    let findChatsCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        fetchAllCalled = true;
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ jid: '111@g.us', subject: 'Group One', size: 10, announce: true }])
        } as Response;
      }

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        findChatsCalled = true;
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '111@g.us', name: '111', archived: true },
              { id: '222@g.us', archived: true }
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

    expect(fetchAllCalled).toBe(true);
    expect(findChatsCalled).toBe(true);
    expect(groups).toHaveLength(2);
    expect(groups.find((item) => item.chatId === '111@g.us')?.membersCount).toBe(10);
    expect(groups.find((item) => item.chatId === '111@g.us')?.name).toBe('Group One');
    expect(groups.find((item) => item.chatId === '111@g.us')?.adminOnly).toBe(true);
    expect(groups.some((item) => item.chatId === '222@g.us')).toBe(true);
  });

  it('retains recently synced archived/community groups from cache when API response is partial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([])
    } as Response);

    const previousGroups: Group[] = [
      {
        id: '901@g.us',
        chatId: '901@g.us',
        name: 'Community Hidden',
        membersCount: 17,
        sendable: true,
        adminOnly: false,
        raw: { archived: true, parentGroupJid: '900@g.us' },
        syncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chatId).toBe('901@g.us');
    expect(groups[0]?.name).toBe('Community Hidden');
  });

  it('retains recently synced regular groups when at least one fetch endpoint fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ message: 'temporary error' })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const previousGroups: Group[] = [
      {
        id: '905@g.us',
        chatId: '905@g.us',
        name: 'Recent Regular Group',
        membersCount: 30,
        sendable: true,
        adminOnly: false,
        raw: {},
        syncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chatId).toBe('905@g.us');
  });

  it('retains stale cached groups when sync hits rate-overlimit errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        return {
          ok: false,
          status: 500,
          text: async () =>
            JSON.stringify({
              error: 'Internal Server Error',
              message: 'rate-overlimit',
              data: 429
            })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const previousGroups: Group[] = [
      {
        id: '915@g.us',
        chatId: '915@g.us',
        name: 'Old Cached Group',
        membersCount: 15,
        sendable: true,
        adminOnly: false,
        raw: {},
        syncedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups.some((item) => item.chatId === '915@g.us')).toBe(true);
  });

  it('throws rate-limited error when all requests are blocked by 429/overlimit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: 'rate-overlimit' })
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    await expect(provider.fetchGroups('instance-a')).rejects.toMatchObject({
      code: 'FETCH_GROUPS_RATE_LIMITED'
    });
  });

  it('does not retain regular cached groups when sync succeeds and returns live data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ jid: '907@g.us', subject: 'Live Group', size: 11 }])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const previousGroups: Group[] = [
      {
        id: '906@g.us',
        chatId: '906@g.us',
        name: 'Regular Group',
        membersCount: 9,
        sendable: true,
        adminOnly: false,
        raw: {},
        syncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups.some((item) => item.chatId === '907@g.us')).toBe(true);
    expect(groups.some((item) => item.chatId === '906@g.us')).toBe(false);
  });

  it('includes regular groups, community announcement groups, and community subgroups in one sync', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ jid: '401@g.us', subject: 'Regular Group', size: 21 }])
        } as Response;
      }

      if (url.includes('/chat/findChats/instance-a') && method === 'POST') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: '402@g.us',
                name: 'Community Announcements',
                announce: true,
                isCommunityAnnouncement: true
              },
              {
                id: '403@g.us',
                name: 'Community Subgroup',
                parentGroupJid: '402@g.us',
                isSubgroup: true
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
    const chatIds = new Set(groups.map((item) => item.chatId));

    expect(chatIds.has('401@g.us')).toBe(true);
    expect(chatIds.has('402@g.us')).toBe(true);
    expect(chatIds.has('403@g.us')).toBe(true);
    expect(groups.find((item) => item.chatId === '402@g.us')?.adminOnly).toBe(true);
  });

  it('includes group chats from findContacts when they are missing from findChats/fetchAllGroups', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findContacts/instance-a') && method === 'POST') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { remoteJid: '450@g.us', pushName: 'Hidden Community Subgroup' },
              { remoteJid: '84991234567@s.whatsapp.net', pushName: 'Regular Contact' }
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
    const chatIds = new Set(groups.map((item) => item.chatId));

    expect(chatIds.has('450@g.us')).toBe(true);
    expect(chatIds.has('84991234567@s.whatsapp.net')).toBe(false);
    expect(groups.find((item) => item.chatId === '450@g.us')?.name).toBe('Hidden Community Subgroup');
  });

  it('adds missing subgroup ids when community payload only exposes linked group references', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: '500@g.us',
                subject: 'Main Community',
                linkedGroups: ['501@g.us', '502@g.us']
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
    const chatIds = new Set(groups.map((item) => item.chatId));

    expect(chatIds.has('500@g.us')).toBe(true);
    expect(chatIds.has('501@g.us')).toBe(true);
    expect(chatIds.has('502@g.us')).toBe(true);
  });

  it('recognizes all @g.us ids from fetchAllGroups even when multiple ids are packed in one string', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: '610@g.us',
                subject: 'Community Root',
                linkedGroupsText: 'children: 611@g.us, 612@g.us; legacy=613@g.us'
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
    const chatIds = new Set(groups.map((item) => item.chatId));

    expect(chatIds.has('610@g.us')).toBe(true);
    expect(chatIds.has('611@g.us')).toBe(true);
    expect(chatIds.has('612@g.us')).toBe(true);
    expect(chatIds.has('613@g.us')).toBe(true);
  });

  it('runs a second pass to hydrate subgroup metadata after reference fallback', async () => {
    let fetchAllGetCalls = 0;
    let fetchAllPostCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        fetchAllGetCalls += 1;
        if (fetchAllGetCalls === 1) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify([
                {
                  id: '700@g.us',
                  subject: 'Community Root',
                  linkedGroups: ['701@g.us']
                }
              ])
          } as Response;
        }
      }

      if (url.includes('/group/fetchAllGroups/instance-a') && method === 'POST') {
        fetchAllPostCalls += 1;

        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: '700@g.us',
                subject: 'Community Root',
                linkedGroups: ['701@g.us']
              },
              {
                id: '701@g.us',
                subject: 'Community Subgroup 701',
                size: 19
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

    expect(fetchAllGetCalls).toBe(1);
    expect(fetchAllPostCalls).toBe(1);
    expect(groups.some((item) => item.chatId === '701@g.us')).toBe(true);
    expect(groups.find((item) => item.chatId === '701@g.us')?.name).toBe('Community Subgroup 701');
    expect(groups.find((item) => item.chatId === '701@g.us')?.membersCount).toBe(19);
  });

  it('does not retain stale cached hidden groups beyond retention window', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ jid: '311@g.us', subject: 'Live Group', size: 8 }])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const previousGroups: Group[] = [
      {
        id: '999@g.us',
        chatId: '999@g.us',
        name: 'Old Hidden Group',
        membersCount: 23,
        sendable: true,
        adminOnly: false,
        raw: { archived: true, hidden: true },
        syncedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups.some((item) => item.chatId === '311@g.us')).toBe(true);
    expect(groups.some((item) => item.chatId === '999@g.us')).toBe(false);
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

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
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

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
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

      if (url.includes('/chat/findChats/instance-a') && method === 'GET') {
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
