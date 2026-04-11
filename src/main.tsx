import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false
    }
  }
});

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown bootstrap error';

const renderBootstrapError = (title: string, message: string): void => {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  root.innerHTML = '';
  const container = document.createElement('main');
  container.className = 'flex h-screen items-center justify-center bg-background p-4 text-foreground';

  const panel = document.createElement('div');
  panel.className = 'w-full max-w-xl rounded-lg border border-destructive/35 bg-card p-4';

  const heading = document.createElement('h1');
  heading.className = 'text-lg font-semibold text-destructive';
  heading.textContent = title;

  const body = document.createElement('p');
  body.className = 'mt-2 whitespace-pre-wrap text-sm text-muted-foreground';
  body.textContent = message;

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.className = 'mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted';
  reloadButton.textContent = 'Tải lại ứng dụng';
  reloadButton.addEventListener('click', () => window.location.reload());

  panel.append(heading, body, reloadButton);
  container.append(panel);
  root.append(container);
};

window.addEventListener('error', (event) => {
  console.error('Unhandled window error:', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const boot = async (): Promise<void> => {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root element');
  }

  try {
    const { default: App } = await import('./App');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    );
  } catch (error) {
    const detail = formatErrorMessage(error);
    console.error('Failed to bootstrap app:', error);
    renderBootstrapError('Không thể khởi động ứng dụng', detail);
  }
};

void boot();
