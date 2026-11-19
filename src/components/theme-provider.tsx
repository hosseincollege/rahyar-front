// frontend/src/components/theme-provider.tsx
// مدیریت تم‌های light، dark و system و اعمال آن روی تگ html

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "rahyar-theme";
const LEGACY_STORAGE_KEY = "erp-theme";
const THEME_CHANGE_EVENT = "rahyar:theme-change";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function isValidTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getStoredTheme(): Theme {
  try {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return isValidTheme(savedTheme) ? savedTheme : "system";
  } catch {
    return "system";
  }
}

function subscribeTheme(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY || event.key === null) {
      callback();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function subscribeSystemTheme(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getServerTheme(): Theme {
  return "system";
}

function getServerSystemTheme(): ResolvedTheme {
  return "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme, resolvedTheme = resolveTheme(theme)): ResolvedTheme {
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.dataset.theme = theme;
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, getServerSystemTheme);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyTheme(theme, resolvedTheme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    try {
      const currentTheme = window.localStorage.getItem(STORAGE_KEY);
      const legacyTheme = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!currentTheme && isValidTheme(legacyTheme)) {
        window.localStorage.setItem(STORAGE_KEY, legacyTheme);
      }
    } catch {
      // Theme remains available for this session even when storage is blocked.
    }
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme, nextTheme === "system" ? getSystemTheme() : nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the selected theme active for this session if storage is blocked.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme باید داخل ThemeProvider استفاده شود.");
  }

  return context;
}
