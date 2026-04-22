import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@/lib/templates/render-template';

describe('composer template placeholders', () => {
  it('renders required placeholders for campaign composer', () => {
    const template = 'Nhóm: {group_name} | STT: {index} | Thành viên: {members} | Ngày: {date}';
    const rendered = renderTemplate(template, {
      group_name: 'Chiến dịch A',
      index: 7,
      members: 321,
      date: '2026-04-22'
    });

    expect(rendered).toContain('Chiến dịch A');
    expect(rendered).toContain('7');
    expect(rendered).toContain('321');
    expect(rendered).toContain('2026-04-22');
  });

  it('uses stable empty value when group_name is missing', () => {
    const rendered = renderTemplate('Xin chào {group_name}', {});
    expect(rendered).toBe('Xin chào ');
  });

  it('supports unicode and html-like text in group_name', () => {
    const rendered = renderTemplate('Nhóm: {group_name}', {
      group_name: 'Nhóm 😎 Việt <b>Alpha</b>'
    });
    expect(rendered).toBe('Nhóm: Nhóm 😎 Việt <b>Alpha</b>');
  });

  it('replaces duplicated placeholder occurrences', () => {
    const rendered = renderTemplate('{group_name} - {group_name}', {
      group_name: 'A-Team'
    });
    expect(rendered).toBe('A-Team - A-Team');
  });

  it('keeps unknown placeholder unchanged', () => {
    const rendered = renderTemplate('Giữ nguyên {unknown} token', {
      group_name: 'ignored'
    });
    expect(rendered).toBe('Giữ nguyên {unknown} token');
  });

  it('renders zero and negative numeric placeholders', () => {
    const rendered = renderTemplate('i={index}, m={members}', {
      index: 0,
      members: -5
    });
    expect(rendered).toBe('i=0, m=-5');
  });

  it('falls back to empty numeric placeholders when values are missing', () => {
    const rendered = renderTemplate('i={index}|m={members}', {});
    expect(rendered).toBe('i=|m=');
  });
});
