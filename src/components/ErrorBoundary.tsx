'use client';

import { Component, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--danger)]/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--danger)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Algo salió mal
            </h3>
            <p className="text-sm text-[var(--text-muted)] text-center max-w-md">
              Ocurrió un error inesperado. Intenta recargar la página.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-medium hover:opacity-90 transition-opacity"
            >
              Recargar página
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
