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
        { id: '456@g.us', subject: 'Group 2', participants: [{}, {}] }
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

  it('loads groups from fetchAllGroups by chat id', async () => {
    let fetchAllCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        fetchAllCalled = true;
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { jid: '111@g.us', subject: 'Group One', size: 10, announce: true, canSend: false },
              { id: '222@g.us', subject: 'Group Two', size: 22, archived: true }
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
        raw: { archived: true, parentGroupJid: '900@g.us', subject: 'Community Hidden' },
        syncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a', { previousGroups });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chatId).toBe('901@g.us');
    expect(groups[0]?.name).toBe('Community Hidden');
  });

  it('retains recently synced regular groups when fetchAllGroups fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
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
        raw: { subject: 'Recent Regular Group' },
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

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
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
        raw: { subject: 'Old Cached Group' },
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

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
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

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { jid: '401@g.us', subject: 'Regular Group', size: 21 },
              {
                id: '402@g.us',
                subject: 'Community Announcements',
                announce: true,
                isCommunityAnnouncement: true,
                canSend: false,
                size: 120
              },
              {
                id: '403@g.us',
                subject: 'Community Subgroup',
                parentGroupJid: '402@g.us',
                isSubgroup: true,
                size: 65
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

  it('only keeps @g.us groups from mixed fetchAllGroups payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { remoteJid: '450@g.us', subject: 'Hidden Community Subgroup', isGroup: true, size: 55 },
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
                size: 98,
                linkedGroups: ['501@g.us', '502@g.us']
              }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        if (url.includes('501%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '501@g.us', subject: 'Subgroup 501', size: 25 })
          } as Response;
        }
        if (url.includes('502%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '502@g.us', subject: 'Subgroup 502', size: 27 })
          } as Response;
        }
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
                size: 140,
                linkedGroupsText: 'children: 611@g.us, 612@g.us; legacy=613@g.us'
              }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        if (url.includes('611%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '611@g.us', subject: 'Child 611', size: 33 })
          } as Response;
        }
        if (url.includes('612%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '612@g.us', subject: 'Child 612', size: 35 })
          } as Response;
        }
        if (url.includes('613%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '613@g.us', subject: 'Child 613', size: 37 })
          } as Response;
        }
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

  it('hydrates subgroup metadata in one load flow without fallback pass', async () => {
    let fetchAllGetCalls = 0;
    let fetchAllPostCalls = 0;
    let findGroupInfosCalls = 0;
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
        return { ok: true, text: async () => JSON.stringify([]) } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCalls += 1;
        if (url.includes('701%40g.us')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                id: '701@g.us',
                subject: 'Community Subgroup 701',
                size: 19
              })
          } as Response;
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ id: '700@g.us', subject: 'Community Root', size: 20 })
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
    expect(fetchAllPostCalls).toBe(0);
    expect(findGroupInfosCalls).toBeGreaterThan(0);
    expect(groups.some((item) => item.chatId === '701@g.us')).toBe(true);
    expect(groups.find((item) => item.chatId === '701@g.us')?.name).toBe('Community Subgroup 701');
    expect(groups.find((item) => item.chatId === '701@g.us')?.membersCount).toBe(19);
  });

  it('only enriches groups missing subject via findGroupInfos', async () => {
    const findGroupInfosCalls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '800@g.us', subject: 'Group 800', size: 8 },
              { id: '801@g.us', name: '801', size: 0 }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCalls.push(url);
        if (url.includes('801%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '801@g.us', subject: 'Group 801', size: 21 })
          } as Response;
        }
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(findGroupInfosCalls.length).toBe(1);
    expect(findGroupInfosCalls[0]).toContain('801%40g.us');
    expect(groups.find((item) => item.chatId === '801@g.us')?.name).toBe('Group 801');
  });

  it('accepts non-identifier group name as resolved even when subject is missing', async () => {
    let findGroupInfosCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ id: '805@g.us', name: 'Rolex Dealer VN', size: 18 }])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCallCount += 1;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(findGroupInfosCallCount).toBe(0);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('Rolex Dealer VN');
    expect(groups[0]?.membersCount).toBe(18);
  });

  it('does not cache incomplete findGroupInfos payloads across retry attempts', async () => {
    let findGroupInfosCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ id: '820@g.us', name: '820' }])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCallCount += 1;
        if (findGroupInfosCallCount === 1) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '820@g.us', name: '820' })
          } as Response;
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ id: '820@g.us', subject: 'Group 820', size: 20 })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(findGroupInfosCallCount).toBeGreaterThanOrEqual(2);
    expect(groups.find((item) => item.chatId === '820@g.us')?.name).toBe('Group 820');
    expect(groups.find((item) => item.chatId === '820@g.us')?.membersCount).toBe(20);
  });

  it('recovers unresolved groups in delayed recovery rounds when initial enrich attempts fail', async () => {
    let findGroupInfosCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ id: '821@g.us', name: '821', size: 0 }])
        } as Response;
      }

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=true') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCallCount += 1;
        if (findGroupInfosCallCount <= 4) {
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ message: 'Internal error' })
          } as Response;
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ id: '821@g.us', subject: 'Group 821', size: 22 })
        } as Response;
      }

      if (url.includes('/instance/fetchInstances') || url.includes('/instance/connectionState/instance-a')) {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(findGroupInfosCallCount).toBeGreaterThan(4);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('Group 821');
    expect(groups[0]?.membersCount).toBe(22);
  });

  it('fails sync when one group cannot be fully enriched by findGroupInfos', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '810@g.us', name: '810' },
              { id: '811@g.us', name: '811' }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        if (url.includes('810%40g.us')) {
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ message: 'Internal error' })
          } as Response;
        }
        if (url.includes('811%40g.us')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ id: '811@g.us', subject: 'Recovered 811', size: 11 })
          } as Response;
        }
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    await expect(provider.fetchGroups('instance-a')).rejects.toMatchObject({
      code: 'FETCH_GROUPS_INCOMPLETE'
    });
  }, 30000);

  it('does not fail sync when admin-only permission remains unknown but name and members are resolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '812@g.us', subject: 'Admin Unknown 812', announce: true, size: 15 }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              id: '812@g.us',
              subject: 'Admin Unknown 812',
              announce: true,
              size: 15
            })
        } as Response;
      }

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=true') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      if (url.includes('/instance/fetchInstances') || url.includes('/instance/connectionState/instance-a')) {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');
    const group = groups.find((item) => item.chatId === '812@g.us');

    expect(group).toBeDefined();
    expect(group?.adminOnly).toBe(true);
    expect(group?.membersCount).toBe(15);
    expect(group?.name).toBe('Admin Unknown 812');
    expect(group?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBeUndefined();
  }, 30000);

  it('applies fallback names when only unresolved metadata is missing group subject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ id: '120363198683046088@g.us', name: '120363198683046088', size: 31 }])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ message: 'Not found' })
        } as Response;
      }

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=true') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      if (url.includes('/instance/fetchInstances') || url.includes('/instance/connectionState/instance-a')) {
        return {
          ok: true,
          text: async () => JSON.stringify([])
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');
    const group = groups.find((item) => item.chatId === '120363198683046088@g.us');

    expect(group).toBeDefined();
    expect(group?.membersCount).toBe(31);
    expect(group?.name).toContain('Nhóm chưa có tên');
    expect(group?.raw?.__nameFallback).toBe(true);
  }, 30000);

  it('dedupes findGroupInfos requests for the same group chat id in one sync batch', async () => {
    let findGroupInfosCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '900@g.us', name: '900' },
              { id: '900@g.us', name: '900 duplicate' }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        findGroupInfosCallCount += 1;
        return {
          ok: true,
          text: async () => JSON.stringify({ id: '900@g.us', subject: 'Hydrated 900', size: 9 })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(findGroupInfosCallCount).toBe(1);
    expect(groups.find((item) => item.chatId === '900@g.us')?.name).toBe('Hydrated 900');
  });

  it('merges subject from findGroupInfos into final output when initial payload only has id-like name', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ id: '950@g.us', name: '950', size: 0 }])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify({ id: '950@g.us', subject: 'Rolex VIP 950', size: 55 })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    const target = groups.find((item) => item.chatId === '950@g.us');
    expect(target?.name).toBe('Rolex VIP 950');
    expect(target?.membersCount).toBe(55);
  });

  it('hydrates members and send permission from findGroupInfos for admin-only groups', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: '960@g.us', subject: 'Admin Group 960', announce: true, size: 0 }
            ])
        } as Response;
      }

      if (url.includes('/group/findGroupInfos/instance-a?') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              id: '960@g.us',
              subject: 'Admin Group 960',
              size: 38,
              canSend: false
            })
        } as Response;
      }

      return {
        ok: true,
        text: async () => JSON.stringify([])
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    const target = groups.find((item) => item.chatId === '960@g.us');
    expect(target?.membersCount).toBe(38);
    expect(target?.sendable).toBe(false);
    expect(target?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBe(false);
  });

  it('does not retain stale cached hidden groups beyond retention window', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
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
        raw: { archived: true, hidden: true, subject: 'Old Hidden Group' },
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
                subject: 'Map Group 1',
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
              subject: 'Nested Id Group',
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

      if (url.includes('/group/fetchAllGroups/instance-a?getParticipants=false') && method === 'GET') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                id: 'chat-plain-id',
                key: { remoteJid: '888@g.us' },
                subject: 'Group via key.remoteJid',
                participants: [{}, {}, {}],
                size: 18
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
            JSON.stringify([{ jid: '999@g.us', name: '999', subject: 'Rolex Dealers VN', size: 64 }])
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
            metadata: { subject: 'AP PP ROLEX', participants: [{}, {}, {}] }
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
          { jid: '101@g.us', subject: 'Group 101', participantsCount: '123' },
          { jid: '102@g.us', subject: 'Group 102', metadata: { participantCount: '45' } },
          { jid: '103@g.us', subject: 'Group 103', participants: { '0': {}, '1': {}, '2': {} } }
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
          { jid: '201@g.us', subject: 'Group 201', size: 20, announce: 'false' },
          { jid: '202@g.us', subject: 'Group 202', size: 20, metadata: { announce: 'true', canSend: false } },
          { jid: '203@g.us', subject: 'Group 203', size: 20, onlyAdminsCanSend: 0 },
          { jid: '204@g.us', subject: 'Group 204', size: 20, metadata: { onlyAdminCanSend: 1, canSend: false } }
        ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups.find((item) => item.chatId === '201@g.us')?.adminOnly).toBe(false);
    expect(groups.find((item) => item.chatId === '202@g.us')?.adminOnly).toBe(true);
    expect(groups.find((item) => item.chatId === '203@g.us')?.adminOnly).toBe(false);
    expect(groups.find((item) => item.chatId === '204@g.us')?.adminOnly).toBe(true);
  });

  it('infers send permission from admin status fields on admin-only groups', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { jid: '205@g.us', subject: 'Group 205', size: 20, announce: true, isAdmin: true },
          { jid: '206@g.us', subject: 'Group 206', size: 20, announce: true, metadata: { role: 'member' } }
        ])
    } as Response);

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    const groups = await provider.fetchGroups('instance-a');

    expect(groups.find((item) => item.chatId === '205@g.us')?.sendable).toBe(true);
    expect(groups.find((item) => item.chatId === '205@g.us')?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBe(true);
    expect(groups.find((item) => item.chatId === '206@g.us')?.sendable).toBe(false);
    expect(groups.find((item) => item.chatId === '206@g.us')?.raw?.[GROUP_PERMISSION_HINT_KEY]).toBe(false);
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

  it('fails fast when groups_ignore is enabled in instance settings', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET').toUpperCase();

      if (url.includes('/settings/find/instance-a') && method === 'GET') {
        return {
          ok: true,
          text: async () => JSON.stringify({ groups_ignore: true })
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Not found' })
      } as Response;
    });

    const provider = new EvolutionProvider({ baseUrl: 'http://localhost:8080', apiKey: 'x' });
    await expect(provider.fetchGroups('instance-a')).rejects.toMatchObject({
      code: 'FETCH_GROUPS_DISABLED_BY_SETTINGS'
    });
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
