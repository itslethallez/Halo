import Image from "next/image";

// Aspect ratios (h/w) of the source brand assets in public/brand/, used so each
// variant renders at the right height for a given width without layout shift.
const MARK_RATIO = 461 / 544;
const LOCKUP_RATIO = 623 / 582;
const LOCKUP_TAGLINE_RATIO = 754 / 1077;

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
    return (
      <Image
        src="/brand/halo-mark.png"
        alt="Halo"
        width={size}
        height={Math.round(size * MARK_RATIO)}
        className="block"
        priority
      />
    );
  }

  const src = tagline ? "/brand/halo-lockup-tagline.png" : "/brand/halo-lockup.png";
  const ratio = tagline ? LOCKUP_TAGLINE_RATIO : LOCKUP_RATIO;

  return (
    <Image
      src={src}
      alt="Halo — Everything handled. Everyone safer."
      width={size}
      height={Math.round(size * ratio)}
      className="mx-auto block h-auto w-full"
      style={{ maxWidth: size }}
      priority
    />
  );
}
