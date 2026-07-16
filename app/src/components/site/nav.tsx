import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mark } from "@/components/mark";

const LINKS = ["install", "download", "docs", "changelog", "pricing"];

export function Nav({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-7 px-6">
        <a href="index.html" className="flex items-center gap-2.5">
          <Mark size={20} />
          <span className="font-display text-[17px] font-light tracking-tight text-foreground">termcoder</span>
        </a>
        <nav className="hidden items-center gap-6 font-mono text-[12.5px] text-muted-foreground md:flex">
          <a href="index.html#build" className="transition-colors hover:text-primary">build</a>
          <a href="index.html#study" className="transition-colors hover:text-study">study</a>
          <span className="h-3 w-px bg-border" />
          {LINKS.map((n) => (
            <a
              key={n}
              href={`${n}.html`}
              className={cn("transition-colors hover:text-foreground", active === n && "text-foreground")}
            >
              {n}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a href="login.html" className="hidden font-mono text-[12.5px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            sign in
          </a>
          <a href="download.html" className={cn(buttonVariants(), "h-9 rounded-md px-4 font-mono text-[13px] shadow-[0_10px_30px_-12px] shadow-primary/60")}>
            Get the app →
          </a>
        </div>
      </div>
    </header>
  );
}
