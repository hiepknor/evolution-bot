import { Inbox } from 'lucide-react';

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
      className={
        compact
          ? 'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/35 bg-background/30 px-4 py-8 text-center'
          : 'flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/35 bg-background/30 px-6 py-8 text-center'
      }
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground/50">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-medium text-foreground/80">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
