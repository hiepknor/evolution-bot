import { lazy, Suspense } from 'react';
import dayjs from 'dayjs';
import { PenLine } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { panelTokens } from '@/components/layout/panel-tokens';
import { useComposerStore } from '@/stores/use-composer-store';
import { ComposerImagePicker } from '@/components/composer/composer/ComposerImagePicker';
import { ComposerTemplateHelp } from '@/components/composer/composer/ComposerTemplateHelp';
import { ComposerTextFields } from '@/components/composer/composer/ComposerTextFields';
import { useComposerDraft } from '@/components/composer/composer/hooks/use-composer-draft';

const QuickContentModal = lazy(async () => {
  const module = await import('@/components/composer/quick-content-modal');
  return { default: module.QuickContentModal };
});

export function ComposerPanel(): JSX.Element {
  const composer = useComposerStore();
  const draft = useComposerDraft({ composer });

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <PenLine className="h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-sm font-semibold leading-none text-foreground">Nội dung</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 space-y-3">
        {composer.contentSource ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/35 bg-primary/10 p-3 text-sm">
            <span className="text-primary-foreground/90">
              Đang chỉnh sửa từ: <strong>{composer.contentSource.campaignName}</strong> •{' '}
              {dayjs(composer.contentSource.loadedAt).format('HH:mm:ss')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`${panelTokens.control} px-3`}
              onClick={() => composer.clearContentSource()}
            >
              Bỏ liên kết
            </Button>
          </div>
        ) : null}

        <ComposerImagePicker
          imagePath={composer.imagePath}
          imageName={composer.imageName}
          recentFiles={composer.recentFiles}
          removeRecentFiles={composer.removeRecentFiles}
          isMediaDropActive={draft.isMediaDropActive}
          setIsMediaDropActive={draft.setIsMediaDropActive}
          onDrop={(event) => {
            void draft.handleMediaDrop(event);
          }}
          onPaste={(event) => {
            void draft.handleMediaPaste(event);
          }}
          onPickImage={() => {
            void draft.pickImage();
          }}
          isOptimizingImage={draft.isOptimizingImage}
          mediaMeta={draft.mediaMeta}
          mediaPreviewSrc={draft.mediaPreviewSrc}
          mediaError={draft.mediaError}
          mediaOptimizationNote={draft.mediaOptimizationNote}
          brokenRecentFiles={draft.brokenRecentFiles}
          recentFileHealth={draft.recentFileHealth}
          onRecentFileSelect={(path) => {
            void draft.handleRecentFileSelect(path);
          }}
          onRequestRemoveImage={() => draft.setConfirmRemoveImageOpen(true)}
          formatBytes={draft.formatBytes}
          truncateMiddle={draft.truncateMiddle}
        />

        <ComposerTemplateHelp
          placeholders={draft.TEMPLATE_PLACEHOLDERS}
          onInsertPlaceholder={draft.insertPlaceholder}
          onOpenQuickContent={() => draft.setQuickContentOpen(true)}
        />

        <ComposerTextFields composer={composer} draft={draft} />

        <AlertDialog open={draft.confirmRemoveImageOpen} onOpenChange={draft.setConfirmRemoveImageOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa ảnh hiện tại?</AlertDialogTitle>
              <AlertDialogDescription>
                Ảnh sẽ bị gỡ khỏi nội dung chiến dịch hiện tại. Danh sách tệp gần đây vẫn được giữ lại.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  composer.setImage(undefined);
                  draft.setMediaOptimizationNote(null);
                }}
              >
                Xóa ảnh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={draft.confirmClearDraftOpen} onOpenChange={draft.setConfirmClearDraftOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa bản nháp đã lưu?</AlertDialogTitle>
              <AlertDialogDescription>
                Chỉ xóa bản nháp trong bộ nhớ cục bộ. Nội dung đang hiển thị trên màn hình hiện tại không đổi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => composer.clearDraft()}>
                Xóa bản nháp
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Suspense fallback={null}>
          <QuickContentModal
            open={draft.quickContentOpen}
            onOpenChange={draft.setQuickContentOpen}
            onApply={draft.insertQuickContent}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
