// Theme is applied at app startup (see main.tsx) so it works regardless of
// whether the toggle UI (now inside the profile panel) is mounted.
export type Theme = "light" | "dark";

const KEY = "collectrix.theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}
