/** Richer backdrop routes for the hero visual plane */
export function RouteCanvas() {
  return (
    <svg className="route-canvas" viewBox="0 0 640 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3C75BE" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#EDD228" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#CF551F" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="trailSoft" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3C75BE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#EDD228" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <path
        d="M20 500 C110 430, 150 360, 230 330 S360 300, 420 240 S520 140, 620 100"
        fill="none"
        stroke="url(#trailSoft)"
        strokeWidth="28"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M40 420 C120 360, 160 300, 220 280 S340 270, 380 220 S470 120, 580 90"
        fill="none"
        stroke="url(#trail)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M70 480 C150 400, 190 340, 250 310 S360 290, 410 240 S500 140, 600 110"
        fill="none"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 10"
        opacity="0.22"
      />
      <circle cx="70" cy="480" r="11" fill="#3C75BE" />
      <circle cx="70" cy="480" r="18" fill="#3C75BE" opacity="0.18" />
      <circle cx="600" cy="110" r="13" fill="#CF551F" />
      <circle cx="600" cy="110" r="22" fill="#CF551F" opacity="0.16" />
      <circle cx="320" cy="265" r="8" fill="#EDD228" stroke="#0F172A" strokeWidth="2" />
      <circle cx="250" cy="310" r="5" fill="#fff" stroke="#0F172A" strokeWidth="1.5" opacity="0.9" />
      <circle cx="470" cy="175" r="5" fill="#fff" stroke="#0F172A" strokeWidth="1.5" opacity="0.9" />
    </svg>
  );
}
