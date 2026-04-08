import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import dayjs from 'dayjs';
import { open } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
import { optimizeImageForCampaign } from '@/lib/media/image-optimizer';
import { inferImageMimeType, readImageBytes, toAppCacheImagePath } from '@/lib/media/image-path';
import { useComposerStore } from '@/stores/use-composer-store';
import {
  composeFinalMessage,
  lintTemplate,
  TEMPLATE_PLACEHOLDERS,
  type PlaceholderKey
} from '@/lib/templates/render-template';

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

type RecentFileHealth = 'checking' | 'ready' | 'broken';
const CLIPBOARD_MEDIA_DIR = 'clipboard-media';

const inferExtensionFromMime = (mime: string): string => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
};

const inferExtensionFromFile = (file: File): string => {
  const nameExt = file.name.split('.').pop()?.trim().toLowerCase();
  if (nameExt && ['png', 'jpg', 'jpeg', 'webp'].includes(nameExt)) {
    return nameExt === 'jpeg' ? 'jpg' : nameExt;
  }
  return inferExtensionFromMime(file.type);
};

const extractPathFromFile = (file: File): string | null => {
  const fileWithPath = file as File & { path?: string; fullPath?: string };
  const candidate = fileWithPath.path ?? fileWithPath.fullPath;
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  return candidate.trim() || null;
};

