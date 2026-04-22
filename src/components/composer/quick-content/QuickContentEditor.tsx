import { Plus } from 'lucide-react';
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
      <section className={cn(panelTokens.section, 'bg-muted/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/30 bg-background/60 text-muted-foreground">
            <Plus className="h-3.5 w-3.5" />
          </div>
          <div className="space-y-0.5">
            <p className={panelTokens.sectionTitle}>Thêm dòng mẫu mới</p>
            <p className={cn(panelTokens.bodyText, 'leading-6')}>Dán một hoặc nhiều dòng để dùng lại trong mẫu nội dung.</p>
            <p className={panelTokens.metaText}>{itemsCount} dòng mẫu đã lưu</p>
          </div>
        </div>
        <div className="relative">
          <Textarea
            rows={3}
            value={createContent}
            onChange={(event) => setCreateContent(event.target.value)}
            onKeyDown={onCreateInputKeyDown}
            placeholder="Nhập một hoặc nhiều dòng sẽ chèn vào mẫu nội dung..."
            className={cn(panelTokens.control, 'min-h-[96px] rounded-lg border-border/40 bg-background/80 py-3 pr-16 leading-6 placeholder:text-foreground/45')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-3 right-3 h-10 w-10 rounded-lg border border-border/35 bg-background/70 text-muted-foreground shadow-sm hover:bg-muted/70 hover:text-foreground"
            onClick={onCreate}
            disabled={saving}
            aria-label="Thêm dòng mẫu"
            title="Thêm dòng mẫu"
          >
            {saving ? <span className="text-sm leading-none">...</span> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <p className={cn(panelTokens.bodyText, 'leading-6')}>
          Dán nhiều dòng cùng lúc, hệ thống sẽ tự tách từng dòng mẫu và bỏ qua nội dung trùng lặp.
        </p>
      </section>

      <section className="rounded-lg border border-border/25 bg-background/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">Thêm nhanh vào thư viện</p>
          <span className={panelTokens.metaText}>Dùng khi chưa có dòng phù hợp ở cột bên phải.</span>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
