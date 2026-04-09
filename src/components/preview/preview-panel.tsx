import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { inferImageMimeType, readImageBytes } from '@/lib/media/image-path';
import { composeFinalMessage } from '@/lib/templates/render-template';
import { useComposerStore } from '@/stores/use-composer-store';
import { useGroupsStore } from '@/stores/use-groups-store';

const formatChatId = (chatId: string): string => {
  if (chatId.length <= 28) {
    return chatId;
  }
  return `${chatId.slice(0, 12)}...${chatId.slice(-10)}`;
};

const compactChatId = (chatId: string): string => {
  if (chatId.length <= 22) {
    return chatId;
  }
  return `${chatId.slice(0, 8)}...${chatId.slice(-8)}`;
};

const buildPreviewRandomTag = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 900;
  }
  const value = 100 + hash;
  return `#${value}`;
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

        const sourceBlob = new Blob([toArrayBuffer(bytes)], { type: mime });
        const objectUrl = URL.createObjectURL(sourceBlob);
        revokedUrl = objectUrl;

        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewImageSrc(objectUrl);
        setImageLoadFailed(false);
        setImageLoadError(null);
      } catch (error) {
        if (active) {
          const errorMessage = error instanceof Error ? error.message : String(error ?? '');
          const normalizedMessage = errorMessage.toLowerCase();
          const permissionHint = normalizedMessage.includes('forbidden') || normalizedMessage.includes('scope');
          setPreviewImageSrc('');
          setImageLoadFailed(true);
          setImageLoadError(
            permissionHint
              ? 'Không thể đọc tệp ảnh do giới hạn quyền truy cập thư mục. Hãy khởi động lại app sau khi cập nhật quyền hoặc chọn ảnh trong thư mục khác.'
              : 'Không thể đọc tệp ảnh từ đường dẫn hiện tại. Hãy kiểm tra file còn tồn tại và quyền truy cập thư mục.'
          );
        }
      }
    };

    void buildPreview();

    return () => {
      active = false;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
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
  const selectedGroupLabel = selectedGroup
    ? `${selectedGroup.name} (${formatChatId(selectedGroup.chatId)})`
    : previewContextGroup
      ? `Chưa chọn nhóm (đang mô phỏng từ ${previewContextGroup.name})`
      : 'Chưa chọn nhóm (đang dùng preview giả lập)';
  const selectedGroupTitle = selectedGroup
    ? `${selectedGroup.name} (${selectedGroup.chatId})`
    : previewContextGroup
      ? `${selectedGroupLabel} • ${previewContextGroup.chatId}`
      : selectedGroupLabel;
  const selectedGroupCompactLine = selectedGroup
    ? `${selectedGroup.name} · ${compactChatId(selectedGroup.chatId)}`
    : previewContextGroup
      ? `Chưa chọn nhóm (mô phỏng: ${previewContextGroup.name} · ${compactChatId(previewContextGroup.chatId)})`
      : selectedGroupLabel;
  const embedded = mode === 'embedded';

  return (
    <Card className={cn('flex flex-col overflow-hidden', embedded ? '' : 'h-full min-h-0')}>
      <CardHeader className={panelTokens.cardHeader}>
        <CardTitle>Xem trước trực tiếp</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          `flex flex-col ${panelTokens.cardContent}`,
          embedded ? '' : 'min-h-0 flex-1 overflow-hidden'
        )}
      >
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3 text-sm leading-5 text-muted-foreground">
          <div className="truncate text-sm" title={selectedGroupTitle}>
            Nhóm: {selectedGroupCompactLine}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selectedGroup ? 'success' : 'warning'}>
              {selectedGroup ? 'Đã chọn nhóm' : 'Chưa chọn nhóm'}
            </Badge>
            <Badge variant={composer.imagePath ? 'success' : 'secondary'}>
              {composer.imagePath ? 'Có ảnh' : 'Không ảnh'}
            </Badge>
            <Badge variant={hasContent ? 'success' : 'warning'}>{`${charCount} ký tự`}</Badge>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-3',
            embedded
              ? 'grid-cols-1'
              : 'min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(220px,38%)_minmax(0,1fr)]'
          )}
        >
          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-md border border-border/55 bg-muted/10 p-3',
              embedded ? 'min-h-[240px]' : 'h-full min-h-0'
            )}
          >
            <div className={cn(panelTokens.sectionTitle, 'mb-2 text-muted-foreground')}>Ảnh xem trước</div>
            <div
              className={cn(
                'flex items-start justify-center overflow-hidden rounded-md bg-background/30 p-3',
                embedded ? 'min-h-[200px]' : 'min-h-0 flex-1'
              )}
            >
              {previewImageSrc && !imageLoadFailed ? (
                <img
                  src={previewImageSrc}
                  alt="Ảnh xem trước"
                  className="block h-auto w-auto shrink-0 max-h-full max-w-full object-contain"
                  onError={() => setImageLoadFailed(true)}
                  onLoad={() => setImageLoadFailed(false)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
                  <span>{composer.imagePath ? 'Không thể xem trước ảnh' : 'Chưa chọn ảnh'}</span>
                  {composer.imagePath ? (
                    <span className="mt-1 max-w-full truncate px-2 font-mono text-xs">
                      {composer.imagePath}
                    </span>
                  ) : null}
                  {composer.imagePath && imageLoadError ? (
                    <span className="mt-1 max-w-full px-2 text-center text-xs text-muted-foreground">
                      {imageLoadError}
                    </span>
                  ) : null}
                  {composer.imagePath ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 px-3 text-sm"
                      onClick={() => {
                        setImageLoadFailed(false);
                        setImageLoadError(null);
                        setPreviewReloadToken((prev) => prev + 1);
                      }}
                    >
                      Thử tải lại ảnh
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-md border border-border/55 bg-muted/10 p-3',
              embedded ? 'min-h-[240px]' : 'h-full min-h-0'
            )}
          >
            <div className={cn(panelTokens.sectionTitle, 'mb-2 text-muted-foreground')}>Tin nhắn mô phỏng</div>
            <div
              className={cn(
                'rounded-xl border border-border/45 bg-background/30 p-3',
                embedded ? 'min-h-[200px]' : 'min-h-0 flex-1 overflow-auto'
              )}
            >
              <div className="flex min-h-full flex-col justify-start">
                {hasContent ? (
                  <div className="w-full max-w-[min(100%,540px)] rounded-[20px] rounded-bl-md border border-primary/35 bg-accent/35 px-3.5 py-3 shadow-[0_10px_30px_-22px_hsl(var(--primary))]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold tracking-wide text-primary">
                        Preview Broadcast
                      </span>
                      <span className="text-sm text-muted-foreground">{charCount} ký tự</span>
                    </div>
                    <p className="whitespace-pre-line break-words text-sm leading-5 text-foreground">
                      {previewMessage}
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>Nội dung xem trước đang trống.</span>
                    <span>Hãy nhập mẫu nội dung hoặc chọn chiến dịch để dùng lại nội dung.</span>
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
