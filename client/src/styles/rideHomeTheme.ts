/** Bolt-inspired tokens for the ride booking home (map + bottom sheet). */
export const RideHomeTheme = {
  sheetBg: "#FFFFFF",
  mapOverlay: "rgba(15, 23, 42, 0.04)",
  ink: "#0F172A",
  inkMuted: "#64748B",
  inkSoft: "#94A3B8",
  border: "#E2E8F0",
  surfaceMuted: "#F1F5F9",
  accent: "#EDD228",
  accentDark: "#0F172A",
  success: "#22C55E",
  danger: "#EF4444",
  shadow: {
    float: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    card: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  radius: {
    sheet: 24,
    card: 16,
    pill: 999,
  },
} as const;
