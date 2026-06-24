import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("TreeWriter UI error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleResetPrefs = (): void => {
    try {
      localStorage.removeItem("treewriter.workspace.v1");
      localStorage.removeItem("treewriter.readingFocus.v1");
      localStorage.removeItem("treewriter.theme.v1");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">TreeWriter failed to load</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The editor hit a startup error. This can happen after an update or when saved layout
            preferences are incompatible with your browser.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              onClick={this.handleReload}
            >
              Reload
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
              onClick={this.handleResetPrefs}
            >
              Reset saved layout & reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
