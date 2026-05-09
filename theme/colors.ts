export const Colors = {
  // Base — dark mode + lime accent (coach dashboard design)
  bg: "#080808",
  card: "#1C1C1E",
  surface: "#2C2C2E",
  border: "#38383A",
  tabBar: "#101012",

  // Text
  text: "#FFFFFF",
  textSecondary: "#AEAEB2",
  textMuted: "#8E8E93",

  // Brand / status
  primary: "#D4FF44",
  onPrimary: "#0A0A0A",
  danger: "#FF453A",
  success: "#34C759",

  // Button
  disabled: "#48484A",

  // --- Semantic tokens (added in phase-2-utils) ---
  // Only literals that appeared 2+ times across the codebase are promoted here.
  surfaceSubtle:   "rgba(255,255,255,0.06)",  // subtle inset backgrounds, grid lines
  surfaceHighlight:"rgba(255,255,255,0.10)",  // slightly brighter surface tint, active rows
  dangerTint:      "rgba(220,38,38,0.35)",    // danger-tone card border
} as const;
