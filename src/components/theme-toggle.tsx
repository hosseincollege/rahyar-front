// src/components/theme-toggle.tsx

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

const themes = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1">
        <button className="rounded-xl px-3 py-2 text-sm text-[var(--muted)]">
          Theme
        </button>
      </div>
    );
  }

  return (
    <div className="flex rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1">
      {themes.map((item) => {
        const active = theme === item.key;

        return (
          <button
            key={item.key}
            onClick={() => setTheme(item.key)}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
