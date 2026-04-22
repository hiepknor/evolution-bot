import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { panelTokens } from '@/components/layout/panel-tokens';

interface OperationsBasicControlsProps {
  activeProfile: 'safe' | 'balanced' | 'fast' | 'custom';
  controlsDisabled: boolean;
  onApplyProfile: (profile: 'safe' | 'balanced' | 'fast') => void;
}

export function OperationsBasicControls({
  activeProfile,
  controlsDisabled,
  onApplyProfile
}: OperationsBasicControlsProps): JSX.Element {
  return (
    <div className={panelTokens.section}>
      <p className={panelTokens.sectionTitle}>Chiến lược gửi</p>
      <Label className={panelTokens.fieldLabel}>Hồ sơ gửi</Label>
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant={activeProfile === 'safe' ? 'default' : 'outline'}
          onClick={() => onApplyProfile('safe')}
          disabled={controlsDisabled}
          className={panelTokens.control}
        >
          An toàn
        </Button>
        <Button
          type="button"
          variant={activeProfile === 'balanced' ? 'default' : 'outline'}
          onClick={() => onApplyProfile('balanced')}
          disabled={controlsDisabled}
          className={panelTokens.control}
        >
          Cân bằng
        </Button>
        <Button
          type="button"
          variant={activeProfile === 'fast' ? 'default' : 'outline'}
          onClick={() => onApplyProfile('fast')}
          disabled={controlsDisabled}
          className={panelTokens.control}
        >
          Nhanh
        </Button>
      </div>
    </div>
  );
}
