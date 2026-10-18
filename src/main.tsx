import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";

(window as any).__APP_MOUNTED__ = true;

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
