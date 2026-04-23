import { Smile } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
import type { EmojiMode } from '@/lib/types/domain';

const EMOJI_OPTIONS: Array<{ value: EmojiMode; label: string }> = [
  { value: 'none', label: 'Không dùng emoji' },
  { value: 'low', label: 'Ít emoji' },
  { value: 'medium', label: 'Vừa phải' },
  { value: 'high', label: 'Nhiều emoji' }
];

interface ComposerEmojiModeProps {
  emojiMode: EmojiMode;
  setEmojiMode: (mode: EmojiMode) => void;
}

export function ComposerEmojiMode({ emojiMode, setEmojiMode }: ComposerEmojiModeProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/40 text-muted-foreground">
          <Smile className="h-3 w-3" />
        </div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mức độ emoji</p>
      </div>
      <Select value={emojiMode} onValueChange={(value) => setEmojiMode(value as EmojiMode)}>
        <SelectTrigger className={`${panelTokens.control} border-border/40 bg-background/60`}>
          <SelectValue placeholder="Chọn mức emoji" />
        </SelectTrigger>
        <SelectContent>
          {EMOJI_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground/70">
        Lưu theo bản nháp và áp dụng khi chạy chiến dịch.
      </p>
    </div>
  );
}
