import type { ClipboardEvent, DragEvent } from 'react';
import { ImageIcon, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
        </div>
        <p className={panelTokens.sectionTitle}>Media</p>
      </div>

      {/* Drop zone */}
      <div
        className={`space-y-2.5 rounded-lg border p-3 transition-colors ${
          isMediaDropActive
            ? 'border-primary/55 bg-primary/[0.06]'
            : 'border-border/30 bg-muted/[0.08]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isMediaDropActive) setIsMediaDropActive(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setIsMediaDropActive(false);
        }}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        {/* Pick + filename row */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={`${panelTokens.control} shrink-0 px-3`}
            onClick={onPickImage}
            disabled={isOptimizingImage}
          >
            {isOptimizingImage ? 'Đang tối ưu...' : imagePath ? 'Thay ảnh' : 'Chọn ảnh'}
          </Button>
          <div
            className="relative min-w-0 flex-1 rounded-lg border border-border/40 bg-background/40 px-3 py-2 pr-10"
            title={imageName ?? ''}
          >
            {imageName ? (
              <p className="truncate font-mono text-sm text-foreground">
                {truncateMiddle(imageName, 52)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60">Chưa chọn tệp ảnh</p>
            )}
            <button
              type="button"
              className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              onClick={onRequestRemoveImage}
              disabled={!imagePath}
              title="Xóa ảnh"
              aria-label="Xóa ảnh"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Kéo thả hoặc dán ảnh trực tiếp vào đây.
        </p>

        {/* Recent files */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tệp gần đây</p>
          <Select onValueChange={onRecentFileSelect} disabled={isOptimizingImage}>
            <SelectTrigger className={`${panelTokens.control} border-border/40 bg-background/40`}>
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
                          {health === 'broken'
                            ? 'Lỗi'
                            : health === 'checking'
                              ? 'Kiểm tra...'
                              : 'Sẵn sàng'}
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2 text-sm text-warning">
              <span>{brokenRecentFiles.length} tệp không còn truy cập được.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-md border-warning/40 px-2.5 text-xs text-warning hover:bg-warning/15"
                onClick={() => removeRecentFiles(brokenRecentFiles)}
              >
                Gỡ tệp lỗi
              </Button>
            </div>
          ) : null}
        </div>

        {/* Status messages */}
        {mediaOptimizationNote ? (
          <div className="rounded-lg border border-success/30 bg-success/[0.08] px-3 py-2 text-sm text-success">
            {mediaOptimizationNote}
          </div>
        ) : null}
        {mediaError ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">
            {mediaError}
          </div>
        ) : null}

        {/* Media meta */}
        {mediaMeta ? (
          <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/[0.08] px-3 py-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {formatBytes(mediaMeta.sizeBytes)}
                </Badge>
                {mediaMeta.width && mediaMeta.height ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {mediaMeta.width} × {mediaMeta.height}
                  </Badge>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Xem trước đầy đủ ở mục{' '}
                <span className="font-medium text-foreground/70">Xem trước trực tiếp</span> bên dưới.
              </p>
            </div>
            {mediaPreviewSrc ? (
              <img
                src={mediaPreviewSrc}
                alt="Ảnh đã chọn"
                className="h-12 w-12 shrink-0 rounded-md border border-border/40 object-cover"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">Chưa có tệp ảnh được chọn.</p>
        )}
      </div>
    </div>
  );
}
