import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { PrimaryDownload, BASE } from "@/components/download-cards";

const PLATFORMS: [string, [string, string, string][]][] = [
  ["Windows", [
    ["Installer", "TermCoder-Setup.exe", "recommended · choose your folder"],
    ["Portable", "TermCoder-Portable.exe", "no install, run it anywhere"],
  ]],
  ["macOS", [
    ["Apple silicon", "TermCoder-arm64.dmg", "M1 and newer"],
    ["Intel", "TermCoder-x64.dmg", "older Macs"],
  ]],
  ["Linux", [
    ["AppImage", "TermCoder-x86_64.AppImage", "chmod +x, then run"],
    ["Debian · Ubuntu", "TermCoder-amd64.deb", "sudo dpkg -i"],
  ]],
];

export default function Download() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="download" />

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="seam" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> download
          </p>
          <h1 className="mt-5 max-w-[16ch] font-display text-5xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-6xl">
            The app, on your machine.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Chat, an editor and a real terminal in one window. Node is bundled — there is nothing to install first, no
            account, and no API key.
          </p>
          <PrimaryDownload />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-3">
          {PLATFORMS.map(([os, builds]) => (
            <section key={os}>
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary">{os}</h2>
              <ul className="mt-4">
                {builds.map(([label, file, note]) => (
                  <li key={file} className="border-b border-border/60 py-3">
                    <a href={BASE + file} className="group flex items-baseline justify-between gap-3">
                      <span className="text-[15px] text-foreground transition-colors group-hover:text-primary">{label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/50">.{file.split(".").pop()}</span>
                    </a>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/50">{note}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 grid gap-8 border-t border-border pt-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">Every build is the latest release.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Installers are built by CI on every tag and published straight to GitHub Releases — the links above always
              point at the newest one. They are not code-signed yet, so Windows SmartScreen and macOS Gatekeeper will warn
              you once: choose <span className="font-mono text-foreground">More info → Run anyway</span>, or right-click →
              Open on a Mac.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">Prefer the terminal?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The CLI is one npm command and needs Node 18+. It is the same engine — the app just wraps it in a window.
            </p>
            <div className="mt-4 inline-flex items-center gap-3 rounded-md border border-white/15 bg-[#0d0c0e] px-3.5 py-2.5 font-mono text-[13px]">
              <span className="text-primary">❯</span>
              <code className="text-foreground">npm install -g @termcoder/tui</code>
            </div>
            <p className="mt-3 font-mono text-[12px]">
              <a href="install.html" className="text-primary">Read the install guide →</a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
