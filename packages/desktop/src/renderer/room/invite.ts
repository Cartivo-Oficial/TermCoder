export function inviteLinks(opts: { addresses: string[]; port: number; joinToken: string; secure?: boolean }): string[] {
  if (!opts.joinToken) return [];
  const scheme = opts.secure ? "https" : "http";
  return opts.addresses.map((a) => `${scheme}://${a}:${opts.port}?room=${encodeURIComponent(opts.joinToken)}`);
}
