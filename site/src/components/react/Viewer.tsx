import { useEffect, useRef, useState } from "react";

export default function Viewer() {
  const [title, setTitle] = useState("Session viewer");
  const [sub, setSub] = useState(
    "Open a TermCoder session someone shared with you — a read-only transcript, right here in the browser."
  );
  const [refValue, setRefValue] = useState("");
  const [statusText, setStatusText] = useState("");
  const [statusErr, setStatusErr] = useState(false);
  const [metaText, setMetaText] = useState("");
  const [metaHidden, setMetaHidden] = useState(true);
  const [frameHidden, setFrameHidden] = useState(true);
  const [srcDoc, setSrcDoc] = useState<string | undefined>(undefined);

  const frameRef = useRef<HTMLIFrameElement>(null);

  function parseGistId(ref: string) {
    const m = ref.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]+)/);
    if (m) return m[1];
    return ref.trim().split(/[/?#]/).filter(Boolean).pop() || "";
  }

  function sizeFrame() {
    try {
      const frame = frameRef.current;
      if (!frame || !frame.contentWindow) return;
      const doc = frame.contentWindow.document;
      frame.style.height = Math.max(doc.body.scrollHeight + 24, window.innerHeight * 0.6) + "px";
    } catch (e) {
      /* ignore */
    }
  }

  async function open(ref: string) {
    const id = parseGistId(ref);
    if (!id) {
      setStatusText("Paste a gist link or id above.");
      setStatusErr(true);
      return;
    }
    setStatusText("Loading…");
    setStatusErr(false);
    setMetaHidden(true);
    setFrameHidden(true);
    try {
      const res = await fetch("https://api.github.com/gists/" + id, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        setStatusText(
          res.status === 404
            ? "Couldn't find that session (check the link)."
            : res.status === 403
              ? "GitHub rate-limited this browser — try again in a minute."
              : "Couldn't load that gist (" + res.status + ")."
        );
        setStatusErr(true);
        return;
      }
      const gist = await res.json();
      const file = gist.files && gist.files["termcoder-session.html"];
      if (!file) {
        setStatusText("That gist isn't a TermCoder session.");
        setStatusErr(true);
        return;
      }
      let html = file.content;
      if (file.truncated && file.raw_url) html = await (await fetch(file.raw_url)).text();

      setTitle((gist.description || "Shared session").replace(/^termcoder session — /, ""));
      setSub("Read-only transcript. Shared via GitHub gist.");
      const when = gist.updated_at ? new Date(gist.updated_at).toLocaleString() : "";
      setMetaText("Updated " + when + " · " + (gist.owner ? "by " + gist.owner.login : "anonymous"));
      setMetaHidden(false);
      setSrcDoc(html);
      setFrameHidden(false);
      setStatusText("");
      setStatusErr(false);
    } catch (e) {
      setStatusText("Something went wrong loading that session.");
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
    <>
      <div className="head">
        <div className="eyebrow">Shared session</div>
        <h1 id="title">{title}</h1>
        <p className="sub" id="sub">{sub}</p>

        <div className="open-row">
          <input
            id="ref"
            placeholder="Paste a gist link or id…"
            spellCheck={false}
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") open(refValue);
            }}
          />
          <button className="btn" id="openBtn" onClick={() => open(refValue)}>
            Open
          </button>
        </div>
        <p className="note">
          In termcoder, run <b className="mono">/publish</b> (or Share → Gist) to get a link. Secret gists open with the link — nothing is public.
        </p>
      </div>

      <div id="status" className={"status" + (statusErr ? " err" : "")}>{statusText}</div>
      <div id="meta" className="meta" hidden={metaHidden}>{metaText}</div>
      <div id="frameWrap" className="frame-wrap" hidden={frameHidden}>
        <iframe
          ref={frameRef}
          id="frame"
          className="viewer"
          sandbox="allow-same-origin"
          title="Session transcript"
          srcDoc={srcDoc}
          onLoad={sizeFrame}
        />
      </div>
    </>
  );
}
