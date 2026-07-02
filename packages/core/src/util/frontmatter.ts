export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === "") return "";
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((x) => parseScalar(x));
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1).trim();
    const obj: Record<string, unknown> = {};
    if (!inner) return obj;
    for (const pair of inner.split(",")) {
      const ci = pair.indexOf(":");
      if (ci === -1) continue;
      obj[String(parseScalar(pair.slice(0, ci)))] = parseScalar(pair.slice(ci + 1));
    }
    return obj;
  }
  return s;
}

/**
 * A deliberately small YAML subset: top-level `key: value`, inline arrays
 * `[a, b]`, inline flow maps (`{ "a/**": allow, b: deny }`), block arrays
 * (`  - item`), and one level of nested objects (`  subkey: value`). Enough for
 * agent/command frontmatter without a dep.
 */
function parseYaml(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let curKey: string | null = null;
  for (const line of src.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trim();
    if (indent === 0) {
      const ci = content.indexOf(":");
      if (ci === -1) continue;
      const key = content.slice(0, ci).trim();
      const val = content.slice(ci + 1).trim();
      if (val === "") {
        curKey = key;
        out[key] = undefined; // a nested block or array follows
      } else {
        out[key] = parseScalar(val);
        curKey = null;
      }
    } else if (curKey) {
      if (content.startsWith("- ")) {
        if (!Array.isArray(out[curKey])) out[curKey] = [];
        (out[curKey] as unknown[]).push(parseScalar(content.slice(2)));
      } else {
        const ci = content.indexOf(":");
        if (ci === -1) continue;
        const sk = content.slice(0, ci).trim();
        const sv = content.slice(ci + 1).trim();
        const cur = out[curKey];
        if (typeof cur !== "object" || cur === null || Array.isArray(cur)) out[curKey] = {};
        (out[curKey] as Record<string, unknown>)[sk] = parseScalar(sv);
      }
    }
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** Split a markdown document into its YAML frontmatter and body. */
export function parseFrontmatter(text: string): Frontmatter {
  const t = text.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(t);
  if (!m) return { data: {}, body: t.trim() };
  return { data: parseYaml(m[1] ?? ""), body: (m[2] ?? "").trim() };
}
