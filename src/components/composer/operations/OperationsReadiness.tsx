import { CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { panelTokens } from '@/components/layout/panel-tokens';

interface OperationsReadinessProps {
  readiness: Array<{
    label: string;
    state: string;
    variant: 'success' | 'outline' | 'destructive' | 'secondary';
  }>;
  canSend: boolean;
  running: boolean;
  missingReadinessReasons: string[];
  executionBadgeHint: string | null;
  executionDisabledReason: string | null;
}

export function OperationsReadiness({
  readiness,
  canSend,
  running,
  missingReadinessReasons,
  executionBadgeHint,
  executionDisabledReason
}: OperationsReadinessProps): JSX.Element {
  const allReady = canSend || running;

  return (
    <div className={panelTokens.section}>
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            allReady ? 'bg-success/10 text-success' : 'bg-muted/40 text-muted-foreground'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Trạng thái sẵn sàng</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {readiness.map((item) => (
          <Badge
            key={item.label}
            variant={item.variant}
            className={
              item.variant === 'outline'
                ? 'border-border/40 bg-background/40 text-muted-foreground'
                : ''
            }
          >
            {item.label} {item.state}
          </Badge>
        ))}
      </div>

      {!canSend && !running ? (
        <p className="text-xs text-muted-foreground">
          Thiếu điều kiện:{' '}
          {missingReadinessReasons.join(', ') ||
            executionBadgeHint ||
            executionDisabledReason?.replace(/\.$/, '') ||
            'vui lòng kiểm tra lại'}
          .
        </p>
      ) : null}
    </div>
  );
}
