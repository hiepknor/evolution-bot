import type { Group } from '@/lib/types/domain';

export const mockGroups: Group[] = Array.from({ length: 48 }, (_, index) => ({
  id: `1203630${100000000 + index}@g.us`,
  chatId: `1203630${100000000 + index}@g.us`,
  name: `Demo Group ${index + 1}`,
  membersCount: 18 + (index % 23),
  sendable: true,
  adminOnly: index % 4 === 0,
  raw: { mock: true },
  syncedAt: new Date().toISOString()
}));
