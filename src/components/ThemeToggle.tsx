import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    // Save user preference to localStorage so it persists
    localStorage.setItem("user-theme-preference", newTheme);
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9">
        <i className="fa-solid fa-circle-half-stroke text-lg"></i>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-9 h-9"
      onClick={handleToggle}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <i className="fa-solid fa-sun text-lg text-amber-400"></i>
      ) : (
        <i className="fa-solid fa-moon text-lg"></i>
      )}
    </Button>
  );
};
