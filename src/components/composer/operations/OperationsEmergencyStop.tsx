import { OctagonX, PauseCircle, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';

interface OperationsEmergencyStopProps {
  running: boolean;
  stopping: boolean;
  paused: boolean;
  hasQueue: boolean;
  onTogglePause: () => Promise<void>;
  onEmergencyStop: () => void;
}

export function OperationsEmergencyStop({
  running,
  stopping,
  paused,
  hasQueue,
  onTogglePause,
  onEmergencyStop
}: OperationsEmergencyStopProps): JSX.Element | null {
  if (!running) {
    return null;
  }

  const statusText = stopping
    ? 'Hệ thống đang dừng và hoàn tất trạng thái cuối. Vui lòng chờ.'
    : paused
      ? 'Chiến dịch đang tạm dừng. Bấm "Tiếp tục" để gửi tiếp từ nhóm kế tiếp.'
      : 'Chiến dịch đang gửi. Bạn có thể tạm dừng hoặc dừng khẩn cấp bất kỳ lúc nào.';

  return (
    <div className="space-y-3 rounded-lg border border-warning/35 bg-warning/[0.07] p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
          <OctagonX className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-warning">Điều khiển khẩn cấp</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={paused ? 'default' : 'secondary'}
          onClick={() => void onTogglePause()}
          disabled={!hasQueue || stopping}
          title={
            paused
              ? 'Tiếp tục gửi từ vị trí đang tạm dừng'
              : 'Tạm dừng sau khi xử lý xong nhóm hiện tại'
          }
          className={`${panelTokens.control} gap-1.5`}
        >
          {paused ? (
            <PlayCircle className="h-3.5 w-3.5" />
          ) : (
            <PauseCircle className="h-3.5 w-3.5" />
          )}
          {paused ? 'Tiếp tục' : 'Tạm dừng'}
        </Button>
        <Button
          variant="destructive"
          onClick={onEmergencyStop}
          disabled={!running || stopping}
          className={`${panelTokens.control} gap-1.5`}
        >
          <OctagonX className="h-3.5 w-3.5" />
          {stopping ? 'Đang dừng...' : 'Dừng khẩn cấp'}
        </Button>
      </div>

      <p className="text-xs text-warning/80">{statusText}</p>
    </div>
  );
}
