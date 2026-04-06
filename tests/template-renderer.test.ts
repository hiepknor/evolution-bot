import { describe, expect, it } from 'vitest';
import { composeFinalMessage, renderTemplate } from '@/lib/templates/render-template';

describe('template renderer', () => {
  it('renders supported placeholders safely', () => {
    const result = renderTemplate('Hi {group_name} #{index} ({members}) {date} {rand_tag}', {
      group_name: 'Ops Group',
      index: 3,
      members: 70,
      date: '2026-04-05',
      rand_tag: '#321'
    });

    expect(result).toContain('Ops Group');
    expect(result).toContain('#3');
    expect(result).toContain('(70)');
    expect(result).toContain('2026-04-05');
    expect(result).toContain('#321');
  });

  it('composes final message from sections', () => {
    const text = composeFinalMessage({
      introText: 'Intro',
      titleText: 'Title',
      captionTemplate: 'Body for {group_name}',
      footerText: 'Footer',
      context: { group_name: 'Demo' }
    });

    expect(text).toBe('Intro\n\nTitle\n\nBody for Demo\n\nFooter');
  });
});
