import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { panelTokens } from '@/components/layout/panel-tokens';
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

export function ComposerTextFields({ composer, draft }: { composer: ComposerView; draft: DraftView }): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className={panelTokens.sectionTitle}>Mẫu nội dung</h3>
      <Textarea
        ref={draft.textareaRef}
        rows={6}
        value={composer.captionTemplate}
        onChange={(e) => composer.setCaptionTemplate(e.target.value)}
        placeholder="Nhập mẫu nội dung để gửi..."
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{composer.captionTemplate.length} ký tự</span>
          <span>{draft.lineCount} dòng</span>
        </div>
        {draft.canShowTemplateSuccess ? <Badge variant="success">Hợp lệ</Badge> : null}
      </div>
      {draft.isImageOnlyDraft ? (
        <p className="text-xs text-muted-foreground">Đang để trống nội dung chữ. Bản tin hiện sẽ gửi ảnh là chính.</p>
      ) : null}
      {draft.shownTemplateIssues.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2">
          {draft.shownTemplateIssues.map((issue, index: number) => (
            <div key={`${issue.level}-${index}`} className="flex items-start gap-2">
              <Badge variant={issue.level === 'error' ? 'destructive' : 'warning'}>
                {issue.level === 'error' ? 'Lỗi' : 'Cảnh báo'}
              </Badge>
              <p className="pt-0.5 text-xs text-muted-foreground">{issue.message}</p>
            </div>
          ))}
          {draft.hasTemplateEmptyWarning ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">Gợi ý: chèn biến đầu tiên để bắt đầu nhanh.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 font-mono text-xs"
                onClick={() => draft.insertPlaceholder('group_name')}
              >
                Chèn {`{group_name}`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {draft.contentQualityWarnings.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-warning/35 bg-warning/10 p-2">
          <p className="text-sm font-medium text-warning">Cảnh báo chất lượng nội dung</p>
          {draft.contentQualityWarnings.map((warning: string) => (
            <p key={warning} className="text-sm text-warning">• {warning}</p>
          ))}
        </div>
      ) : null}
      <div className={panelTokens.section}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={`${panelTokens.control} flex min-w-0 flex-1 items-center justify-between border border-border/50 bg-muted/20 px-3 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/35`}
            onClick={() => draft.setShowAdvancedContent((prev: boolean) => !prev)}
          >
            <span>Nội dung nâng cao</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${draft.showAdvancedContent ? 'rotate-180 text-foreground/80' : 'text-muted-foreground/70'}`} />
          </button>
          <Badge variant={draft.hasAdvancedContent ? 'success' : 'secondary'} className="shrink-0">
            {draft.hasAdvancedContent ? 'Đang dùng' : 'Chưa dùng'}
          </Badge>
        </div>

        {draft.showAdvancedContent ? (
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Mở đầu (tuỳ chọn)</Label>
              <Textarea rows={2} value={composer.introText} onChange={(e) => composer.setIntroText(e.target.value)} placeholder="Ví dụ: Xin chào anh/chị," />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Tiêu đề phụ (tuỳ chọn)</Label>
              <Input value={composer.titleText} onChange={(e) => composer.setTitleText(e.target.value)} placeholder="Ví dụ: Bảng giá mới nhất" className={panelTokens.control} />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Kết thúc (tuỳ chọn)</Label>
              <Textarea rows={2} value={composer.footerText} onChange={(e) => composer.setFooterText(e.target.value)} placeholder="Ví dụ: Cần thêm thông tin, vui lòng phản hồi tin nhắn này." />
            </div>
            <div className="space-y-1">
              <Label className={panelTokens.fieldLabel}>Văn bản dự phòng (tuỳ chọn)</Label>
              <Textarea rows={2} value={composer.plainTextFallback} onChange={(e) => composer.setPlainTextFallback(e.target.value)} placeholder="Dùng khi template chính không tạo ra nội dung." />
            </div>
            <ComposerEmojiMode emojiMode={composer.emojiMode} setEmojiMode={composer.setEmojiMode} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {draft.hasAdvancedContent
              ? 'Đã có nội dung nâng cao. Mở mục này để chỉnh sửa nhanh.'
              : 'Đang dùng nội dung cơ bản. Mở mục này để thêm mở đầu, tiêu đề phụ, kết thúc hoặc văn bản dự phòng.'}
          </p>
        )}
      </div>

      <div className={panelTokens.section}>
        <span className="text-sm text-muted-foreground">Bản nháp lưu tự động trên máy này.</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className={`${panelTokens.control} px-3`} onClick={() => composer.reset()}>
            Khôi phục mặc định
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`${panelTokens.control} border-border/50 px-3 text-muted-foreground hover:bg-muted/20 hover:text-foreground`}
            onClick={() => draft.setConfirmClearDraftOpen(true)}
          >
            Xóa bản nháp đã lưu
          </Button>
        </div>
      </div>
    </div>
  );
}
