import { panelTokens } from '@/components/layout/panel-tokens';

export function QuickContentEmptyState({
  title,
  description,
  compact = false
}: {
  title: string;
  description: string;
  compact?: boolean;
}): JSX.Element {
  return (
    <div
      className={`${compact ? 'rounded-lg border border-dashed border-border/40 bg-background/35 px-4 py-8 text-center' : 'flex min-h-[280px] h-full items-center justify-center rounded-lg border border-dashed border-border/40 bg-background/35 px-6 py-8 text-center'}`}
    >
      <div className="flex max-w-md flex-col items-center justify-center space-y-3">
        <p className={panelTokens.sectionTitle}>{title}</p>
        <p className={panelTokens.bodyText}>{description}</p>
      </div>
    </div>
  );
}
