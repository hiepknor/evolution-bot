import { BookMarked, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';

export function QuickContentEditor({
  itemsCount,
  createContent,
  setCreateContent,
  onCreate,
  onCreateInputKeyDown,
  saving,
  error
}: {
  itemsCount: number;
  createContent: string;
  setCreateContent: (value: string) => void;
  onCreate: () => void;
  onCreateInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  saving: boolean;
  error: string | null;
}): JSX.Element {
  return (
    <div className="space-y-2.5 xl:sticky xl:top-0">
      <section className={cn(panelTokens.section, 'gap-3')}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookMarked className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={panelTokens.sectionTitle}>Thêm dòng mẫu mới</p>
              <span className="rounded-full border border-border/35 bg-background/55 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {itemsCount} đã lưu
              </span>
            </div>
            <p className={cn(panelTokens.bodyText, 'mt-0.5')}>
              Dán một hoặc nhiều dòng để dùng lại trong mẫu nội dung.
            </p>
          </div>
        </div>

        <div className="relative">
          <Textarea
            rows={4}
            value={createContent}
            onChange={(event) => setCreateContent(event.target.value)}
            onKeyDown={onCreateInputKeyDown}
            placeholder="Nhập một hoặc nhiều dòng sẽ chèn vào mẫu nội dung..."
            className={cn(
              panelTokens.control,
              'min-h-[108px] rounded-lg border-border/40 bg-background/80 py-3 pr-14 leading-6 placeholder:text-foreground/40'
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-3 right-3 h-9 w-9 rounded-lg border border-border/35 bg-background/70 text-muted-foreground shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            onClick={onCreate}
            disabled={saving}
            aria-label="Thêm dòng mẫu"
            title="Thêm (Enter)"
          >
            {saving ? <span className="text-xs leading-none">…</span> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <p className={cn(panelTokens.metaText, 'leading-5')}>
          Dán nhiều dòng cùng lúc — hệ thống tự tách từng dòng và bỏ qua nội dung trùng lặp.
        </p>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/35 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
