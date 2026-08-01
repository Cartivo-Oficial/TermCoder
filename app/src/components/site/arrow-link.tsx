import { cn } from "@/lib/utils";

// The only place the accent is spent, together with inline links: a "read
// more" line and its arrow. The arrow is a separate span so it can move on
// hover without dragging the underline with it.
export function ArrowLink({
  href, children, className,
}: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "group/arrow inline-flex items-center gap-1.5 font-medium text-accent-link",
        "underline decoration-accent-link/35 underline-offset-4 transition-colors hover:decoration-accent-link",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform group-hover/arrow:translate-x-0.5">→</span>
    </a>
  );
}

// An inline link inside running prose. Same accent, same underline, no arrow.
export function InlineLink({
  href, children, className,
}: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "text-accent-link underline decoration-accent-link/35 underline-offset-4",
        "transition-colors hover:decoration-accent-link",
        className,
      )}
    >
      {children}
    </a>
  );
}
