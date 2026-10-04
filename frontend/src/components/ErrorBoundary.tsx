import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, EmptyState } from "./ui";

interface State {
  failed: boolean;
}

/** Last-resort catch for render errors so one broken view never blanks the whole page. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("View crashed:", error.message, info.componentStack?.split("\n")[1]?.trim());
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        icon="alert"
        title="Something broke on this page"
        actions={
          <>
            <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload the app
            </Button>
          </>
        }
      >
        This is a bug on our side, not a problem with your data. Reloading usually fixes it.
      </EmptyState>
    );
  }
}
