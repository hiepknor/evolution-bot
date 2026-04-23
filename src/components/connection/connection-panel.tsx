import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Network, PlugZap, RefreshCcw, Save, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import {
  connectionSettingsSchema,
  normalizeConnectionInput,
  type ConnectionFormValues
} from '@/lib/connection/connection-settings';
import { getConnectionStatusPresentation } from '@/lib/connection/connection-status';
import { useSettingsStore } from '@/stores/use-settings-store';

type FormValues = ConnectionFormValues;

const statusDotClass: Record<string, string> = {
  connected: 'bg-success shadow-[0_0_6px_hsl(var(--success))]',
  checking: 'animate-pulse bg-warning',
  disconnected: 'bg-destructive',
  error: 'bg-destructive'
};

export function ConnectionPanel(): JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false);
  const settings = useSettingsStore((state) => state.settings);
  const save = useSettingsStore((state) => state.save);
  const testConnectionStore = useSettingsStore((state) => state.testConnection);
  const disconnect = useSettingsStore((state) => state.disconnect);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const statusMessage = useSettingsStore((state) => state.statusMessage);
  const lastCheckedAt = useSettingsStore((state) => state.lastCheckedAt);
  const lastSuccessfulCheckedAt = useSettingsStore((state) => state.lastSuccessfulCheckedAt);
  const lastErrorMessage = useSettingsStore((state) => state.lastErrorMessage);
  const loading = useSettingsStore((state) => state.loading);

  const form = useForm<FormValues>({
    resolver: zodResolver(connectionSettingsSchema),
    defaultValues: { baseUrl: '', apiKey: '', instanceName: '', providerMode: 'evolution' }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        instanceName: settings.instanceName,
        providerMode: settings.providerMode
      });
    }
  }, [form, settings]);

  const saveMutation = useMutation({ mutationFn: async (values: FormValues) => { await save(values); } });
  const testMutation = useMutation({ mutationFn: async (values: FormValues) => { await testConnectionStore(values); } });

  const providerMode = form.watch('providerMode');
  const busy = loading || saveMutation.isPending || testMutation.isPending;
  const canEditConnectionFields = providerMode !== 'mock';
  const connectionStatus = getConnectionStatusPresentation(badgeState, statusMessage);
  const shouldShowStatusBanner = connectionStatus.hasError;

  const disconnectedReason = (() => {
    if (badgeState !== 'disconnected') return null;
    if (connectionStatus.hasError || lastErrorMessage) return { label: 'Do lỗi kết nối', toneClass: 'border-destructive/35 bg-destructive/[0.08] text-destructive' };
    if (/ngắt kết nối/i.test(statusMessage)) return { label: 'Do người dùng ngắt', toneClass: 'border-warning/35 bg-warning/[0.08] text-warning' };
    if (/cần kết nối lại|đã lưu cấu hình/i.test(statusMessage)) return { label: 'Do thay đổi cấu hình', toneClass: 'border-warning/35 bg-warning/[0.08] text-warning' };
    return { label: 'Chưa kiểm tra kết nối', toneClass: 'border-border/50 bg-muted/30 text-muted-foreground' };
  })();

  const noteToneClass = connectionStatus.hasError
    ? 'text-destructive'
    : badgeState === 'connected'
      ? 'text-success'
      : badgeState === 'checking'
        ? 'text-warning'
        : 'text-muted-foreground';

  const connectButtonLabel =
    badgeState === 'connected'
      ? 'Ngắt kết nối'
      : testMutation.isPending
        ? 'Đang kết nối...'
        : shouldShowStatusBanner
          ? 'Thử lại kết nối'
          : lastSuccessfulCheckedAt
            ? 'Kết nối lại'
            : 'Kết nối';

  const formatTimestamp = (value: string | null): string => {
    if (!value) return 'Chưa có';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
  };

  const runSaveAndTest = form.handleSubmit(async (values) => {
    const normalized = normalizeConnectionInput(values, settings ?? undefined);
    await saveMutation.mutateAsync(normalized);
    await testMutation.mutateAsync(normalized);
  });

  const inputClass = `${panelTokens.control} border-border/40 bg-background/60`;
  const fieldLabelClass = 'text-[10px] uppercase tracking-wide text-muted-foreground';

  return (
    <Card className="border-border/70 bg-card/85 shadow-[0_14px_36px_-26px_hsl(var(--foreground))]">
      <CardHeader className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Network className="h-3.5 w-3.5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold leading-none text-foreground">Kết nối</CardTitle>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Nguồn cung cấp, thông tin API và trạng thái instance
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 space-y-4">
        {/* Error banner */}
        {shouldShowStatusBanner ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">
            {statusMessage}
          </div>
        ) : null}

        {/* Provider + instance row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className={fieldLabelClass}>Nguồn cung cấp</p>
            <Select
              value={providerMode}
              onValueChange={(value) => form.setValue('providerMode', value as FormValues['providerMode'])}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evolution">Evolution API</SelectItem>
                <SelectItem value="mock">Chế độ mô phỏng</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className={fieldLabelClass}>Tên instance</p>
            <Input
              {...form.register('instanceName')}
              placeholder="instance-01"
              className={inputClass}
              disabled={!canEditConnectionFields}
            />
            {form.formState.errors.instanceName?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.instanceName.message}</p>
            ) : null}
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <p className={fieldLabelClass}>Base URL</p>
          <Input
            {...form.register('baseUrl')}
            placeholder="http://localhost:8080 hoặc https://api.example.com"
            className={inputClass}
            disabled={!canEditConnectionFields}
          />
          <p className="text-[10px] text-muted-foreground/70">
            Local: <span className="font-mono">http://localhost:8080</span>
            {' '}· Remote: <span className="font-mono">https://api.example.com</span>
          </p>
          {form.formState.errors.baseUrl?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.baseUrl.message}</p>
          ) : null}
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <p className={fieldLabelClass}>API Key</p>
          <div className="flex gap-2">
            <Input
              {...form.register('apiKey')}
              type={showApiKey ? 'text' : 'password'}
              placeholder="apikey..."
              className={`${inputClass} flex-1`}
              disabled={!canEditConnectionFields}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`${panelTokens.control} w-10 shrink-0 border-border/40 bg-background/60`}
              onClick={() => setShowApiKey((prev) => !prev)}
              disabled={!canEditConnectionFields}
              aria-label={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {form.formState.errors.apiKey?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.apiKey.message}</p>
          ) : null}
        </div>

        {/* Mock mode warning */}
        {providerMode === 'mock' ? (
          <div className="rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2 text-xs text-warning">
            Chế độ mô phỏng đang bật — kết nối mạng được giả lập để kiểm thử giao diện.
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className={`${panelTokens.control} w-full gap-2 font-medium`}
            onClick={form.handleSubmit(async (values) => {
              const normalized = normalizeConnectionInput(values, settings ?? undefined);
              await saveMutation.mutateAsync(normalized);
            })}
            disabled={busy}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveMutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
          <Button
            type="button"
            variant={badgeState === 'connected' ? 'outline' : 'default'}
            className={cn(
              panelTokens.control,
              'w-full gap-2 font-medium',
              badgeState === 'connected'
                ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                : 'shadow-[0_8px_24px_-16px_hsl(var(--primary))]'
            )}
            onClick={badgeState === 'connected' ? () => disconnect() : runSaveAndTest}
            disabled={busy}
          >
            {badgeState === 'connected' ? (
              <Unplug className="h-3.5 w-3.5" />
            ) : testMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            {connectButtonLabel}
          </Button>
        </div>

        {/* Status box */}
        <div className="space-y-2.5 rounded-lg border border-border/30 bg-muted/[0.06] p-3">
          {/* Status row */}
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              statusDotClass[badgeState] ?? 'bg-muted-foreground'
            )} />
            <span className="text-sm font-medium text-foreground">{connectionStatus.label}</span>
          </div>

          {/* Note */}
          <p className={cn('text-xs', noteToneClass)}>{statusMessage}</p>

          {/* Disconnected reason pill */}
          {disconnectedReason ? (
            <div className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
              disconnectedReason.toneClass
            )}>
              {disconnectedReason.label}
            </div>
          ) : null}

          {/* Timestamps */}
          <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <span>
              <span className="text-muted-foreground/60">Kiểm tra gần nhất:</span>{' '}
              <span className="tabular-nums">{formatTimestamp(lastCheckedAt)}</span>
            </span>
            <span>
              <span className="text-muted-foreground/60">Thành công cuối:</span>{' '}
              <span className="tabular-nums">{formatTimestamp(lastSuccessfulCheckedAt)}</span>
            </span>
          </div>

          {/* Last error */}
          {lastErrorMessage ? (
            <p className="text-[11px] text-destructive">{lastErrorMessage}</p>
          ) : null}

          {/* Retry button */}
          {shouldShowStatusBanner && badgeState !== 'checking' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={runSaveAndTest}
              disabled={busy}
            >
              <RefreshCcw className="h-3 w-3" />
              Thử lại
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
