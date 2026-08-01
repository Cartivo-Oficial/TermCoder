import { cn } from "@/lib/utils";

// Hand-drawn 24×24 strokes rather than an icon package: nine shapes is not
// worth a dependency, and drawing them here keeps them on the same weight and
// the same corner radius as the rest of the kit.
const SHAPES: Record<string, React.ReactNode> = {
  disk: (
    <>
      <rect x="3.5" y="4.5" width="17" height="6" rx="2" />
      <rect x="3.5" y="13.5" width="17" height="6" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.7 0-3.2-.6-4.4-1.3" />
      <path d="M10.2 10.2a2.5 2.5 0 0 0 3.5 3.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
      <path d="M7.5 12h9" />
      <path d="M14.5 9.5 17 12l-2.5 2.5" />
    </>
  ),
  noAccount: (
    <>
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M4 4l16 16" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5c0 4.4-2.9 7.5-7 8.9C7.9 18.5 5 15.4 5 11V6z" />
      <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7L18 8v12.5H6z" />
      <path d="M13 3.5V8h5" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  plug: (
    <>
      <rect x="3.5" y="9.5" width="7" height="5" rx="2.5" />
      <rect x="13.5" y="9.5" width="7" height="5" rx="2.5" />
      <path d="M10.5 12h3" />
      <path d="M6 9.5V6.5M18 14.5v3" />
    </>
  ),
  cap: (
    <>
      <path d="M12 4.5 21 9l-9 4.5L3 9z" />
      <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17 14.4a5.5 5.5 0 0 1 3.5 4.6" />
    </>
  ),
};

export function Glyph({ name, className }: { name: string; className?: string }) {
  const shape = SHAPES[name];
  if (!shape) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {shape}
    </svg>
  );
}

// The rounded-square tile the reference puts above a card title and beside a
// provider name. Monochrome by construction — it inherits the text colour.
export function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px]",
        "border border-border bg-muted text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
