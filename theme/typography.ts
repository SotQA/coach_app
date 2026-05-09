import { Colors } from "./colors";

/**
 * Raw font size values for inline styles.
 * Only sizes that appear 3+ times across the codebase are included here.
 * For full TextStyle presets (including color/weight), use Typography.*
 */
export const FontSizes = {
  h2: 26,       // screen sub-headings (7+ occurrences)
  h3: 22,       // section titles (20+ occurrences)
  subheading: 18, // medium emphasis labels (6+ occurrences)
  caption: 12,  // metadata, timestamps (18+ occurrences)
  note: 13,     // secondary captions (15+ occurrences)
  tiny: 11,     // badge / pill labels (5+ occurrences)
  display: 44,
  h1: 32,
  micro: 11,
} as const;

export const Typography = {
  title: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  section: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: Colors.text,
  },
  secondary: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
  },
  display: {
    fontSize: 44,
    fontWeight: "800" as const,
    letterSpacing: -1.0,
    color: Colors.text,
  },
  hero: {
    fontSize: 32,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  micro: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.4,
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
  },
} as const;

