import { Colors } from "@/utils/Constants";
import type { Slide } from "@/components/customer/onboarding/WelcomeSlides";

/** Intro slides for riders, shown once after their first sign-in. */
export const RIDER_SLIDES: Slide[] = [
  {
    key: "duty",
    icon: "power",
    tint: "#15803D",
    bg: "#DCFCE7",
    title: "Work when you want",
    body: "Switch ON-DUTY when you're ready for trips and OFF-DUTY when you're done. You only get offers while you're on duty.",
  },
  {
    key: "pay",
    icon: "cash",
    tint: Colors.theme,
    bg: "#FFEDD5",
    title: "See your pay first",
    body: "Every offer shows what you'll earn after commission and how far the pickup is. Accept the ones that suit you.",
  },
  {
    key: "code",
    icon: "shield-checkmark",
    tint: Colors.tertiary,
    bg: "#DBEAFE",
    title: "Always ask for the code",
    body: "Ask the customer for their 4-digit code at pickup, or at drop-off for deliveries. A trip can't move on without it.",
  },
  {
    key: "balance",
    icon: "wallet",
    tint: "#7C3AED",
    bg: "#EDE9FE",
    title: "Cash and your balance",
    body: "Collect the amount the app shows. QareGO's commission is recorded on your balance; settle it before it passes your limit to stay on duty.",
  },
];
