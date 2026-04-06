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
      <main className="flex h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-card p-4">
          <h1 className="text-lg font-semibold text-destructive">Ứng dụng gặp lỗi hiển thị</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.message || 'Đã có lỗi runtime xảy ra trong giao diện.'}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            onClick={this.onReload}
          >
            Tải lại ứng dụng
          </button>
        </div>
      </main>
    );
  }
}
