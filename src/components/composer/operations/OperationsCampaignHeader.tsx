import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { panelTokens } from '@/components/layout/panel-tokens';

interface OperationsCampaignHeaderProps {
  campaignName: string;
  controlsDisabled: boolean;
  onCampaignNameChange: (value: string) => void;
  onResetCampaignName: () => void;
}

export function OperationsCampaignHeader({
  campaignName,
  controlsDisabled,
  onCampaignNameChange,
  onResetCampaignName
}: OperationsCampaignHeaderProps): JSX.Element {
  return (
    <div className={panelTokens.section}>
      <p className={panelTokens.sectionTitle}>Chiến dịch</p>
      <Label className={panelTokens.fieldLabel}>Tên chiến dịch</Label>
      <div className="flex gap-2">
        <Input
          value={campaignName}
          onChange={(event) => onCampaignNameChange(event.target.value)}
          disabled={controlsDisabled}
          className={panelTokens.control}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onResetCampaignName}
          disabled={controlsDisabled}
          className={panelTokens.control}
          aria-label="Tạo tên chiến dịch mới"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
