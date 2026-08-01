import { cn } from "@/lib/utils";

export function Section({
  children, id, bordered = true, className,
}: { children: React.ReactNode; id?: string; bordered?: boolean; className?: string }) {
  return (
    <section id={id} className={cn(bordered && "border-t border-border")}>
      <div className={cn("mx-auto max-w-[1120px] px-6 py-20 sm:py-28", className)}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      <span aria-hidden className="h-px w-6 flex-none bg-accent-link" />
      {children}
    </p>
  );
}

// Larger and less compressed than the first pass: the h1 ceiling goes up and
// the tracking comes back a step, which is most of what separated our type
// from the reference's.
export function Heading({ children, level = 2 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag
      className={cn(
        "mt-4 text-balance text-foreground",
        level === 1
          ? "max-w-[17ch] text-[clamp(44px,7.6vw,84px)] font-semibold leading-[1.04] tracking-[-0.018em]"
          : "max-w-[22ch] text-[clamp(31px,4.4vw,46px)] font-bold leading-[1.08] tracking-[-0.024em]",
      )}
    >
      {children}
    </Tag>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">{children}</p>;
}
