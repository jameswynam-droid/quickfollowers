import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

// Check if user has a stored preference, otherwise default to dark
const getDefaultTheme = (): "dark" | "light" => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("user-theme-preference");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  }
  return "dark";
};

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider 
      attribute="class" 
      defaultTheme={getDefaultTheme()} 
      storageKey="user-theme-preference"
      enableSystem={false}
    >
      <App />
    </ThemeProvider>
  </ErrorBoundary>
);
