import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs';

export const APP_DATA_IMAGE_PREFIX = 'appdata://';
export const APP_CACHE_IMAGE_PREFIX = 'appcache://';

export const normalizeImagePath = (path?: string): string | undefined => {
  if (!path) {
    return undefined;
  }

  if (!path.startsWith('file://')) {
    return path;
  }

  try {
    const url = new URL(path);
    let normalized = decodeURIComponent(url.pathname);

    // file:///C:/... (Windows) -> C:/...
    if (/^\/[A-Za-z]:\//.test(normalized)) {
      normalized = normalized.slice(1);
    }

    return normalized;
  } catch {
    return path;
  }
};

export const inferImageMimeType = (path?: string): string => {
  const lower = (path ?? '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
};

export const isAppDataImagePath = (path: string): boolean =>
  path.startsWith(APP_DATA_IMAGE_PREFIX);

export const isAppCacheImagePath = (path: string): boolean =>
  path.startsWith(APP_CACHE_IMAGE_PREFIX);

export const toAppDataImagePath = (relativePath: string): string =>
  `${APP_DATA_IMAGE_PREFIX}${relativePath}`;

export const toAppCacheImagePath = (relativePath: string): string =>
  `${APP_CACHE_IMAGE_PREFIX}${relativePath}`;

const toAppDataRelativePath = (path: string): string =>
  path.slice(APP_DATA_IMAGE_PREFIX.length);

const toAppCacheRelativePath = (path: string): string =>
  path.slice(APP_CACHE_IMAGE_PREFIX.length);

export const readImageBytes = async (path: string): Promise<Uint8Array> => {
  if (isAppDataImagePath(path)) {
    return readFile(toAppDataRelativePath(path), { baseDir: BaseDirectory.AppData });
  }
  if (isAppCacheImagePath(path)) {
    return readFile(toAppCacheRelativePath(path), { baseDir: BaseDirectory.AppCache });
  }
  return readFile(path);
};
