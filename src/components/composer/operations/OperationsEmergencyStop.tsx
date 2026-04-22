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

  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="text-sm font-semibold text-warning">Điều khiển khẩn cấp</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant={paused ? 'default' : 'secondary'}
          onClick={() => void onTogglePause()}
          disabled={!hasQueue || stopping}
          title={paused ? 'Tiếp tục gửi từ vị trí đang tạm dừng' : 'Tạm dừng sau khi xử lý xong nhóm hiện tại'}
          className={panelTokens.control}
        >
          {paused ? 'Tiếp tục' : 'Tạm dừng'}
        </Button>
        <Button
          variant="destructive"
          onClick={onEmergencyStop}
          disabled={!running || stopping}
          className={panelTokens.control}
        >
          {stopping ? 'Đang dừng...' : 'Dừng khẩn cấp'}
        </Button>
      </div>
      <p className="text-sm text-warning/90">
        {stopping
          ? 'Hệ thống đang dừng chiến dịch và hoàn tất trạng thái cuối. Vui lòng chờ trong giây lát.'
          : paused
            ? 'Chiến dịch đang tạm dừng. Bấm "Tiếp tục" để gửi tiếp từ nhóm kế tiếp.'
            : 'Chiến dịch đang gửi. Bạn có thể tạm dừng hoặc dừng khẩn cấp bất kỳ lúc nào.'}
      </p>
    </div>
  );
}
