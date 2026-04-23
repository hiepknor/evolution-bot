import { useEffect, useState } from 'react';
import { Eye, ImageIcon, MessageCircle, RefreshCw, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { inferImageMimeType, readImageBytes } from '@/lib/media/image-path';
import { composeFinalMessage } from '@/lib/templates/render-template';
import { useComposerStore } from '@/stores/use-composer-store';
import { useGroupsStore } from '@/stores/use-groups-store';

const formatChatId = (chatId: string): string => {
  if (chatId.length <= 28) return chatId;
  return `${chatId.slice(0, 12)}...${chatId.slice(-10)}`;
};

const compactChatId = (chatId: string): string => {
  if (chatId.length <= 22) return chatId;
  return `${chatId.slice(0, 8)}...${chatId.slice(-8)}`;
};

const buildPreviewRandomTag = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 900;
  }
  return `#${100 + hash}`;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return copied.buffer;
};

interface PreviewPanelProps {
  mode?: 'standalone' | 'embedded';
}

export function PreviewPanel({ mode = 'standalone' }: PreviewPanelProps): JSX.Element {
  const composer = useComposerStore();
  const { groups, selectedIds } = useGroupsStore();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState('');
  const [previewReloadToken, setPreviewReloadToken] = useState(0);
  const selectedGroup = groups.find((group) => selectedIds.has(group.chatId));
  const previewContextGroup = selectedGroup ?? groups[0];
  const embedded = mode === 'embedded';

  useEffect(() => {
    setImageLoadFailed(false);
    setImageLoadError(null);
  }, [composer.imagePath]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let active = true;

    const buildPreview = async () => {
      if (!composer.imagePath) {
        setPreviewImageSrc('');
        setImageLoadError(null);
        return;
      }
      try {
        const bytes = await readImageBytes(composer.imagePath);
        const mime = inferImageMimeType(composer.imagePath);
        const objectUrl = URL.createObjectURL(new Blob([toArrayBuffer(bytes)], { type: mime }));
        revokedUrl = objectUrl;
        if (!active) { URL.revokeObjectURL(objectUrl); return; }
        setPreviewImageSrc(objectUrl);
        setImageLoadFailed(false);
        setImageLoadError(null);
      } catch (error) {
        if (active) {
          const msg = error instanceof Error ? error.message : String(error ?? '');
          const isPermission = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('scope');
          setPreviewImageSrc('');
          setImageLoadFailed(true);
          setImageLoadError(
            isPermission
              ? 'Không thể đọc tệp do giới hạn quyền thư mục. Khởi động lại app hoặc chọn ảnh ở thư mục khác.'
              : 'Không thể đọc tệp ảnh. Hãy kiểm tra file còn tồn tại và quyền truy cập.'
          );
        }
      }
    };

    void buildPreview();
    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [composer.imagePath, previewReloadToken]);

  const rendered = composeFinalMessage({
    introText: composer.introText,
    titleText: composer.titleText,
    captionTemplate: composer.captionTemplate,
    footerText: composer.footerText,
    context: {
      group_name: previewContextGroup?.name,
      members: previewContextGroup?.membersCount,
      index: 1,
      rand_tag: buildPreviewRandomTag(previewContextGroup?.chatId ?? 'preview')
    }
  });
  const previewMessage = (rendered || composer.plainTextFallback || '').trim();
  const hasContent = previewMessage.length > 0;
  const charCount = previewMessage.length;

  const selectedGroupTitle = selectedGroup
    ? `${selectedGroup.name} (${selectedGroup.chatId})`
    : previewContextGroup
      ? `${previewContextGroup.name} • ${previewContextGroup.chatId}`
      : 'Chưa chọn nhóm';
  const selectedGroupLine = selectedGroup
    ? `${selectedGroup.name} · ${compactChatId(selectedGroup.chatId)}`
    : previewContextGroup
      ? `Mô phỏng: ${previewContextGroup.name} · ${compactChatId(previewContextGroup.chatId)}`
      : 'Chưa chọn nhóm — đang dùng preview giả lập';

  return (
    <Card className={cn('flex flex-col overflow-hidden border-border/70 bg-card/70', embedded ? '' : 'h-full min-h-0')}>
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Eye className="h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-sm font-semibold leading-none text-foreground">
            Xem trước trực tiếp
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          'flex flex-col p-4 pt-3 space-y-3',
          embedded ? '' : 'min-h-0 flex-1 overflow-hidden'
        )}
      >
        {/* Context info */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/30 bg-muted/[0.06] px-3 py-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/40 text-muted-foreground">
            <Users className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-foreground"
              title={selectedGroupTitle}
            >
              {selectedGroupLine}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={selectedGroup ? 'success' : 'warning'}>
                {selectedGroup ? 'Đã chọn nhóm' : 'Chưa chọn nhóm'}
              </Badge>
              <Badge variant={composer.imagePath ? 'success' : 'secondary'}>
                {composer.imagePath ? 'Có ảnh' : 'Chưa có ảnh'}
              </Badge>
              <Badge variant={hasContent ? 'success' : 'warning'} className="tabular-nums">
                {charCount} ký tự
              </Badge>
            </div>
          </div>
        </div>

        {/* Image + Message grid */}
        <div
          className={cn(
            'grid gap-3',
            embedded
              ? 'grid-cols-1'
              : 'min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(220px,38%)_minmax(0,1fr)]'
          )}
        >
          {/* Image preview */}
          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-lg border border-border/30 bg-muted/[0.06] p-3',
              embedded ? 'min-h-[240px]' : 'h-full min-h-0'
            )}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/40 text-accent-foreground">
                <ImageIcon className="h-3 w-3" />
              </div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ảnh xem trước</p>
            </div>
            <div
              className={cn(
                'flex items-start justify-center overflow-hidden rounded-lg bg-background/30',
                embedded ? 'min-h-[200px] p-2' : 'min-h-0 flex-1 p-3'
              )}
            >
              {previewImageSrc && !imageLoadFailed ? (
                <img
                  src={previewImageSrc}
                  alt="Ảnh xem trước"
                  className="block h-auto max-h-full max-w-full shrink-0 object-contain"
                  onError={() => setImageLoadFailed(true)}
                  onLoad={() => setImageLoadFailed(false)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {composer.imagePath ? 'Không thể xem trước ảnh' : 'Chưa chọn ảnh'}
                  </p>
                  {composer.imagePath ? (
                    <p className="max-w-full truncate font-mono text-xs text-muted-foreground/70">
                      {composer.imagePath}
                    </p>
                  ) : null}
                  {composer.imagePath && imageLoadError ? (
                    <p className="max-w-full text-xs text-muted-foreground/70">{imageLoadError}</p>
                  ) : null}
                  {composer.imagePath ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`${panelTokens.control} gap-1.5 px-3`}
                      onClick={() => {
                        setImageLoadFailed(false);
                        setImageLoadError(null);
                        setPreviewReloadToken((prev) => prev + 1);
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Tải lại ảnh
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Message preview */}
          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-lg border border-border/30 bg-muted/[0.06] p-3',
              embedded ? 'min-h-[240px]' : 'h-full min-h-0'
            )}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
                <MessageCircle className="h-3 w-3" />
              </div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nội dung tin nhắn</p>
            </div>
            <div
              className={cn(
                'rounded-xl border border-border/40 bg-background/30 p-3',
                embedded ? 'min-h-[200px]' : 'min-h-0 flex-1 overflow-auto'
              )}
            >
              <div className="flex min-h-full flex-col justify-start">
                {hasContent ? (
                  <div className="w-full max-w-[min(100%,540px)] rounded-[18px] rounded-bl-md border border-primary/30 bg-accent/30 px-3.5 py-3 shadow-[0_8px_24px_-18px_hsl(var(--primary))]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                        Bản tin xem trước
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{charCount} ký tự</span>
                    </div>
                    <p className="whitespace-pre-line break-words text-sm leading-[1.6] text-foreground">
                      {previewMessage}
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1.5 text-center">
                    <p className="text-sm font-medium text-muted-foreground">Chưa có nội dung xem trước</p>
                    <p className="text-xs text-muted-foreground/70">
                      Nhập mẫu nội dung hoặc chọn chiến dịch để dùng lại.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
