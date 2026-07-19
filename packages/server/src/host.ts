export function apiHost(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOST && env.HOST.trim() ? env.HOST.trim() : "127.0.0.1";
}
