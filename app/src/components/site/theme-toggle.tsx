import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, STORAGE_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(
      resolveTheme(
        localStorage.getItem(STORAGE_KEY),
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to the ${next} theme`}
      onClick={() => { applyTheme(next); setTheme(next); }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border outline-none",
        "text-muted-foreground transition-colors hover:text-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span aria-hidden className="text-[13px]">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
