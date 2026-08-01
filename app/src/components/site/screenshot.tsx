import { cn } from "@/lib/utils";

export function Screenshot({
  src, alt, width, height, caption, priority = false, className,
}: {
  src: string; alt: string; width: number; height: number;
  caption?: string; priority?: boolean; className?: string;
}) {
  return (
    <figure className={cn("mt-10", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)] dark:shadow-none dark:ring-1 dark:ring-ring/30">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block w-full"
        />
      </div>
      {caption && <figcaption className="mt-3 text-[13px] text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
