import { Label } from '@/components/ui/label';
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
    <div className="space-y-1">
      <Label className={panelTokens.fieldLabel}>Mức độ emoji</Label>
      <Select
        value={emojiMode}
        onValueChange={(value) => {
          setEmojiMode(value as EmojiMode);
        }}
      >
        <SelectTrigger className={panelTokens.control}>
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
      <p className="text-xs text-muted-foreground">
        Mức emoji sẽ được lưu theo bản nháp và áp dụng khi chạy chiến dịch.
      </p>
    </div>
  );
}
