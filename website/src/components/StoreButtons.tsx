function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.28c-.03-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.74-1.78-3.33-1.8-1.42-.14-2.77.84-3.49.84-.72 0-1.84-.82-3.03-.8-1.56.02-3 .91-3.8 2.3-1.62 2.81-.41 6.97 1.16 9.25.77 1.12 1.68 2.37 2.88 2.33 1.16-.05 1.6-.74 3-.74s1.8.74 3.02.72c1.25-.02 2.04-1.14 2.8-2.27.88-1.28 1.24-2.52 1.26-2.58-.03-.01-2.42-.93-2.45-3.8zM14.7 5.5c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.81 1.03.08 2.08-.52 2.71-1.27z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M3.6 2.4c-.4.2-.6.6-.6 1.1v17c0 .5.2.9.6 1.1l.1.05 9.7-9.7v-.2L3.7 2.35l-.1.05zm11.1 6.4 2.5 1.4-2.5 1.4V8.8zm3.3 1.9 2.1 1.2c.8.4.8 1.6 0 2.1l-2.1 1.2-2.7-1.5v-.1l2.7-1.5v-.4zM13.1 12.8l-9.5 9.5c.2 0 .3.05.5.05.3 0 .6-.1.8-.2l10.3-5.9-2.1-1.2-9.5-5.45z" />
    </svg>
  );
}

type Props = {
  appStoreUrl: string;
  playStoreUrl: string;
  variant?: "default" | "onDark";
};

export function StoreButtons({ appStoreUrl, playStoreUrl, variant = "default" }: Props) {
  const ghostClass =
    variant === "onDark" ? "store-btn store-btn--ghost" : "store-btn store-btn--ghost";
  return (
    <div className="cta-row">
      <a className="store-btn" href={appStoreUrl} target="_blank" rel="noreferrer noopener">
        <AppleIcon />
        <span className="store-btn__meta">
          <small>Download on the</small>
          <strong>App Store</strong>
        </span>
      </a>
      <a className={ghostClass} href={playStoreUrl} target="_blank" rel="noreferrer noopener">
        <PlayIcon />
        <span className="store-btn__meta">
          <small>Get it on</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  );
}
