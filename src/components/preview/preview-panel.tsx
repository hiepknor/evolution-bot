import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export function PreviewPanel(): JSX.Element {
  const composer = useComposerStore();
  const { groups, selectedIds } = useGroupsStore();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState('');
  const [previewReloadToken, setPreviewReloadToken] = useState(0);
  const selectedGroup = groups.find((group) => selectedIds.has(group.chatId)) ?? groups[0];

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
      group_name: selectedGroup?.name,
      members: selectedGroup?.membersCount,
      index: 1,
      rand_tag: buildPreviewRandomTag(selectedGroup?.chatId ?? 'preview')
    }
  });
  const hasContent = Boolean(rendered.trim() || composer.plainTextFallback.trim());
  const charCount = (rendered || composer.plainTextFallback || '').trim().length;
  const selectedGroupLabel = selectedGroup
    ? `${selectedGroup.name} (${formatChatId(selectedGroup.chatId)})`
    : 'Chưa chọn nhóm (đang dùng preview giả lập)';
  const selectedGroupTitle = selectedGroup
    ? `${selectedGroup.name} (${selectedGroup.chatId})`
    : selectedGroupLabel;
  const selectedGroupCompactLine = selectedGroup
    ? `${selectedGroup.name} · ${compactChatId(selectedGroup.chatId)}`
    : selectedGroupLabel;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>Xem trước trực tiếp</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-2 text-xs text-muted-foreground">
          <div className="truncate" title={selectedGroupTitle}>
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

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(220px,38%)_minmax(0,1fr)]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/55 bg-muted/10 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Ảnh xem trước</div>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden rounded-md bg-background/30 p-2">
              {previewImageSrc && !imageLoadFailed ? (
                <img
                  src={previewImageSrc}
                  alt="Ảnh xem trước"
                  className="block h-auto w-auto shrink-0 max-h-full max-w-full object-contain"
                  onError={() => setImageLoadFailed(true)}
                  onLoad={() => setImageLoadFailed(false)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                  <span>{composer.imagePath ? 'Không thể xem trước ảnh' : 'Chưa chọn ảnh'}</span>
                  {composer.imagePath ? (
                    <span className="mt-1 max-w-full truncate px-2 font-mono text-xs">
                      {composer.imagePath}
                    </span>
                  ) : null}
                  {composer.imagePath && imageLoadError ? (
                    <span className="mt-1 max-w-full px-2 text-center text-[11px] text-muted-foreground">
                      {imageLoadError}
                    </span>
                  ) : null}
                  {composer.imagePath ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 px-2 text-xs"
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

          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/55 bg-muted/10 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Tin nhắn mô phỏng</div>
            <div className="min-h-0 flex-1 overflow-auto rounded-md bg-background/30 p-2">
              <div className="h-full">
                {hasContent ? (
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                    {rendered || composer.plainTextFallback}
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
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
