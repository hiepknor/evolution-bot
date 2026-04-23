import { Gauge } from 'lucide-react';

import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';

type Profile = 'safe' | 'balanced' | 'fast' | 'custom';

const profiles: { id: 'safe' | 'balanced' | 'fast'; label: string; hint: string }[] = [
  { id: 'safe', label: 'An toàn', hint: 'Chậm, ít rủi ro' },
  { id: 'balanced', label: 'Cân bằng', hint: 'Tốc độ vừa phải' },
  { id: 'fast', label: 'Nhanh', hint: 'Tốc độ cao' }
];

interface OperationsBasicControlsProps {
  activeProfile: Profile;
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
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Gauge className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className={panelTokens.sectionTitle}>Chiến lược gửi</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hồ sơ gửi</p>
        </div>
      </div>

      <div className={cn(panelTokens.toolbar, 'inline-flex w-full p-1')}>
        {profiles.map((profile) => {
          const isActive = activeProfile === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onApplyProfile(profile.id)}
              disabled={controlsDisabled}
              title={profile.hint}
              className={cn(
                'flex flex-1 flex-col items-center justify-center rounded-md py-2 text-center transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="text-sm font-medium leading-none">{profile.label}</span>
              <span className="mt-0.5 text-[10px] leading-none opacity-70">{profile.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
