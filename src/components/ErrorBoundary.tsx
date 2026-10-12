import React from "react";
import { Button } from "@/components/ui/button";

type State = { error: Error | null };

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mb-4 break-words text-sm text-muted-foreground">{this.state.error.message}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button onClick={() => (window.location.href = "/")}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
