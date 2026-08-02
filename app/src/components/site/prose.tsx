import { cn } from "@/lib/utils";

// One wrapper for a whole document body: put semantic markup inside it and the
// typography comes out right, with no per-element classes anywhere.
//
// Nesting rule — every block-level and layout selector below is a DIRECT child
// (`[&>p]`, not `[&_p]`), and anything deeper is reached through a direct-child
// parent (`[&>ul>li]`, `[&>table_td]`). So a component nested inside Prose can
// never inherit document spacing: its own markup is not a direct child. React
// components are transparent here — <DocTable/> renders a bare <table>, which
// still lands as a direct child and is still styled.
//
// The two deliberate exceptions are `code` and `strong`: pure inline
// typography, no competing component in the kit, and they should cascade
// wherever they appear. Links are deliberately NOT styled — inside Prose they
// come from InlineLink, so Prose has no selector to fight with it over the
// accent.
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[16px] leading-[1.7] text-muted-foreground",
        "[&>h2]:mt-14 [&>h2]:mb-4 [&>h2]:text-[28px] [&>h2]:font-semibold [&>h2]:tracking-[-0.02em] [&>h2]:text-foreground",
        "[&>h2:first-child]:mt-0",
        "[&>h3]:mt-10 [&>h3]:mb-3 [&>h3]:text-[20px] [&>h3]:font-semibold [&>h3]:text-foreground",
        "[&>p]:mb-4",
        "[&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-1.5",
        "[&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol>li]:mb-1.5",
        "[&_code]:font-mono [&_code]:text-[14px] [&_code]:text-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&>pre]:my-6 [&>pre]:overflow-x-auto [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-border",
        "[&>pre]:bg-muted [&>pre]:p-4 [&>pre]:font-mono [&>pre]:text-[13.5px] [&>pre]:leading-relaxed [&>pre]:text-foreground",
        "[&>blockquote]:my-6 [&>blockquote]:rounded-lg [&>blockquote]:border [&>blockquote]:border-border",
        "[&>blockquote]:border-l-2 [&>blockquote]:border-l-muted-foreground [&>blockquote]:bg-card",
        "[&>blockquote]:px-5 [&>blockquote]:py-4 [&>blockquote]:text-[15px]",
        // display:block + width:max-content is what lets a wide table scroll
        // inside its own box instead of pushing the page sideways at 375px.
        "[&>table]:my-6 [&>table]:block [&>table]:w-max [&>table]:max-w-full [&>table]:overflow-x-auto",
        "[&>table]:text-left [&>table]:text-[15px]",
        "[&>table_th]:border-b [&>table_th]:border-border [&>table_th]:pr-8 [&>table_th]:pb-2",
        "[&>table_th]:font-medium [&>table_th]:text-foreground",
        "[&>table_td]:border-b [&>table_td]:border-border [&>table_td]:py-2.5 [&>table_td]:pr-8",
        "[&>table_td]:align-top [&>table_td:last-child]:pr-0 [&>table_th:last-child]:pr-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
