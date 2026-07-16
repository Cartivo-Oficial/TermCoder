import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";


function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3C3.7 21.4 7.6 24 12 24z" />
      <path fill="#FBBC05" d="M5.6 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.4l3.8 3C6.5 6.7 9 4.8 12 4.8z" />
    </svg>
  );
}

const BTN =
  "auth-btn flex h-12 items-center justify-center gap-3 rounded-md border border-border bg-card px-5 font-mono text-[13.5px] text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.04]";

export default function Login() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-20">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-60" side="both" tone="seam" band={0.28} />

        <div className="relative w-full max-w-[420px] rounded-lg border border-border bg-[#0d0c0e]/90 p-8 backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> sign in
          </p>
          <h1 className="mt-4 font-display text-3xl font-light tracking-[-0.03em] text-foreground">Your dashboard.</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            Two ways in — no passwords, no forms. Sign in only if you want your sessions, decks and recipes in one
            place across machines.
          </p>

          <div className="mt-7 grid gap-2.5">
            <a className={BTN} href="dashboard.html" data-provider="github">
              <GitHubMark />
              Continue with GitHub
            </a>
            <a className={BTN} href="dashboard.html" data-provider="google">
              <GoogleMark />
              Continue with Google
            </a>
          </div>

          <p className="mt-6 border-t border-border pt-5 font-mono text-[11.5px] leading-relaxed text-muted-foreground/60">
            Sign-in is optional. The CLI and the app run with no account and no API key — an account only syncs your
            own data.{" "}
            <a href="download.html" className="text-primary underline underline-offset-2">
              Get the app
            </a>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
