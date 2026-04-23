import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ''
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định'
    };
  }

  componentDidCatch(error: unknown): void {
    console.error('UI runtime error captured by AppErrorBoundary:', error);
  }

  private readonly onReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card/80 p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-destructive">Ứng dụng gặp lỗi hiển thị</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {this.state.message || 'Đã có lỗi runtime xảy ra trong giao diện.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border/50 bg-background/60 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            onClick={this.onReload}
          >
            Tải lại ứng dụng
          </button>
        </div>
      </main>
    );
  }
}
