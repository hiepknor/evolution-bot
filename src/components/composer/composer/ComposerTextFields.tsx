import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ChevronDown, FileText, HardDrive, Layers } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { ComposerEmojiMode } from '@/components/composer/composer/ComposerEmojiMode';
import type { EmojiMode } from '@/lib/types/domain';

interface ComposerView {
  captionTemplate: string;
  introText: string;
  titleText: string;
  footerText: string;
  plainTextFallback: string;
  emojiMode: EmojiMode;
  setCaptionTemplate: (value: string) => void;
  setIntroText: (value: string) => void;
  setTitleText: (value: string) => void;
  setFooterText: (value: string) => void;
  setPlainTextFallback: (value: string) => void;
  setEmojiMode: (mode: EmojiMode) => void;
  reset: () => void;
}

interface DraftView {
  textareaRef: RefObject<HTMLTextAreaElement>;
  lineCount: number;
  canShowTemplateSuccess: boolean;
  isImageOnlyDraft: boolean;
  shownTemplateIssues: Array<{ level: 'error' | 'warning'; message: string }>;
  hasTemplateEmptyWarning: boolean;
  contentQualityWarnings: string[];
  insertPlaceholder: (key: 'group_name') => void;
  showAdvancedContent: boolean;
  setShowAdvancedContent: Dispatch<SetStateAction<boolean>>;
  hasAdvancedContent: boolean;
  setConfirmClearDraftOpen: (value: boolean) => void;
}

