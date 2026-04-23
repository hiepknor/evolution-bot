import { RefreshCw, Tag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
          <Tag className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className={panelTokens.sectionTitle}>Chiến dịch</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tên chiến dịch</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={campaignName}
          onChange={(event) => onCampaignNameChange(event.target.value)}
          disabled={controlsDisabled}
          className={`${panelTokens.control} font-mono text-sm`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onResetCampaignName}
          disabled={controlsDisabled}
          className={`${panelTokens.control} shrink-0`}
          aria-label="Tạo tên chiến dịch mới"
          title="Tạo tên mới"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
