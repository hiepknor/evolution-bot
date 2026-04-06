import { describe, expect, it } from 'vitest';
import { normalizeGroup } from '@/lib/providers/evolution-provider';
import fixtures from '@/fixtures/evolution-groups.json';

describe('group normalization', () => {
  it('maps evolution dto to UI model', () => {
    const mapped = fixtures.map((entry) => normalizeGroup(entry));
    const first = mapped[0];
    const second = mapped[1];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.chatId).toBe('120363099999999@g.us');
    expect(first?.name).toBe('Sales Team');
    expect(first?.membersCount).toBe(24);
    expect(first?.sendable).toBe(true);

    expect(second?.name).toBe('Operations');
    expect(second?.membersCount).toBe(3);
  });
});
