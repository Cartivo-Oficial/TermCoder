import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { CopyButton } from "@/components/copy-button";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { CardGrid } from "@/components/site/card-grid";
import { ArrowLink } from "@/components/site/arrow-link";
import { PrimaryDownload, BASE } from "@/components/download-cards";
import { cn } from "@/lib/utils";

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

const CARD = "rounded-xl border border-border bg-card p-6";
const CARD_TITLE = "text-[15px] font-medium tracking-tight text-foreground";
const SUBHEAD = "text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground";

const INSTALL = "npm install -g @termcoder/tui";

export default function Download() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="download" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <Section bordered={false} className="pb-2">
        <Eyebrow>Download</Eyebrow>
        <Heading level={1}>The app, on your machine.</Heading>
        <Lead>
          Chat, an editor and a real terminal in one window. Electron bundles its own Node — there is nothing to
          install first, no account, and no API key.
        </Lead>
        <PrimaryDownload />
      </Section>

      {/* ── 02 · platforms ───────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Three platforms</Eyebrow>
        <Heading>Six builds, one release.</Heading>
        <Lead>Same version, same source, different package. Grab the one that matches your machine.</Lead>
        <CardGrid cols={3}>
          {PLATFORMS.map(([os, builds]) => (
            <div key={os} className={CARD}>
              <h3 className={cn(CARD_TITLE, "uppercase tracking-[0.14em] text-muted-foreground")}>{os}</h3>
              <ul className="mt-4">
                {builds.map(([label, file, note]) => (
                  <li key={file} className="border-t border-border py-3 first:border-t-0 first:pt-0">
                    <a href={BASE + file} className="flex items-baseline justify-between gap-3 hover:underline">
                      <span className="text-[15px] text-foreground">{label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/60">.{file.split(".").pop()}</span>
                    </a>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* ── 03 · how it ships ────────────────────────────────────────── */}
      <Section>
        <Eyebrow>How it ships</Eyebrow>
        <Heading>Two ways to get it.</Heading>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className={SUBHEAD}>Every build is the latest release.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              Installers are built by CI on every tag and published straight to GitHub Releases — the links above
              always point at the newest one. They are not code-signed yet, so Windows SmartScreen and macOS
              Gatekeeper will warn you once: choose{" "}
              <span className="font-mono text-foreground">More info → Run anyway</span>, or right-click → Open on a
              Mac.
            </p>
          </div>
          <div>
            <h3 className={SUBHEAD}>Prefer the terminal?</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              The CLI is one npm command and needs Node 20 or newer. It is the same engine — the app just wraps it in
              a window.
            </p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-border bg-muted px-3.5 py-2.5 font-mono text-[13px]">
              <code className="text-foreground">{INSTALL}</code>
              <CopyButton text={INSTALL} />
            </div>
            <div className="mt-4">
              <ArrowLink href="install.html">Read the install guide</ArrowLink>
            </div>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
