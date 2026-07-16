import { useState } from "react";

async function copy(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // the clipboard API can be blocked by permissions or an insecure context
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copy(text);
        setState(ok ? "done" : "failed");
        setTimeout(() => setState("idle"), 1400);
      }}
      className="rounded border border-white/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
    >
      {state === "done" ? "Copied" : state === "failed" ? "Select it" : "Copy"}
    </button>
  );
}
