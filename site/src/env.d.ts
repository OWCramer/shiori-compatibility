interface Window {
  /** Defined inline in Base.astro. Pass a mode to apply it, or nothing to re-read the saved choice. */
  applyTheme(mode?: "light" | "dark" | "system" | null): void;
}
