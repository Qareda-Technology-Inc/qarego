import { Colors } from "@/utils/Constants";

export const DS = {
  color: {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    text: Colors.text,
    textMuted: "#64748B",
    textSoft: "#94A3B8",
    border: "#E2E8F0",
    primary: Colors.theme,
    accent: "#F97316",
    success: "#16A34A",
    danger: "#EF4444",
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
  },
} as const;
