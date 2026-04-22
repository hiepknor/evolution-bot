import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { optimizeImageForCampaign } from '@/lib/media/image-optimizer';
import { inferImageMimeType, readImageBytes } from '@/lib/media/image-path';
import { composeFinalMessage, lintTemplate, TEMPLATE_PLACEHOLDERS, type PlaceholderKey } from '@/lib/templates/render-template';
import { useImagePasteDrop } from '@/components/composer/composer/hooks/use-image-paste-drop';

export interface MediaMeta {
  sizeBytes: number;
  width?: number;
  height?: number;
}

type RecentFileHealth = 'checking' | 'ready' | 'broken';

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

export function useComposerDraft({
  composer
}: {
  composer: {
    imagePath?: string;
    imageName?: string;
    captionTemplate: string;
    introText: string;
    titleText: string;
    footerText: string;
    plainTextFallback: string;
    recentFiles: string[];
    contentSource: { campaignName: string; loadedAt: string } | null;
    setImage: (path?: string, options?: { displayName?: string; recentSourcePath?: string }) => void;
    setCaptionTemplate: (text: string) => void;
    setIntroText: (text: string) => void;
    setTitleText: (text: string) => void;
    setFooterText: (text: string) => void;
    setPlainTextFallback: (text: string) => void;
    clearContentSource: () => void;
    removeRecentFiles: (paths: string[]) => void;
    reset: () => void;
    clearDraft: () => void;
  };
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);
  const [mediaPreviewSrc, setMediaPreviewSrc] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [mediaOptimizationNote, setMediaOptimizationNote] = useState<string | null>(null);
  const [showAdvancedContent, setShowAdvancedContent] = useState(false);
  const [confirmRemoveImageOpen, setConfirmRemoveImageOpen] = useState(false);
  const [confirmClearDraftOpen, setConfirmClearDraftOpen] = useState(false);
  const [quickContentOpen, setQuickContentOpen] = useState(false);
  const [recentFileHealth, setRecentFileHealth] = useState<Record<string, RecentFileHealth>>({});

  const templateIssues = useMemo(() => lintTemplate(composer.captionTemplate), [composer.captionTemplate]);
  const lineCount = useMemo(() => Math.max(1, composer.captionTemplate.split('\n').length), [composer.captionTemplate]);
  const isCaptionEmpty = composer.captionTemplate.trim().length === 0;
  const isImageOnlyDraft = Boolean(composer.imagePath) && isCaptionEmpty;
  const hasTemplateEmptyWarning = templateIssues.some(
    (issue) => issue.level === 'warning' && issue.message.includes('đang trống')
  );
  const shownTemplateIssues = useMemo(
    () => (isImageOnlyDraft ? templateIssues.filter((issue) => !issue.message.includes('đang trống')) : templateIssues),
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
    [composer.captionTemplate, composer.footerText, composer.introText, composer.titleText]
  );

  const contentQualityWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!estimatedMessage) {
      return warnings;
    }

    if (estimatedMessage.length > 1500) {
      warnings.push('Nội dung ước tính khá dài (>1500 ký tự). Nên rút gọn để tăng tỷ lệ đọc.');
    }
    if (estimatedMessage.split('\n').some((line) => line.trim().length > 220)) {
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
            // noop
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

  const applySelectedImage = useCallback(async (path: string): Promise<void> => {
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
  }, [composer]);

  const pasteDrop = useImagePasteDrop({
    isOptimizingImage,
    applySelectedImage,
    setMediaError
  });

  const pickImage = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });

    if (typeof path === 'string') {
      await applySelectedImage(path);
    }
  }, [applySelectedImage]);

  const handleRecentFileSelect = useCallback(async (path: string): Promise<void> => {
    if (recentFileHealth[path] === 'broken') {
      setMediaError('Tệp trong lịch sử không còn truy cập được. Hãy gỡ mục lỗi và chọn tệp khác.');
      return;
    }
    await applySelectedImage(path);
  }, [applySelectedImage, recentFileHealth]);

  const insertPlaceholder = useCallback((key: PlaceholderKey) => {
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
  }, [composer]);

  const insertQuickContent = useCallback((content: string, mode: 'insert' | 'replace') => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    if (mode === 'replace') {
      composer.setCaptionTemplate(trimmedContent);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) {
          return;
        }
        const nextCursor = trimmedContent.length;
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    const el = textareaRef.current;
    const current = composer.captionTemplate;
    if (!el) {
      composer.setCaptionTemplate(current ? `${current}\n${trimmedContent}` : trimmedContent);
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n' : '';
    const next = `${before}${prefix}${trimmedContent}${suffix}${after}`;
    const nextCursor = (before + prefix + trimmedContent).length;

    composer.setCaptionTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composer]);

  return {
    TEMPLATE_PLACEHOLDERS,
    textareaRef,
    mediaMeta,
    mediaPreviewSrc,
    mediaError,
    setMediaError,
    isOptimizingImage,
    mediaOptimizationNote,
    setMediaOptimizationNote,
    showAdvancedContent,
    setShowAdvancedContent,
    confirmRemoveImageOpen,
    setConfirmRemoveImageOpen,
    confirmClearDraftOpen,
    setConfirmClearDraftOpen,
    quickContentOpen,
    setQuickContentOpen,
    recentFileHealth,
    templateIssues,
    lineCount,
    isImageOnlyDraft,
    hasTemplateEmptyWarning,
    shownTemplateIssues,
    canShowTemplateSuccess,
    hasAdvancedContent,
    contentQualityWarnings,
    brokenRecentFiles,
    pickImage,
    handleRecentFileSelect,
    insertPlaceholder,
    insertQuickContent,
    applySelectedImage,
    formatBytes,
    truncateMiddle,
    ...pasteDrop
  };
}
