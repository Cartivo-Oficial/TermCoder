import { Mark } from "@/components/mark";

const COLUMNS = [
  ["Build", [["Features", "features.html"], ["Install", "install.html"], ["Download", "download.html"], ["Docs", "docs.html"]]],
  ["Study", [["TermExplorer", "study.html"], ["Flashcards", "study.html"], ["Classrooms", "study.html"], ["Live rooms", "study.html"]]],
  ["Project", [["GitHub", "https://github.com/Cartivo-Oficial/TermCoder"], ["Changelog", "changelog.html"], ["Pricing", "pricing.html"], ["npm", "https://www.npmjs.com/package/@termcoder/tui"]]],
  ["Legal", [["Terms of service", "terms.html"], ["Privacy policy", "privacy.html"], ["Refund policy", "refunds.html"]]],
] as const;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-5">
        <div className="col-span-2 md:col-span-1">
          <a href="index.html" className="flex items-center gap-2.5">
            <Mark size={18} />
            <span className="font-display text-[16px] font-light tracking-tight text-foreground">termcoder</span>
          </a>
          <p className="mt-3 max-w-[32ch] text-sm text-muted-foreground">
            An open-source AI agent for your terminal — a builder and a tutor in one install. Local-first, MIT.
          </p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <div key={title}>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h3>
            <ul className="mt-4 space-y-2.5">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-border px-6 py-5 font-mono text-xs text-muted-foreground">
        <span>termcoder · MIT</span>
        <span>built in the open</span>
      </div>
    </footer>
  );
}
