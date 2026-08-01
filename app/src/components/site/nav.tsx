import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mark } from "@/components/mark";
import { BrandIcon } from "@/components/site/brand-icon";
import { ThemeToggle } from "@/components/site/theme-toggle";

const LINKS = ["features", "study", "install", "download", "docs", "pricing"];

const REPO = "https://github.com/Cartivo-Oficial/TermCoder";

export function Nav({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      {/* Three zones: mark hard left, links centred in the viewport, controls
          right. The centre is absolutely positioned so it stays centred on the
          page rather than on whatever space the other two leave behind. It only
          appears once the viewport is wide enough that it cannot reach the
          right cluster — below that it stays hidden rather than overlap it. */}
      <div className="relative mx-auto flex h-16 max-w-[1120px] items-center px-6">
        <a href="index.html" className="flex items-center gap-2.5">
          <Mark size={20} />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">termcoder</span>
        </a>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-[14px] text-muted-foreground lg:flex">
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

        <div className="ml-auto flex items-center gap-2">
          <a
            href="login.html"
            className="hidden px-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground lg:block"
          >
            sign in
          </a>
          <ThemeToggle />
          <a
            href={REPO}
            aria-label="TermCoder on GitHub"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border",
              "text-muted-foreground transition-colors hover:text-foreground",
            )}
          >
            <BrandIcon slug="github" size={16} />
          </a>
          <a href="download.html" className={cn(buttonVariants(), "h-9 rounded-lg px-4 text-[14px]")}>
            Download
          </a>
        </div>
      </div>
    </header>
  );
}
