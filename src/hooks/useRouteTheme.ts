import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";

/**
 * Hook that sets the theme based on the current route.
 * - Homepage ("/") defaults to light theme
 * - Authenticated pages (dashboard, services, etc.) default to dark theme
 */
export const useRouteTheme = (defaultTheme: "light" | "dark" = "dark") => {
  const { setTheme, theme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    // Check if user has manually set a preference for this session
    const hasUserPreference = sessionStorage.getItem("user-theme-preference");
    
    if (!hasUserPreference) {
      setTheme(defaultTheme);
    }
  }, [defaultTheme, setTheme]);

  const setThemeWithPreference = (newTheme: "light" | "dark") => {
    sessionStorage.setItem("user-theme-preference", newTheme);
    setTheme(newTheme);
  };

  return { theme, setTheme: setThemeWithPreference };
};
