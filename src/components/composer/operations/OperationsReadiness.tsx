import { Badge } from '@/components/ui/badge';

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
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Trạng thái sẵn sàng</p>
      <div className="flex flex-wrap items-center gap-2">
        {readiness.map((item) => (
          <Badge
            key={item.label}
            variant={item.variant}
            className={item.variant === 'outline' ? 'border-border/55 bg-background/40 text-muted-foreground' : ''}
          >
            {item.label} {item.state}
          </Badge>
        ))}
      </div>
      {!canSend && !running ? (
        <p className="text-sm text-muted-foreground">
          Thiếu điều kiện gửi:{' '}
          {missingReadinessReasons.join(', ') ||
            executionBadgeHint ||
            executionDisabledReason?.replace(/\.$/, '') ||
            'vui lòng kiểm tra lại điều kiện gửi'}
          .
        </p>
      ) : null}
    </div>
  );
}
