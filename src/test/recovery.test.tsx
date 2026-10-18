import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth,
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: "user-1", role: "citizen" } }) }) }) }),
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
  removeChannel: vi.fn(),
} }));

function Status() {
  const { user, loading } = useAuth();
  return <div>{loading ? "pending" : user?.id ?? "signed-out"}</div>;
}
let shouldCrash = true;
function Crash() {
  if (shouldCrash) throw new Error("Simulated React crash");
  return <div>Recovered</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signOut.mockResolvedValue({ error: null });
  localStorage.setItem("session-test", "keep");
  sessionStorage.setItem("session-test", "keep");
  shouldCrash = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

describe("session-safe recovery", () => {
  it("restores the existing session without signing out on reload", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    const first = render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText("user-1");
    first.unmount();
    render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText("user-1");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("session-test")).toBe("keep");
  });

  it("settles loading if session initialization rejects without deleting session storage", async () => {
    auth.getSession.mockRejectedValue(new Error("Connection unavailable"));
    render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText("signed-out");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("session-test")).toBe("keep");
  });

  it("Try again recovers a React crash without clearing the session", () => {
    render(<ErrorBoundary><Crash /></ErrorBoundary>);
    shouldCrash = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("session-test")).toBe("keep");
    expect(sessionStorage.getItem("session-test")).toBe("keep");
  });

  it("only the explicit clear-session choice signs out and deletes stored session data", async () => {
    render(<ErrorBoundary><Crash /></ErrorBoundary>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Clear session & restart" })); });
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(localStorage.getItem("session-test")).toBeNull();
    expect(sessionStorage.getItem("session-test")).toBeNull();
  });
});