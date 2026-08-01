import {
  siAnthropic,
  siDeepseek,
  siGithub,
  siGoogle,
  siMistralai,
  siOllama,
  siOpenrouter,
} from "simple-icons";

// Named imports only. `simple-icons` ships its whole catalogue as one module,
// so pulling the namespace would drag 3,450 icons into the bundle; naming the
// seven we use lets Rollup drop the rest.
//
// Not every provider has an entry: OpenAI, Groq, xAI, Together and Cerebras
// have all been withdrawn from the set at the owners' request. Those slugs
// resolve to nothing here and the caller falls back to a monogram rather than
// this file inventing a mark.
const PATHS: Record<string, string> = {
  anthropic: siAnthropic.path,
  deepseek: siDeepseek.path,
  github: siGithub.path,
  google: siGoogle.path,
  mistral: siMistralai.path,
  ollama: siOllama.path,
  openrouter: siOpenrouter.path,
};

export function BrandIcon({
  slug, size = 20, className, fallback = null,
}: { slug: string; size?: number; className?: string; fallback?: React.ReactNode }) {
  const d = PATHS[slug];
  if (!d) return fallback;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
