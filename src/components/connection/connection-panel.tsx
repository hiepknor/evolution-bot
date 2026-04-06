import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useSettingsStore } from '@/stores/use-settings-store';

const schema = z
  .object({
    baseUrl: z.string(),
    apiKey: z.string(),
    instanceName: z.string(),
    providerMode: z.enum(['evolution', 'mock'])
  })
  .superRefine((value, ctx) => {
    if (value.providerMode !== 'evolution') {
      return;
    }

    const baseUrl = value.baseUrl.trim();
    const apiKey = value.apiKey.trim();
    const instanceName = value.instanceName.trim();

    if (!baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: 'Base URL là bắt buộc'
      });
    } else if (!z.string().url().safeParse(baseUrl).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: 'URL không hợp lệ'
      });
    }

    if (!apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiKey'],
        message: 'API key là bắt buộc'
      });
    }

    if (!instanceName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['instanceName'],
        message: 'Tên instance là bắt buộc'
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function ConnectionPanel(): JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false);
  const settings = useSettingsStore((state) => state.settings);
  const save = useSettingsStore((state) => state.save);
  const testConnectionStore = useSettingsStore((state) => state.testConnection);
  const disconnect = useSettingsStore((state) => state.disconnect);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const loading = useSettingsStore((state) => state.loading);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseUrl: '',
      apiKey: '',
      instanceName: '',
      providerMode: 'evolution'
    }
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

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await save(values);
    }
  });

  const testMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await testConnectionStore(values);
    }
  });
  const providerMode = form.watch('providerMode');
  const busy = loading || saveMutation.isPending || testMutation.isPending;
  const canEditConnectionFields = providerMode !== 'mock';
  const normalizeValuesForProvider = (values: FormValues): FormValues => {
    const fallbackBaseUrl = settings?.baseUrl?.trim() || 'http://localhost:8080';
    const fallbackApiKey = settings?.apiKey?.trim() || 'mock-key';
    const fallbackInstanceName = settings?.instanceName?.trim() || 'mock-instance';

    if (values.providerMode === 'mock') {
      return {
        ...values,
        baseUrl: values.baseUrl.trim() || fallbackBaseUrl,
        apiKey: values.apiKey.trim() || fallbackApiKey,
        instanceName: values.instanceName.trim() || fallbackInstanceName
      };
    }

    return {
      ...values,
      baseUrl: values.baseUrl.trim(),
      apiKey: values.apiKey.trim(),
      instanceName: values.instanceName.trim()
    };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Kết nối</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Nguồn cung cấp</Label>
          <Select
            value={form.watch('providerMode')}
            onValueChange={(value) => form.setValue('providerMode', value as FormValues['providerMode'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="evolution">Evolution API</SelectItem>
              <SelectItem value="mock">Chế độ mô phỏng</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Base URL</Label>
          <Input
            {...form.register('baseUrl')}
            placeholder="http://localhost:8080 hoặc https://api.example.com"
            disabled={!canEditConnectionFields}
          />
          <p className="text-xs text-muted-foreground">
            Dùng local: <span className="font-mono">http://localhost:8080</span> hoặc remote:{' '}
            <span className="font-mono">https://api.example.com</span>
          </p>
          <p className="text-xs text-destructive">{form.formState.errors.baseUrl?.message}</p>
        </div>

        <div className="space-y-1">
          <Label>API Key</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              {...form.register('apiKey')}
              type={showApiKey ? 'text' : 'password'}
              placeholder="apikey..."
              disabled={!canEditConnectionFields}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={() => setShowApiKey((prev) => !prev)}
              disabled={!canEditConnectionFields}
            >
              {showApiKey ? 'Ẩn' : 'Hiện'}
            </Button>
          </div>
          <p className="text-xs text-destructive">{form.formState.errors.apiKey?.message}</p>
        </div>

        <div className="space-y-1">
          <Label>Tên instance</Label>
          <Input
            {...form.register('instanceName')}
            placeholder="instance-01"
            disabled={!canEditConnectionFields}
          />
          <p className="text-xs text-destructive">{form.formState.errors.instanceName?.message}</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={form.handleSubmit(async (values) => {
              const normalized = normalizeValuesForProvider(values);
              await saveMutation.mutateAsync(normalized);
            })}
            disabled={busy}
          >
            {saveMutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant={badgeState === 'connected' ? 'outline' : 'default'}
            onClick={
              badgeState === 'connected'
                ? () => disconnect()
                : form.handleSubmit(async (values) => {
                    // Auto-save the latest form before testing connection.
                    const normalized = normalizeValuesForProvider(values);
                    await saveMutation.mutateAsync(normalized);
                    await testMutation.mutateAsync(normalized);
                  })
            }
            disabled={busy}
          >
            {badgeState === 'connected' ? 'Ngắt kết nối' : testMutation.isPending ? 'Đang kết nối...' : 'Kết nối'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
