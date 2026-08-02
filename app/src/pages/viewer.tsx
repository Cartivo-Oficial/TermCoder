import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INTRO = "Open a TermCoder session someone shared with you — a read-only transcript, right here in the browser.";

function parseGistId(ref: string): string {
  const m = ref.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]+)/);
  if (m) return m[1];
  return ref.trim().split(/[/?#]/).filter(Boolean).pop() || "";
}

export default function Viewer() {
  const [title, setTitle] = useState("Session viewer");
  const [sub, setSub] = useState(INTRO);
  const [refValue, setRefValue] = useState("");
  const [status, setStatus] = useState("");
  const [statusErr, setStatusErr] = useState(false);
  const [meta, setMeta] = useState("");
  const [srcDoc, setSrcDoc] = useState<string | undefined>(undefined);
  const frameRef = useRef<HTMLIFrameElement>(null);

  function sizeFrame() {
    try {
      const frame = frameRef.current;
      if (!frame || !frame.contentWindow) return;
      const doc = frame.contentWindow.document;
      frame.style.height = Math.max(doc.body.scrollHeight + 24, window.innerHeight * 0.6) + "px";
    } catch {
    }
  }

  async function open(ref: string) {
    const id = parseGistId(ref);
    if (!id) {
      setStatus("Paste a gist link or id above.");
      setStatusErr(true);
      return;
    }
    setStatus("Loading…");
    setStatusErr(false);
    setMeta("");
    setSrcDoc(undefined);
    try {
      const res = await fetch("https://api.github.com/gists/" + id, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        setStatus(
          res.status === 404
            ? "Couldn't find that session (check the link)."
            : res.status === 403
              ? "GitHub rate-limited this browser — try again in a minute."
              : "Couldn't load that gist (" + res.status + ").",
        );
        setStatusErr(true);
        return;
      }
      const gist = await res.json();
      const file = gist.files && gist.files["termcoder-session.html"];
      if (!file) {
        setStatus("That gist isn't a TermCoder session.");
        setStatusErr(true);
        return;
      }
      let html = file.content;
      if (file.truncated && file.raw_url) html = await (await fetch(file.raw_url)).text();

      setTitle((gist.description || "Shared session").replace(/^termcoder session — /, ""));
      setSub("Read-only transcript. Shared via GitHub gist.");
      const when = gist.updated_at ? new Date(gist.updated_at).toLocaleString() : "";
      setMeta("Updated " + when + " · " + (gist.owner ? "by " + gist.owner.login : "anonymous"));
      setSrcDoc(html);
      setStatus("");
      setStatusErr(false);
    } catch {
      setStatus("Something went wrong loading that session.");
      setStatusErr(true);
    }
  }

  useEffect(() => {
    window.addEventListener("resize", sizeFrame);
    const params = new URLSearchParams(location.search);
    const initial = params.get("gist") || params.get("url");
    if (initial) {
      setRefValue(initial);
      open(initial);
    }
    return () => window.removeEventListener("resize", sizeFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <Nav />

      {/* The chrome — what you type into — sits on card. The transcript below
          sits on the page background, so the paper is the only bright thing. */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">shared session</p>
          <h1 className="mt-4 max-w-[20ch] text-[clamp(31px,4.4vw,46px)] font-bold leading-[1.08] tracking-[-0.024em] text-foreground">
            {title}
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground">{sub}</p>

          <h2 className="sr-only">Open a session</h2>
          <div className="mt-7 flex max-w-xl flex-wrap gap-2.5">
            <input
              value={refValue}
              spellCheck={false}
              aria-label="Gist link or id"
              placeholder="Paste a gist link or id…"
              onChange={(e) => setRefValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") open(refValue);
              }}
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3.5 font-mono text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <button onClick={() => open(refValue)} className={cn(buttonVariants(), "h-11 rounded-lg px-6 text-[14px]")}>
              Open
            </button>
          </div>

          <p className="mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            In termcoder, run <span className="font-mono text-[13px] text-foreground">/publish</span> (or Share →
            Gist) to get a link. Secret gists open with the link — nothing is public.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl flex-1 bg-background px-6 py-10">
        <p aria-live="polite" className={cn("font-mono text-[13px]", statusErr ? "text-bad" : "text-muted-foreground")}>
          {status}
        </p>
        {meta && <p className="font-mono text-[11.5px] text-muted-foreground">{meta}</p>}
        {srcDoc !== undefined && (
          /* The transcript is a bare document — share.ts gives it no colours of
             its own — so it is pinned to a light colour-scheme and printed on
             white paper. Theming it would leave black text on a dark card. */
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <iframe
              ref={frameRef}
              sandbox="allow-same-origin"
              title="Session transcript"
              srcDoc={srcDoc}
              onLoad={sizeFrame}
              style={{ colorScheme: "light" }}
              className="block w-full"
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
