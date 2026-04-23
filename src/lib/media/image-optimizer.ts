import { BaseDirectory, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import {
  inferImageMimeType,
  normalizeImagePath,
  readImageBytes,
  toAppDataImagePath
} from '@/lib/media/image-path';

const OPTIMIZED_MEDIA_DIR = 'optimized-media';
const MAX_LONG_EDGE_PX = 1080;

const hashBytes = (bytes: Uint8Array): string => {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i] ?? 0;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const copyToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return copied.buffer;
};

const mimeToExtension = (mime: string): string => {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
};

const outputMimeFromInput = (inputMime: string): string => {
  if (inputMime === 'image/png') {
    return 'image/png';
  }
  if (inputMime === 'image/webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Không thể tạo ảnh sau khi tối ưu.'));
      },
      mime,
      quality
    );
  });

const loadImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể đọc dữ liệu ảnh.'));
    };
    image.src = objectUrl;
  });

export interface OptimizedImageResult {
  sourcePath: string;
  optimizedPath: string;
  displayName: string;
  originalBytes: number;
  optimizedBytes: number;
  originalWidth: number;
  originalHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
  optimized: boolean;
}

export const optimizeImageForCampaign = async (inputPath: string): Promise<OptimizedImageResult> => {
  const sourcePath = normalizeImagePath(inputPath);
  if (!sourcePath) {
    throw new Error('Đường dẫn ảnh không hợp lệ.');
  }

  const sourceBytes = await readImageBytes(sourcePath);
  const sourceMime = inferImageMimeType(sourcePath);
  const sourceBlob = new Blob([copyToArrayBuffer(sourceBytes)], { type: sourceMime });
  const sourceImage = await loadImageFromBlob(sourceBlob);
  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Không thể lấy kích thước ảnh gốc.');
  }

  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = longestSide > MAX_LONG_EDGE_PX ? MAX_LONG_EDGE_PX / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const displayName = sourcePath.split(/[\\/]/).pop() ?? 'image';
  const sourceExt = mimeToExtension(sourceMime);
  const sourceChecksum = hashBytes(sourceBytes);
  const sourceRelativePath = `${OPTIMIZED_MEDIA_DIR}/${sourceChecksum}-${sourceWidth}x${sourceHeight}.${sourceExt}`;
  const sourceAppDataPath = toAppDataImagePath(sourceRelativePath);

  await mkdir(OPTIMIZED_MEDIA_DIR, {
    baseDir: BaseDirectory.AppData,
    recursive: true
  });

  if (scale >= 1) {
    // Always persist media inside AppData so it remains readable after app restart
    // without depending on runtime-granted access to arbitrary external folders.
    await writeFile(sourceRelativePath, sourceBytes, { baseDir: BaseDirectory.AppData });
    return {
      sourcePath,
      optimizedPath: sourceAppDataPath,
      displayName,
      originalBytes: sourceBytes.byteLength,
      optimizedBytes: sourceBytes.byteLength,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,
      optimizedWidth: sourceWidth,
      optimizedHeight: sourceHeight,
      optimized: false
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Không khởi tạo được canvas để tối ưu ảnh.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const outputMime = outputMimeFromInput(sourceMime);
  const quality = outputMime === 'image/png' ? 1 : 0.95;
  const optimizedBlob = await canvasToBlob(canvas, outputMime, quality);
  const optimizedBytes = new Uint8Array(await optimizedBlob.arrayBuffer());
  const ext = mimeToExtension(outputMime);
  const checksum = hashBytes(optimizedBytes);
  const relativePath = `${OPTIMIZED_MEDIA_DIR}/${checksum}-${targetWidth}x${targetHeight}.${ext}`;
  await writeFile(relativePath, optimizedBytes, { baseDir: BaseDirectory.AppData });

  return {
    sourcePath,
    optimizedPath: toAppDataImagePath(relativePath),
    displayName,
    originalBytes: sourceBytes.byteLength,
    optimizedBytes: optimizedBytes.byteLength,
    originalWidth: sourceWidth,
    originalHeight: sourceHeight,
    optimizedWidth: targetWidth,
    optimizedHeight: targetHeight,
    optimized: true
  };
};
