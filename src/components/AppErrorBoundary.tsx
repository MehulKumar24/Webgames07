import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application rendering failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="max-w-lg space-y-4">
            <h1 className="text-2xl font-bold tracking-wider text-cyan-300">
              APPLICATION ERROR
            </h1>
            <p className="text-slate-300">
              The interface encountered an unexpected error. Reload the page to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-cyan-400 px-5 py-2 font-semibold text-cyan-200 hover:bg-cyan-400/10"
            >
              RELOAD
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
