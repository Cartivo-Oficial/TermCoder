import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/site/section";

export function FeatureBlock({
  eyebrow, title, body, reverse = false, children,
}: {
  eyebrow: string; title: string; body: string;
  reverse?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-3 max-w-[20ch] text-[clamp(24px,3vw,32px)] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground">
          {title}
        </h3>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className={cn("min-w-0", reverse && "lg:order-1")}>{children}</div>
    </div>
  );
}
