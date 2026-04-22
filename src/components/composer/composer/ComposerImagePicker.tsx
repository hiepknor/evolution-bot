import type { ClipboardEvent, DragEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
import type { MediaMeta } from '@/components/composer/composer/hooks/use-composer-draft';

type RecentFileHealth = 'checking' | 'ready' | 'broken';

export function ComposerImagePicker({
  imagePath,
  imageName,
  recentFiles,
  removeRecentFiles,
  isMediaDropActive,
  setIsMediaDropActive,
  onDrop,
  onPaste,
  onPickImage,
  isOptimizingImage,
  mediaMeta,
  mediaPreviewSrc,
  mediaError,
  mediaOptimizationNote,
  brokenRecentFiles,
  recentFileHealth,
  onRecentFileSelect,
  onRequestRemoveImage,
  formatBytes,
  truncateMiddle
}: {
  imagePath?: string;
  imageName?: string;
  recentFiles: string[];
  removeRecentFiles: (paths: string[]) => void;
  isMediaDropActive: boolean;
  setIsMediaDropActive: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onPickImage: () => void;
  isOptimizingImage: boolean;
  mediaMeta: MediaMeta | null;
  mediaPreviewSrc: string;
  mediaError: string | null;
  mediaOptimizationNote: string | null;
  brokenRecentFiles: string[];
  recentFileHealth: Record<string, RecentFileHealth>;
  onRecentFileSelect: (path: string) => void;
  onRequestRemoveImage: () => void;
  formatBytes: (bytes: number) => string;
  truncateMiddle: (value: string, maxLength?: number) => string;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className={panelTokens.sectionTitle}>Media</h3>
      <div
        className={`space-y-2 rounded-lg border bg-muted/[0.08] p-3 transition-colors ${
          isMediaDropActive ? 'border-primary/55 bg-primary/5' : 'border-border/30'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isMediaDropActive) {
            setIsMediaDropActive(true);
          }
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          setIsMediaDropActive(false);
        }}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={`${panelTokens.control} px-3`}
            onClick={onPickImage}
            disabled={isOptimizingImage}
          >
            {isOptimizingImage ? 'Đang tối ưu...' : imagePath ? 'Thay ảnh' : 'Chọn ảnh'}
          </Button>
          <div className="relative min-w-0 flex-1 rounded-lg border border-border/40 bg-background/35 px-3 py-2 pr-11" title={imageName ?? ''}>
            {imageName ? (
              <p className="truncate font-mono text-sm text-foreground">{truncateMiddle(imageName, 52)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa chọn tệp ảnh</p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onRequestRemoveImage}
              disabled={!imagePath}
              title="Xóa ảnh"
              aria-label="Xóa ảnh"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p className="px-1 text-xs text-muted-foreground">Mẹo: kéo thả hoặc dán ảnh trực tiếp trong khung này.</p>

        <div className="space-y-1">
          <Label className={panelTokens.fieldLabel}>Tệp gần đây</Label>
          <Select onValueChange={onRecentFileSelect} disabled={isOptimizingImage}>
            <SelectTrigger className={panelTokens.control}>
              <SelectValue placeholder="Chọn tệp gần đây" />
            </SelectTrigger>
            <SelectContent>
              {recentFiles.length > 0 ? (
                recentFiles.map((file) => {
                  const health = recentFileHealth[file] ?? 'checking';
                  return (
                    <SelectItem key={file} value={file}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate">{file}</span>
                        <span
                          className={`shrink-0 text-xs ${
                            health === 'broken'
                              ? 'text-destructive'
                              : health === 'checking'
                                ? 'text-muted-foreground'
                                : 'text-success'
                          }`}
                        >
                          {health === 'broken' ? 'Lỗi' : health === 'checking' ? 'Đang kiểm tra' : 'Sẵn sàng'}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có tệp gần đây</div>
              )}
            </SelectContent>
          </Select>
          {brokenRecentFiles.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/35 bg-warning/10 p-2 text-sm text-warning">
              <span>Có {brokenRecentFiles.length} tệp lịch sử không còn truy cập được.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`${panelTokens.control} border-warning/40 px-3 text-warning hover:bg-warning/20`}
                onClick={() => removeRecentFiles(brokenRecentFiles)}
              >
                Gỡ tệp lỗi
              </Button>
            </div>
          ) : null}
        </div>
        {mediaOptimizationNote ? (
          <div className="rounded-lg border border-success/35 bg-success/10 p-2 text-sm text-success">{mediaOptimizationNote}</div>
        ) : null}
        {mediaError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{mediaError}</div>
        ) : null}
        {mediaMeta ? (
          <div className="rounded-lg bg-muted/[0.08] p-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatBytes(mediaMeta.sizeBytes)}</Badge>
                  {mediaMeta.width && mediaMeta.height ? (
                    <Badge variant="secondary">{`${mediaMeta.width} x ${mediaMeta.height}`}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Xem trước đầy đủ ở mục <strong>Xem trước trực tiếp</strong> bên dưới.</p>
              </div>
              {mediaPreviewSrc ? (
                <img src={mediaPreviewSrc} alt="Ảnh đã chọn" className="h-12 w-12 shrink-0 rounded border border-border/40 object-cover" />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/[0.08] p-2 text-sm text-muted-foreground">Chưa có tệp ảnh được chọn.</div>
        )}
      </div>
    </div>
  );
}
