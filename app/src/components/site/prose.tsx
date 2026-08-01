import { cn } from "@/lib/utils";

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[16px] leading-[1.7] text-muted-foreground",
        "[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground",
        "[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1.5",
        "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4",
        "[&_code]:font-mono [&_code]:text-[14px] [&_code]:text-foreground",
        "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border",
        "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13.5px] [&_pre]:leading-relaxed",
        className,
      )}
    >
      {children}
    </div>
  );
}
