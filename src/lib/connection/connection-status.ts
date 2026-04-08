import type { ConnectionBadgeState } from '@/lib/types/domain';

export type ConnectionStatusTone = 'success' | 'warning' | 'destructive' | 'secondary';

export interface ConnectionStatusPresentation {
  label: string;
  tone: ConnectionStatusTone;
  hasError: boolean;
}

const CONNECTION_ERROR_PATTERN =
  /lỗi|thất bại|không thể|hết thời gian|timeout|401|403|404|mất kết nối/i;

export const isConnectionErrorMessage = (message: string): boolean =>
  CONNECTION_ERROR_PATTERN.test(message.trim());

export const getConnectionStatusPresentation = (
  state: ConnectionBadgeState,
  statusMessage: string
): ConnectionStatusPresentation => {
  const hasError = isConnectionErrorMessage(statusMessage);

  if (state === 'connected') {
    return { label: 'Đã kết nối', tone: 'success', hasError: false };
  }

  if (state === 'checking') {
    return { label: 'Đang kiểm tra', tone: 'warning', hasError: false };
  }

  if (hasError) {
    return { label: 'Lỗi kết nối', tone: 'destructive', hasError: true };
  }

  return { label: 'Chưa kết nối', tone: 'secondary', hasError: false };
};
