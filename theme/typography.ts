import { Colors } from "./colors";

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
} as const;

