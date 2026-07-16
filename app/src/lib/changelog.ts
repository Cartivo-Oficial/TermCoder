import raw from "../../../CHANGELOG.md?raw";

export interface Area {
  name: string;
  items: string[];
}

export interface Release {
  version: string;
  date: string;
  intro?: string;
  areas: Area[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseChangelog(md: string): Release[] {
  return md
    .split(/^## +/m)
    .slice(1)
    .map((part) => {
      const lines = part.split("\n");
      const version = (lines.shift() ?? "").trim();
      let date = "";
      const introLines: string[] = [];
      const areas: Area[] = [];
      let current: Area | null = null;

      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (!date && DATE.test(t)) {
          date = t;
          continue;
        }
        if (t.startsWith("### ")) {
          current = { name: t.slice(4).trim(), items: [] };
          areas.push(current);
          continue;
        }
        if (t.startsWith("- ")) {
          if (current) current.items.push(t.slice(2).trim());
          continue;
        }
        if (!current) introLines.push(t);
      }

      const intro = introLines.join(" ").trim();
      return intro ? { version, date, intro, areas } : { version, date, areas };
    });
}

const CODE = "rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The small subset of markdown the changelog uses.
 *
 * Code spans are stashed behind a token before anything else runs. ``a`` is how
 * markdown quotes a literal backtick, so replacing it in place would leave that
 * backtick in the text for the single-backtick pass to mis-pair with the next
 * span — which is exactly what mangled the Ctrl+` entry.
 */
export function inlineMd(md: string): string {
  const codes: string[] = [];
  const stash = (code: string) => `@@code:${codes.push(code) - 1}@@`;

  const withTokens = md
    .replace(/``(.+?)``/g, (_, c: string) => stash(c.trim()))
    .replace(/`([^`]+)`/g, (_, c: string) => stash(c));

  return escape(withTokens)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-normal text-foreground">$1</strong>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/@@code:(\d+)@@/g, (_, i: string) => `<code class="${CODE}">${escape(codes[Number(i)])}</code>`);
}

export const RELEASES: Release[] = parseChangelog(raw);
