import dayjs from 'dayjs';

export interface TemplateContext {
  group_name?: string;
  index?: number;
  members?: number;
  date?: string;
  rand_tag?: string;
}

export const TEMPLATE_PLACEHOLDERS = ['group_name', 'index', 'members', 'date', 'rand_tag'] as const;
export type PlaceholderKey = (typeof TEMPLATE_PLACEHOLDERS)[number];

export interface TemplateLintIssue {
  level: 'error' | 'warning';
  message: string;
}

const normalizeContext = (context: TemplateContext): Record<PlaceholderKey, string> => ({
  group_name: context.group_name ?? '',
  index: String(context.index ?? ''),
  members: String(context.members ?? ''),
  date: context.date ?? dayjs().format('YYYY-MM-DD'),
  rand_tag: context.rand_tag ?? ''
});

export const renderTemplate = (
  template: string,
  context: TemplateContext
): string => {
  const resolved = normalizeContext(context);
  return TEMPLATE_PLACEHOLDERS.reduce(
    (acc, key) => acc.replaceAll(`{${key}}`, resolved[key]),
    template
  );
};

export const lintTemplate = (template: string): TemplateLintIssue[] => {
  const issues: TemplateLintIssue[] = [];
  const trimmed = template.trim();

  if (!trimmed) {
    issues.push({
      level: 'warning',
      message: 'Mẫu nội dung đang trống.'
    });
  }

  if (template.length > 1500) {
    issues.push({
      level: 'warning',
      message: 'Mẫu nội dung khá dài (>1500 ký tự), nên kiểm tra lại để tránh gửi quá nặng.'
    });
  }

  const openCount = (template.match(/\{/g) ?? []).length;
  const closeCount = (template.match(/\}/g) ?? []).length;
  if (openCount !== closeCount) {
    issues.push({
      level: 'error',
      message: 'Dấu ngoặc nhọn không cân bằng. Hãy kiểm tra lại biến dạng {ten_bien}.'
    });
  }

  const tokenRegex = /\{([^{}]+)\}/g;
  const unknown = new Set<string>();
  for (const match of template.matchAll(tokenRegex)) {
    const token = match[1]?.trim();
    if (!token) {
      continue;
    }

    if (!TEMPLATE_PLACEHOLDERS.includes(token as PlaceholderKey)) {
      unknown.add(token);
    }
  }

  if (unknown.size > 0) {
    issues.push({
      level: 'error',
      message: `Biến không hỗ trợ: ${Array.from(unknown).join(', ')}`
    });
  }

  return issues;
};

export const composeFinalMessage = (args: {
  introText: string;
  titleText: string;
  captionTemplate: string;
  footerText: string;
  context: TemplateContext;
}): string => {
  const parts = [
    args.introText.trim(),
    args.titleText.trim(),
    renderTemplate(args.captionTemplate, args.context).trim(),
    args.footerText.trim()
  ].filter(Boolean);

  return parts.join('\n\n').trim();
};
