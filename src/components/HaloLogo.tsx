const MARK_GRADIENT_ID = "halo-logo-gold";

function HaloMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={MARK_GRADIENT_ID} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5CB6B" />
          <stop offset="0.5" stopColor="#E9B949" />
          <stop offset="1" stopColor="#C9922E" />
        </linearGradient>
      </defs>
      <path
        d="M50 12 L86 24 L86 50 C86 71 70 85 50 91 C30 85 14 71 14 50 L14 24 Z"
        stroke={`url(#${MARK_GRADIENT_ID})`}
        strokeWidth={2.5}
      />
      <path d="M40 30 L40 70 M60 30 L60 70 M40 50 L60 50" stroke={`url(#${MARK_GRADIENT_ID})`} strokeWidth={7} strokeLinecap="round" />
      <ellipse cx="50" cy="50" rx="33" ry="9" stroke={`url(#${MARK_GRADIENT_ID})`} strokeWidth={2} opacity={0.9} />
      <circle cx="50" cy="61" r="3.2" fill="#57C4B8" />
    </svg>
  );
}

export function HaloLogo({
  size = 32,
  variant = "mark",
  tagline = false,
}: {
  size?: number;
  variant?: "mark" | "full";
  tagline?: boolean;
}) {
  if (variant === "mark") {
    return <HaloMark size={size} />;
  }

  return (
    <div className="flex flex-col items-center text-center">
      <HaloMark size={size} />
      <p className="mt-3 flex items-baseline font-display text-3xl tracking-[0.2em] text-text">
        H<span className="mx-0.5 -translate-y-2 text-sm text-accent">✦</span>ALO
      </p>
      {tagline && <p className="mt-1 text-sm text-accent">Everything handled. Everyone safer.</p>}
    </div>
  );
}
