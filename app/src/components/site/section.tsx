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
    <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

export function Heading({ children, level = 2 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag
      className={cn(
        "mt-4 font-semibold tracking-[-0.03em] text-balance text-foreground",
        level === 1
          ? "max-w-[16ch] text-[clamp(40px,7vw,72px)] leading-[1.02]"
          : "max-w-[24ch] text-[clamp(28px,4vw,40px)] leading-[1.1]",
      )}
    >
      {children}
    </Tag>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">{children}</p>;
}
