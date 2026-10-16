import type { ReactNode } from "react";

/** Small line icons (24px grid, 1.8 stroke) so the site needs no icon library. */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const icons = {
  ride: (
    <Svg>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M5.5 17 9 10h5l3 7M9 10l-1.5-3H5m9 3 2-3h3" />
    </Svg>
  ),
  food: (
    <Svg>
      <path d="M3 12h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8Z" />
      <path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5" />
    </Svg>
  ),
  grocery: (
    <Svg>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </Svg>
  ),
  pharmacy: (
    <Svg>
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="m9.5 9.5 5 5" />
    </Svg>
  ),
  parcel: (
    <Svg>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" />
    </Svg>
  ),
  gas: (
    <Svg>
      <path d="M12 3c1 3 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2-4.2.3 1.7 1.2 2.4 2 2.4C11.5 8.5 11 6 12 3Z" />
      <path d="M8 21h8" />
    </Svg>
  ),
  shield: (
    <Svg>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Svg>
  ),
  code: (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M7 12h.01M10.5 12h.01M14 12h.01M17.5 12h.01" strokeWidth="2.6" />
    </Svg>
  ),
  eye: (
    <Svg>
      <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.6 3.2M6.5 7.6C4.3 9.2 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.4-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  ),
  pin: (
    <Svg>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Svg>
  ),
  cash: (
    <Svg>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 9.5v5M18 9.5v5" />
    </Svg>
  ),
  signal: (
    <Svg>
      <path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="20" r="0.8" fill="currentColor" />
      <path d="M2 9.5a15 15 0 0 1 20 0" />
    </Svg>
  ),
  clock: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  wallet: (
    <Svg>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
      <path d="M16 13.5h4" />
    </Svg>
  ),
  route: (
    <Svg>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </Svg>
  ),
  store: (
    <Svg>
      <path d="M4 9.5V20h16V9.5M3 9.5 5 4h14l2 5.5a2.8 2.8 0 0 1-5.5.5 2.8 2.8 0 0 1-5 0 2.8 2.8 0 0 1-5.5-.5Z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  check: (
    <Svg>
      <path d="m5 12.5 4.2 4L19 7" />
    </Svg>
  ),
  arrow: (
    <Svg>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </Svg>
  ),
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
  return icons[name];
}