export function ComposerPanel(): JSX.Element {
  const composer = useComposerStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);
  const [mediaPreviewSrc, setMediaPreviewSrc] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [mediaOptimizationNote, setMediaOptimizationNote] = useState<string | null>(null);
  const [showAdvancedContent, setShowAdvancedContent] = useState(false);
  const [confirmRemoveImageOpen, setConfirmRemoveImageOpen] = useState(false);
  const [confirmClearDraftOpen, setConfirmClearDraftOpen] = useState(false);
  const [recentFileHealth, setRecentFileHealth] = useState<Record<string, RecentFileHealth>>({});
  const [isMediaDropActive, setIsMediaDropActive] = useState(false);
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
  const hasAdvancedContent = Boolean(
    composer.introText.trim() ||
      composer.titleText.trim() ||
      composer.footerText.trim() ||
      composer.plainTextFallback.trim()
  );
  const estimatedMessage = useMemo(
    () =>
      composeFinalMessage({
        introText: composer.introText,
        titleText: composer.titleText,
        captionTemplate: composer.captionTemplate,
        footerText: composer.footerText,
        context: {
          group_name: 'Nhóm mẫu',
          members: 256,
          index: 1,
          rand_tag: '#123'
        }
      }),
    [
      composer.captionTemplate,
      composer.footerText,
      composer.introText,
      composer.titleText
    ]
  );
  const contentQualityWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!estimatedMessage) {
      return warnings;
    }

    if (estimatedMessage.length > 1500) {
      warnings.push('Nội dung ước tính khá dài (>1500 ký tự). Nên rút gọn để tăng tỷ lệ đọc.');
    }

    const hasLongLine = estimatedMessage
      .split('\n')
      .some((line) => line.trim().length > 220);
    if (hasLongLine) {
      warnings.push('Có dòng quá dài (>220 ký tự). Nên tách dòng để nội dung dễ đọc hơn.');
    }

    if (/\n{3,}/.test(estimatedMessage)) {
      warnings.push('Có nhiều dòng trống liên tiếp. Nên chuẩn hoá lại bố cục đoạn văn.');
    }

    return warnings;
  }, [estimatedMessage]);
  const brokenRecentFiles = useMemo(
    () => composer.recentFiles.filter((file) => recentFileHealth[file] === 'broken'),
    [composer.recentFiles, recentFileHealth]
  );

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
            ? 'Không thể đọc tệp ảnh đã chọn. Hãy chọn tệp trong thư mục được cấp quyền hoặc khởi động lại app sau khi cập nhật quyền.'
            : errorMessage || 'Không thể đọc tệp ảnh đã chọn.'
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

  useEffect(() => {
    let cancelled = false;
    if (composer.recentFiles.length === 0) {
      setRecentFileHealth({});
      return;
    }

    setRecentFileHealth((prev) => {
      const next: Record<string, RecentFileHealth> = {};
      composer.recentFiles.forEach((file) => {
        next[file] = prev[file] ?? 'checking';
      });
      return next;
    });

    const checkRecentFiles = async () => {
      const healthChecks = await Promise.all(
        composer.recentFiles.map(async (file) => {
          try {
            await readImageBytes(file);
            return [file, 'ready'] as const;
          } catch {
            return [file, 'broken'] as const;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const healthMap = new Map<string, RecentFileHealth>(healthChecks);
      setRecentFileHealth((prev) => {
        const next: Record<string, RecentFileHealth> = {};
        composer.recentFiles.forEach((file) => {
          next[file] = healthMap.get(file) ?? prev[file] ?? 'checking';
        });
        return next;
      });
    };

    void checkRecentFiles();

    return () => {
      cancelled = true;
    };
  }, [composer.recentFiles]);

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
      setMediaError(message || 'Không thể xử lý tệp ảnh đã chọn.');
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

  const handleRecentFileSelect = async (path: string): Promise<void> => {
    if (recentFileHealth[path] === 'broken') {
      setMediaError('Tệp trong lịch sử không còn truy cập được. Hãy gỡ mục lỗi và chọn tệp khác.');
      return;
    }
    await applySelectedImage(path);
  };

  const persistClipboardImage = async (file: File): Promise<string> => {
    const ext = inferExtensionFromFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const relativePath = `${CLIPBOARD_MEDIA_DIR}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}.${ext}`;

    await mkdir(CLIPBOARD_MEDIA_DIR, {
      baseDir: BaseDirectory.AppCache,
      recursive: true
    });
    await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppCache });
    return toAppCacheImagePath(relativePath);
  };

  const importImageFromFileObject = async (file: File): Promise<void> => {
    const pathFromFile = extractPathFromFile(file);
    if (pathFromFile) {
      await applySelectedImage(pathFromFile);
      return;
    }

    const cachedPath = await persistClipboardImage(file);
    await applySelectedImage(cachedPath);
  };

  const extractImageFileFromList = (files: File[]): File | null =>
    files.find((file) => file.type.startsWith('image/')) ?? null;

  const handleMediaDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setIsMediaDropActive(false);

    if (isOptimizingImage) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    const imageFile = extractImageFileFromList(droppedFiles);
    if (imageFile) {
      try {
        await importImageFromFileObject(imageFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        setMediaError(message || 'Không thể nhập tệp ảnh từ thao tác kéo thả.');
      }
      return;
    }

    const uriListRaw = event.dataTransfer.getData('text/uri-list');
    const uriPath = uriListRaw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('file://'));

    if (uriPath) {
      try {
        await applySelectedImage(uriPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        setMediaError(message || 'Không thể nhập tệp ảnh từ URI kéo thả.');
      }
      return;
    }

    setMediaError('Không nhận diện được tệp ảnh từ thao tác kéo thả.');
  };

  const handleMediaPaste = async (event: ClipboardEvent<HTMLDivElement>): Promise<void> => {
    if (isOptimizingImage) {
      return;
    }

    const clipboardFiles = Array.from(event.clipboardData.files ?? []);
    const imageFile = extractImageFileFromList(clipboardFiles);
    if (!imageFile) {
      return;
    }

    event.preventDefault();

    try {
      await importImageFromFileObject(imageFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      setMediaError(message || 'Không thể nhập tệp ảnh từ clipboard.');
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
      <CardHeader className={panelTokens.cardHeader}>
        <CardTitle>Nội dung</CardTitle>
      </CardHeader>
      <CardContent className={panelTokens.cardContent}>
        {composer.contentSource ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/35 bg-primary/10 p-3 text-sm">
            <span className="text-primary-foreground/90">
              Đang chỉnh sửa từ: <strong>{composer.contentSource.campaignName}</strong> •{' '}
              {dayjs(composer.contentSource.loadedAt).format('HH:mm:ss')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 px-3 text-sm"
              onClick={() => composer.clearContentSource()}
            >
              Bỏ liên kết
            </Button>
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className={panelTokens.sectionTitle}>Media</h3>
          <div
            className={`space-y-2 rounded-md border bg-muted/10 p-3 transition-colors ${
              isMediaDropActive ? 'border-primary/55 bg-primary/5' : 'border-border/40'
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
            onDrop={(event) => {
              void handleMediaDrop(event);
            }}
            onPaste={(event) => {
              void handleMediaPaste(event);
            }}
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3"
                onClick={pickImage}
                disabled={isOptimizingImage}
              >
                {isOptimizingImage ? 'Đang tối ưu...' : composer.imagePath ? 'Thay ảnh' : 'Chọn ảnh'}
              </Button>
              <div
                className="relative min-w-0 flex-1 rounded-md border border-border/50 bg-background/35 px-3 py-2 pr-11"
                title={composer.imageName ?? ''}
              >
                {composer.imageName ? (
                  <p className="truncate font-mono text-sm text-foreground">{truncateMiddle(composer.imageName, 52)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa chọn tệp ảnh</p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmRemoveImageOpen(true)}
                  disabled={!composer.imagePath}
                  title="Xóa ảnh"
                  aria-label="Xóa ảnh"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              Mẹo: kéo thả hoặc dán ảnh trực tiếp trong khung này.
            </p>

            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Tệp gần đây</Label>
              <Select onValueChange={(value) => void handleRecentFileSelect(value)} disabled={isOptimizingImage}>
                <SelectTrigger className={panelTokens.control}>
                  <SelectValue placeholder="Chọn tệp gần đây" />
                </SelectTrigger>
                <SelectContent>
                  {composer.recentFiles.length > 0 ? (
                    composer.recentFiles.map((file) => {
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
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/35 bg-warning/10 p-2 text-sm text-warning">
                  <span>
                    Có {brokenRecentFiles.length} tệp lịch sử không còn truy cập được.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-warning/40 px-3 text-sm text-warning hover:bg-warning/20"
                    onClick={() => composer.removeRecentFiles(brokenRecentFiles)}
                  >
                    Gỡ tệp lỗi
                  </Button>
                </div>
              ) : null}
            </div>
            {mediaOptimizationNote ? (
              <div className="rounded-md border border-success/35 bg-success/10 p-2 text-sm text-success">
                {mediaOptimizationNote}
              </div>
            ) : null}
            {mediaError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                {mediaError}
              </div>
            ) : null}
            {mediaMeta ? (
              <div className="rounded-md bg-muted/10 p-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatBytes(mediaMeta.sizeBytes)}</Badge>
                      {mediaMeta.width && mediaMeta.height ? (
                        <Badge variant="secondary">{`${mediaMeta.width} x ${mediaMeta.height}`}</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Xem trước đầy đủ ở mục <strong>Xem trước trực tiếp</strong> bên dưới.
                    </p>
                  </div>
                  {mediaPreviewSrc ? (
                    <img
                      src={mediaPreviewSrc}
                      alt="Ảnh đã chọn"
                      className="h-12 w-12 shrink-0 rounded border border-border/40 object-cover"
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted/10 p-2 text-sm text-muted-foreground">
                Chưa có tệp ảnh được chọn.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className={panelTokens.sectionTitle}>Mẫu nội dung</h3>
          <div className="rounded-md border border-border/40 bg-muted/10 p-3">
            <div className="flex flex-wrap items-center gap-2 whitespace-normal">
              <span className="text-xs text-muted-foreground">Chèn biến:</span>
              {TEMPLATE_PLACEHOLDERS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 font-mono text-xs"
                  onClick={() => insertPlaceholder(key)}
                >
                  {`{${key}}`}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
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
                    className="h-8 px-2 font-mono text-xs"
                    onClick={() => insertPlaceholder('group_name')}
                  >
                    Chèn {`{group_name}`}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : canShowTemplateSuccess ? (
            <div className="rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success">
              Mẫu nội dung hợp lệ.
            </div>
          ) : null}

          {contentQualityWarnings.length > 0 ? (
            <div className="space-y-1.5 rounded-md border border-warning/35 bg-warning/10 p-2">
              <p className="text-sm font-medium text-warning">Cảnh báo chất lượng nội dung</p>
              {contentQualityWarnings.map((warning) => (
                <p key={warning} className="text-sm text-warning">
                  • {warning}
                </p>
              ))}
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border border-border/40 bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/35"
                onClick={() => setShowAdvancedContent((prev) => !prev)}
              >
                <span>Nội dung nâng cao</span>
                <span aria-hidden="true" className="pl-3 text-xs">
                  {showAdvancedContent ? '-' : '+'}
                </span>
              </button>
              <Badge variant={hasAdvancedContent ? 'success' : 'secondary'} className="shrink-0">
                {hasAdvancedContent ? 'Đang dùng' : 'Chưa dùng'}
              </Badge>
            </div>

            {showAdvancedContent ? (
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <Label className={panelTokens.fieldLabel}>Mở đầu (tuỳ chọn)</Label>
                  <Textarea
                    rows={2}
                    value={composer.introText}
                    onChange={(e) => composer.setIntroText(e.target.value)}
                    placeholder="Ví dụ: Xin chào anh/chị,"
                  />
                </div>
                <div className="space-y-1">
                  <Label className={panelTokens.fieldLabel}>Tiêu đề phụ (tuỳ chọn)</Label>
                  <Input
                    value={composer.titleText}
                    onChange={(e) => composer.setTitleText(e.target.value)}
                    placeholder="Ví dụ: Bảng giá mới nhất"
                    className={panelTokens.control}
                  />
                </div>
                <div className="space-y-1">
                  <Label className={panelTokens.fieldLabel}>Kết thúc (tuỳ chọn)</Label>
                  <Textarea
                    rows={2}
                    value={composer.footerText}
                    onChange={(e) => composer.setFooterText(e.target.value)}
                    placeholder="Ví dụ: Cần thêm thông tin, vui lòng phản hồi tin nhắn này."
                  />
                </div>
                <div className="space-y-1">
                  <Label className={panelTokens.fieldLabel}>Văn bản dự phòng (tuỳ chọn)</Label>
                  <Textarea
                    rows={2}
                    value={composer.plainTextFallback}
                    onChange={(e) => composer.setPlainTextFallback(e.target.value)}
                    placeholder="Dùng khi template chính không tạo ra nội dung."
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {hasAdvancedContent ? 'Đang có nội dung trong phần nâng cao.' : 'Chưa dùng phần nội dung nâng cao.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/10 p-3">
            <span className="text-sm text-muted-foreground">Bản nháp lưu tự động trên máy này.</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-3 text-sm"
                onClick={() => composer.reset()}
              >
                Khôi phục mặc định
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmClearDraftOpen(true)}
              >
                Xóa bản nháp đã lưu
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog open={confirmRemoveImageOpen} onOpenChange={setConfirmRemoveImageOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa ảnh hiện tại?</AlertDialogTitle>
              <AlertDialogDescription>
                Ảnh sẽ bị gỡ khỏi nội dung chiến dịch hiện tại. Danh sách tệp gần đây vẫn được giữ lại.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  composer.setImage(undefined);
                  setMediaOptimizationNote(null);
                }}
              >
                Xóa ảnh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmClearDraftOpen} onOpenChange={setConfirmClearDraftOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa bản nháp đã lưu?</AlertDialogTitle>
              <AlertDialogDescription>
                Chỉ xóa bản nháp trong bộ nhớ cục bộ. Nội dung đang hiển thị trên màn hình hiện tại không đổi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => composer.clearDraft()}
              >
                Xóa bản nháp
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
