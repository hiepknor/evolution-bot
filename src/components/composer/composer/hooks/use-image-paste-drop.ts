import { useCallback, useState, type ClipboardEvent, type DragEvent } from 'react';
import { BaseDirectory, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { toAppCacheImagePath } from '@/lib/media/image-path';

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

export const extractPathFromFile = (file: File): string | null => {
  const fileWithPath = file as File & { path?: string; fullPath?: string };
  const candidate = fileWithPath.path ?? fileWithPath.fullPath;
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  return candidate.trim() || null;
};

const extractImageFileFromList = (files: File[]): File | null =>
  files.find((file) => file.type.startsWith('image/')) ?? null;

export function useImagePasteDrop({
  isOptimizingImage,
  applySelectedImage,
  setMediaError
}: {
  isOptimizingImage: boolean;
  applySelectedImage: (path: string) => Promise<void>;
  setMediaError: (value: string | null) => void;
}) {
  const [isMediaDropActive, setIsMediaDropActive] = useState(false);

  const persistClipboardImage = useCallback(async (file: File): Promise<string> => {
    const ext = inferExtensionFromFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const relativePath = `${CLIPBOARD_MEDIA_DIR}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${ext}`;

    await mkdir(CLIPBOARD_MEDIA_DIR, { baseDir: BaseDirectory.AppCache, recursive: true });
    await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppCache });
    return toAppCacheImagePath(relativePath);
  }, []);

  const importImageFromFileObject = useCallback(async (file: File): Promise<void> => {
    const pathFromFile = extractPathFromFile(file);
    if (pathFromFile) {
      await applySelectedImage(pathFromFile);
      return;
    }

    const cachedPath = await persistClipboardImage(file);
    await applySelectedImage(cachedPath);
  }, [applySelectedImage, persistClipboardImage]);

  const handleMediaDrop = useCallback(async (event: DragEvent<HTMLDivElement>): Promise<void> => {
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
  }, [applySelectedImage, importImageFromFileObject, isOptimizingImage, setMediaError]);

  const handleMediaPaste = useCallback(async (event: ClipboardEvent<HTMLDivElement>): Promise<void> => {
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
  }, [importImageFromFileObject, isOptimizingImage, setMediaError]);

  return {
    isMediaDropActive,
    setIsMediaDropActive,
    handleMediaDrop,
    handleMediaPaste
  };
}
