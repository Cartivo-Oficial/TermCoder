import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("termcoder UI error:", error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="crash">
        <div className="crash-card">
          <div className="crash-title">Something went wrong rendering the app.</div>
          <pre className="crash-msg">{error.message}</pre>
          <div className="crash-actions">
            <button className="allow" onClick={this.reset}>Dismiss</button>
            <button onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
