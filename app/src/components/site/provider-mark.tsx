import { PROVIDER_MARKS } from "./provider-marks";

// Separate from BrandIcon on purpose. BrandIcon draws a monochrome mark that
// follows the surrounding text colour, which is what the GitHub link in the
// navigation wants. This one draws a provider's real mark in its own colours.
// One component doing both jobs would be one conditional nobody can read later.
//
// The five monochrome brands have no fill on their paths, so they take the
// colour from `--provider-mark`, which falls back to whatever colour is
// inherited. A dark theme would set that property once, here, and be done.
export function ProviderMark({
  slug, size = 20, className, fallback = null,
}: { slug: string; size?: number; className?: string; fallback?: React.ReactNode }) {
  const paths = PROVIDER_MARKS[slug];
  if (!paths) return fallback;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ color: "var(--provider-mark, currentColor)" }}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? "currentColor"}
          fillRule={p.fillRule as "evenodd" | "nonzero" | undefined}
          clipRule={p.clipRule as "evenodd" | "nonzero" | undefined}
        />
      ))}
    </svg>
  );
}
