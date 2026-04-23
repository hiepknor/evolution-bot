import { BookMarked, Braces } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';
import type { PlaceholderKey } from '@/lib/templates/render-template';

export function ComposerTemplateHelp({
  placeholders,
  onInsertPlaceholder,
  onOpenQuickContent
}: {
  placeholders: readonly PlaceholderKey[];
  onInsertPlaceholder: (key: PlaceholderKey) => void;
  onOpenQuickContent: () => void;
}): JSX.Element {
  return (
    <>
      {/* Quick content CTA */}
      <div className="flex items-center gap-3 rounded-lg border border-border/35 bg-muted/[0.06] px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookMarked className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Dòng mẫu nhanh</p>
          <p className="text-[11px] text-muted-foreground">
            Thêm, sửa, xoá và chọn nhiều dòng đưa vào mẫu nội dung.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className={`${panelTokens.control} shrink-0 px-3`}
          onClick={onOpenQuickContent}
        >
          Chọn nhanh
        </Button>
      </div>

      {/* Variable insertion */}
      <div className="rounded-lg border border-border/35 bg-muted/[0.06] px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/40 text-accent-foreground">
            <Braces className="h-3 w-3" />
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Chèn biến</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {placeholders.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onInsertPlaceholder(key)}
              className="inline-flex h-6 items-center rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/10 hover:border-primary/40"
            >
              {`{${key}}`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          <span className="font-mono text-muted-foreground">{`{rand_tag}`}</span>
          {' '}tự sinh số ngẫu nhiên dạng #100–#999 cho từng nhóm.
        </p>
      </div>
    </>
  );
}
