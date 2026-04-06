import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { open } from '@tauri-apps/plugin-dialog';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { optimizeImageForCampaign } from '@/lib/media/image-optimizer';
import { inferImageMimeType, readImageBytes } from '@/lib/media/image-path';
import { useComposerStore } from '@/stores/use-composer-store';
import { lintTemplate, TEMPLATE_PLACEHOLDERS, type PlaceholderKey } from '@/lib/templates/render-template';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
const truncateMiddle = (value: string, maxLength = 36): string => {
  if (value.length <= maxLength) {
    return value;
  }
  const head = Math.ceil((maxLength - 3) / 2);
  const tail = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return copied.buffer;
};

interface MediaMeta {
  sizeBytes: number;
  width?: number;
  height?: number;
}

export function ComposerPanel(): JSX.Element {
  const composer = useComposerStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);
  const [mediaPreviewSrc, setMediaPreviewSrc] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [mediaOptimizationNote, setMediaOptimizationNote] = useState<string | null>(null);
  const templateIssues = useMemo(
    () => lintTemplate(composer.captionTemplate),
    [composer.captionTemplate]
  );
  const lineCount = useMemo(
    () => Math.max(1, composer.captionTemplate.split('\n').length),
    [composer.captionTemplate]
  );
  const isCaptionEmpty = composer.captionTemplate.trim().length === 0;
  const isImageOnlyDraft = Boolean(composer.imagePath) && isCaptionEmpty;
  const hasTemplateEmptyWarning = templateIssues.some(
    (issue) => issue.level === 'warning' && issue.message.includes('đang trống')
  );
  const shownTemplateIssues = useMemo(
    () =>
      isImageOnlyDraft
        ? templateIssues.filter((issue) => !issue.message.includes('đang trống'))
        : templateIssues,
    [isImageOnlyDraft, templateIssues]
  );
  const canShowTemplateSuccess = !isImageOnlyDraft && shownTemplateIssues.length === 0;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadMedia = async () => {
      if (!composer.imagePath) {
        setMediaMeta(null);
        setMediaPreviewSrc('');
        setMediaError(null);
        return;
      }

      try {
        const bytes = await readImageBytes(composer.imagePath);
        const mime = inferImageMimeType(composer.imagePath);
        const blob = new Blob([toArrayBuffer(bytes)], { type: mime });
        objectUrl = URL.createObjectURL(blob);

        const meta: MediaMeta = { sizeBytes: bytes.byteLength };
        if (typeof createImageBitmap === 'function') {
          try {
            const bitmap = await createImageBitmap(blob);
            meta.width = bitmap.width;
            meta.height = bitmap.height;
            bitmap.close();
          } catch {
            // Skip dimension metadata if bitmap cannot be parsed.
          }
        }

        if (!active) {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          return;
        }

        setMediaMeta(meta);
        setMediaPreviewSrc(objectUrl);
        setMediaError(null);
      } catch (error) {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        if (!active) {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error ?? '');
        const normalizedMessage = errorMessage.toLowerCase();
        const permissionHint = normalizedMessage.includes('forbidden') || normalizedMessage.includes('scope');
        setMediaMeta(null);
        setMediaPreviewSrc('');
        setMediaError(
          permissionHint
            ? 'Không thể đọc ảnh đã chọn. Hãy chọn ảnh trong thư mục được cấp quyền hoặc khởi động lại app sau khi cập nhật quyền.'
            : errorMessage || 'Không thể đọc ảnh đã chọn.'
        );
      }
    };

    void loadMedia();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [composer.imagePath]);

  const applySelectedImage = async (path: string): Promise<void> => {
    setIsOptimizingImage(true);
    setMediaError(null);
    try {
      const optimized = await optimizeImageForCampaign(path);
      composer.setImage(optimized.optimizedPath, {
        displayName: optimized.displayName,
        recentSourcePath: optimized.sourcePath
      });

      if (optimized.optimized) {
        setMediaOptimizationNote(
          `Đã tối ưu ảnh: ${formatBytes(optimized.originalBytes)} → ${formatBytes(optimized.optimizedBytes)} (${optimized.originalWidth}x${optimized.originalHeight} → ${optimized.optimizedWidth}x${optimized.optimizedHeight}).`
        );
      } else {
        setMediaOptimizationNote('Ảnh đã tối ưu sẵn, giữ nguyên để bảo toàn chất lượng.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      setMediaOptimizationNote(null);
      setMediaError(message || 'Không thể xử lý ảnh đã chọn.');
    } finally {
      setIsOptimizingImage(false);
    }
  };

  const pickImage = async () => {
    const path = await open({
      multiple: false,
      filters: [
        { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ]
    });

    if (typeof path === 'string') {
      await applySelectedImage(path);
    }
  };

  const insertPlaceholder = (key: PlaceholderKey) => {
    const token = `{${key}}`;
    const el = textareaRef.current;
    const current = composer.captionTemplate;
    if (!el) {
      composer.setCaptionTemplate(current ? `${current} ${token}` : token);
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    composer.setCaptionTemplate(next);

    const nextCursor = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Nội dung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {composer.contentSource ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/35 bg-primary/10 p-2 text-xs">
            <span className="text-primary-foreground/90">
              Đang chỉnh sửa từ: <strong>{composer.contentSource.campaignName}</strong> •{' '}
              {dayjs(composer.contentSource.loadedAt).format('HH:mm:ss')}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => composer.clearContentSource()}>
              Bỏ liên kết
            </Button>
          </div>
        ) : null}
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Media</h3>
          <div className="space-y-2 rounded-md border border-border/50 bg-muted/10 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-w-[120px]"
                onClick={pickImage}
                disabled={isOptimizingImage}
              >
                {isOptimizingImage ? 'Đang tối ưu...' : composer.imagePath ? 'Thay ảnh' : 'Chọn ảnh'}
              </Button>
              <Input
                value={composer.imageName ? truncateMiddle(composer.imageName) : ''}
                readOnly
                placeholder="Chưa chọn ảnh"
                title={composer.imageName ?? ''}
                className="min-w-[200px] flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (window.confirm('Xóa ảnh hiện tại khỏi chiến dịch này?')) {
                    composer.setImage(undefined);
                    setMediaOptimizationNote(null);
                  }
                }}
                disabled={!composer.imagePath}
                title="Xóa ảnh"
                aria-label="Xóa ảnh"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Tệp gần đây</Label>
              <Select onValueChange={(value) => void applySelectedImage(value)} disabled={isOptimizingImage}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn từ lịch sử" />
                </SelectTrigger>
                <SelectContent>
                  {composer.recentFiles.length > 0 ? (
                    composer.recentFiles.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có tệp gần đây</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            {mediaOptimizationNote ? (
              <div className="rounded-md border border-success/35 bg-success/10 px-2 py-1.5 text-xs text-success">
                {mediaOptimizationNote}
              </div>
            ) : null}
            {mediaError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {mediaError}
              </div>
            ) : null}
            {mediaMeta ? (
              <div className="space-y-2 rounded-md border border-border/40 bg-muted/5 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatBytes(mediaMeta.sizeBytes)}</Badge>
                  {mediaMeta.width && mediaMeta.height ? (
                    <Badge variant="secondary">{`${mediaMeta.width} x ${mediaMeta.height}`}</Badge>
                  ) : null}
                </div>
                {mediaPreviewSrc ? (
                  <img
                    src={mediaPreviewSrc}
                    alt="Ảnh đã chọn"
                    className="h-24 w-auto max-w-full rounded-md border border-border/40 object-contain"
                  />
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-border/30 bg-muted/5 px-2 py-1.5 text-xs text-muted-foreground">
                Chưa có ảnh được chọn.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <h3 className="text-base font-semibold text-foreground">Mẫu nội dung</h3>
          <div className="rounded-md border border-border/50 bg-muted/10 p-2">
            <div className="flex flex-wrap items-center gap-2 whitespace-normal">
              <span className="text-xs text-muted-foreground">Chèn biến:</span>
              {TEMPLATE_PLACEHOLDERS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 font-mono text-xs"
                  onClick={() => insertPlaceholder(key)}
                >
                  {`{${key}}`}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {`{rand_tag}`} tự sinh số ngẫu nhiên dạng #100-#999 cho từng nhóm.
            </p>
          </div>
          <Textarea
            ref={textareaRef}
            rows={6}
            value={composer.captionTemplate}
            onChange={(e) => composer.setCaptionTemplate(e.target.value)}
            placeholder="Dùng biến: {group_name}, {index}, {members}, {date}, {rand_tag}"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{composer.captionTemplate.length} ký tự</span>
            <span>{lineCount} dòng</span>
          </div>
          {isImageOnlyDraft ? (
            <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <Badge variant="secondary">Thông tin</Badge>
                <p className="pt-0.5 text-xs text-muted-foreground">
                  Bạn đang để trống nội dung chữ. Bản tin hiện sẽ gửi ảnh là chính.
                </p>
              </div>
            </div>
          ) : null}
          {shownTemplateIssues.length > 0 ? (
            <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2">
              {shownTemplateIssues.map((issue, index) => (
                <div key={`${issue.level}-${index}`} className="flex items-start gap-2">
                  <Badge variant={issue.level === 'error' ? 'destructive' : 'warning'}>
                    {issue.level === 'error' ? 'Lỗi' : 'Cảnh báo'}
                  </Badge>
                  <p className="pt-0.5 text-xs text-muted-foreground">{issue.message}</p>
                </div>
              ))}
              {hasTemplateEmptyWarning ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Gợi ý: chèn biến đầu tiên để bắt đầu nhanh.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 font-mono text-xs"
                    onClick={() => insertPlaceholder('group_name')}
                  >
                    Chèn {`{group_name}`}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : canShowTemplateSuccess ? (
            <div className="rounded-md border border-success/30 bg-success/10 px-2 py-1.5 text-xs text-success">
              Mẫu nội dung hợp lệ.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 p-2">
            <span className="text-xs text-muted-foreground">Bản nháp lưu tự động trên máy này.</span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => composer.reset()}>
                Khôi phục mặc định
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm('Xóa bản nháp đã lưu khỏi máy này?')) {
                    composer.clearDraft();
                  }
                }}
              >
                Xóa bản nháp đã lưu
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
