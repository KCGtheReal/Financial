import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Something went wrong
              </h2>
              <p className="text-xs text-zinc-400">
                An unexpected error occurred. Please try reloading the page.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full text-left bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 text-[11px] text-rose-300 font-mono overflow-x-auto max-h-32">
                <span className="text-zinc-500">Error:</span> {this.state.error.message}
              </div>
            )}

            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-white text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleResetCache}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium text-xs flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                <RotateCcw size={14} />
                <span>Clear Cache & Reset</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
