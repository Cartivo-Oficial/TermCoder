import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/site/theme-toggle";

const LINKS = ["features", "study", "install", "download", "docs", "pricing"];

export function Nav({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-8 px-6">
        <a href="index.html" className="flex items-center gap-2.5">
          <Mark size={20} />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">termcoder</span>
        </a>
        <nav className="hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
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
        <div className="ml-auto flex items-center gap-3">
          <a href="login.html" className="hidden text-[14px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            Sign in
          </a>
          <ThemeToggle />
          <a href="download.html" className={cn(buttonVariants(), "h-9 rounded-lg px-4 text-[14px]")}>
            Get the app
          </a>
        </div>
      </div>
    </header>
  );
}
