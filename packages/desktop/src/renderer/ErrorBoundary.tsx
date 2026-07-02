import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback; if omitted a full-screen recoverable card is shown. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions so a single bad message (e.g. an odd code
 * block) can't black out the whole window. Without this, an uncaught error
 * unmounts the React tree and leaves an empty (black) renderer.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface it in the DevTools console for diagnosis.
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
