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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/[0.08] p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Chọn nhanh từ danh sách item</p>
          <p className="text-xs text-muted-foreground">
            Mở modal để thêm, sửa, xoá và chọn nhiều item đưa vào mẫu nội dung.
          </p>
        </div>
        <Button type="button" variant="outline" className={`${panelTokens.control} px-3`} onClick={onOpenQuickContent}>
          Chọn nhanh từ mẫu
        </Button>
      </div>
      <div className="rounded-lg border border-border/30 bg-muted/[0.08] p-3">
        <div className="flex flex-wrap items-center gap-2 whitespace-normal">
          <span className="text-xs text-muted-foreground">Chèn biến:</span>
          {placeholders.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 font-mono text-xs"
              onClick={() => onInsertPlaceholder(key)}
            >
              {`{${key}}`}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{`{rand_tag}`} tự sinh số ngẫu nhiên dạng #100-#999 cho từng nhóm.</p>
      </div>
    </>
  );
}
