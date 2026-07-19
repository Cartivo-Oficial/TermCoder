export function apiHost(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOST && env.HOST.trim() ? env.HOST.trim() : "127.0.0.1";
}

export function isLanHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h !== "" && h !== "127.0.0.1" && h !== "localhost" && h !== "::1";
}
