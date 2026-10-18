import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";

function StartupReady() {
  useEffect(() => {
    (window as any).__APP_MOUNTED__ = true;
    document.getElementById("boot-fallback")?.remove();
  }, []);
  return <ErrorBoundary><App /></ErrorBoundary>;
}

const root = document.getElementById("root");
if (!root) throw new Error("The app could not find its startup container.");
createRoot(root).render(<StartupReady />);