export function ComposerTextFields({
  composer,
  draft
}: {
  composer: ComposerView;
  draft: DraftView;
}): JSX.Element {
  return (
    <div className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <p className={panelTokens.sectionTitle}>Mẫu nội dung</p>
      </div>

      {/* Textarea */}
      <Textarea
        ref={draft.textareaRef}
        rows={6}
        value={composer.captionTemplate}
        onChange={(e) => composer.setCaptionTemplate(e.target.value)}
        placeholder="Nhập mẫu nội dung để gửi..."
        className="border-border/40 bg-background/60 leading-6 placeholder:text-foreground/35"
      />

      {/* Char / line count */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="font-medium text-foreground/70">{composer.captionTemplate.length}</span> ký tự
          </span>
          <span className="text-border/60">·</span>
          <span>
            <span className="font-medium text-foreground/70">{draft.lineCount}</span> dòng
          </span>
        </div>
        {draft.canShowTemplateSuccess ? <Badge variant="success">Hợp lệ</Badge> : null}
      </div>

      {draft.isImageOnlyDraft ? (
        <p className="text-xs text-muted-foreground">
          Đang để trống nội dung chữ — bản tin sẽ gửi ảnh là chính.
        </p>
      ) : null}

      {/* Template issues */}
      {draft.shownTemplateIssues.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          {draft.shownTemplateIssues.map((issue, index: number) => (
            <div key={`${issue.level}-${index}`} className="flex items-start gap-2">
              <Badge variant={issue.level === 'error' ? 'destructive' : 'warning'}>
                {issue.level === 'error' ? 'Lỗi' : 'Cảnh báo'}
              </Badge>
              <p className="pt-0.5 text-xs text-muted-foreground">{issue.message}</p>
            </div>
          ))}
          {draft.hasTemplateEmptyWarning ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <p className="text-xs text-muted-foreground">Chèn biến đầu tiên để bắt đầu nhanh:</p>
              <button
                type="button"
                onClick={() => draft.insertPlaceholder('group_name')}
                className="inline-flex h-6 items-center rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 font-mono text-[11px] text-primary hover:bg-primary/10"
              >
                {`{group_name}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Quality warnings */}
      {draft.contentQualityWarnings.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-warning/35 bg-warning/[0.08] px-3 py-2">
          <p className="text-xs font-semibold text-warning">Cảnh báo chất lượng</p>
          {draft.contentQualityWarnings.map((warning: string) => (
            <p key={warning} className="text-xs text-warning/90">· {warning}</p>
          ))}
        </div>
      ) : null}

      {/* Advanced content toggle */}
      <div className={panelTokens.section}>
        <button
          type="button"
          className={cn(
            panelTokens.control,
            'flex w-full items-center gap-2.5 border border-border/40 bg-background/35 px-3 text-left transition-colors hover:bg-muted/20'
          )}
          onClick={() => draft.setShowAdvancedContent((prev: boolean) => !prev)}
        >
          <div className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
            draft.showAdvancedContent ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'
          )}>
            <Layers className="h-3 w-3" />
          </div>
          <span className={cn(
            'flex-1 text-sm font-medium transition-colors',
            draft.showAdvancedContent ? 'text-foreground' : 'text-muted-foreground'
          )}>
            Nội dung nâng cao
          </span>
          <Badge
            variant={draft.hasAdvancedContent ? 'success' : 'secondary'}
            className="shrink-0 text-[10px]"
          >
            {draft.hasAdvancedContent ? 'Đang dùng' : 'Chưa dùng'}
          </Badge>
          <ChevronDown className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            draft.showAdvancedContent ? 'rotate-180 text-foreground/70' : 'text-muted-foreground/40'
          )} />
        </button>

        {draft.showAdvancedContent ? (
          <div className="space-y-2.5 pt-1">
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Mở đầu (tuỳ chọn)</Label>
              <Textarea
                rows={2}
                value={composer.introText}
                onChange={(e) => composer.setIntroText(e.target.value)}
                placeholder="Ví dụ: Xin chào anh/chị,"
                className="border-border/40 bg-background/60 leading-6 placeholder:text-foreground/35"
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Tiêu đề phụ (tuỳ chọn)</Label>
              <Input
                value={composer.titleText}
                onChange={(e) => composer.setTitleText(e.target.value)}
                placeholder="Ví dụ: Bảng giá mới nhất"
                className={`${panelTokens.control} border-border/40 bg-background/60`}
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Kết thúc (tuỳ chọn)</Label>
              <Textarea
                rows={2}
                value={composer.footerText}
                onChange={(e) => composer.setFooterText(e.target.value)}
                placeholder="Ví dụ: Cần thêm thông tin, vui lòng phản hồi tin nhắn này."
                className="border-border/40 bg-background/60 leading-6 placeholder:text-foreground/35"
              />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Văn bản dự phòng (tuỳ chọn)</Label>
              <Textarea
                rows={2}
                value={composer.plainTextFallback}
                onChange={(e) => composer.setPlainTextFallback(e.target.value)}
                placeholder="Dùng khi template chính không tạo ra nội dung."
                className="border-border/40 bg-background/60 leading-6 placeholder:text-foreground/35"
              />
            </div>
            <ComposerEmojiMode emojiMode={composer.emojiMode} setEmojiMode={composer.setEmojiMode} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {draft.hasAdvancedContent
              ? 'Đã có nội dung nâng cao. Mở mục này để chỉnh sửa nhanh.'
              : 'Đang dùng nội dung cơ bản. Mở để thêm mở đầu, tiêu đề phụ, kết thúc hoặc văn bản dự phòng.'}
          </p>
        )}
      </div>

      {/* Draft actions */}
      <div className={panelTokens.section}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/50 text-muted-foreground">
            <HardDrive className="h-3 w-3" />
          </div>
          <span className="text-xs text-muted-foreground">Bản nháp lưu tự động trên máy này.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`${panelTokens.control} px-3`}
            onClick={() => composer.reset()}
          >
            Khôi phục mặc định
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`${panelTokens.control} border-border/45 px-3 text-muted-foreground hover:bg-muted/20 hover:text-foreground`}
            onClick={() => draft.setConfirmClearDraftOpen(true)}
          >
            Xóa bản nháp đã lưu
          </Button>
        </div>
      </div>
    </div>
  );
}
