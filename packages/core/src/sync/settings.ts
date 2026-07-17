import { z } from "zod";

export const LANGUAGES = ["en", "pt", "es"] as const;

export const SettingsSchema = z.object({
  theme: z.string().min(1).max(40).optional(),
  language: z.enum(LANGUAGES).optional(),
  defaultModel: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(40).optional(),
  connectors: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        inputs: z.record(z.string(), z.string()).default({}),
      }),
    )
    .optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export interface SettingEntry {
  value: unknown;
  updatedAt: number;
}

export type SettingsFile = Record<string, SettingEntry>;

const EntrySchema = z.object({ value: z.unknown(), updatedAt: z.number().finite() });

export function parseSettings(raw: unknown): SettingsFile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SettingsFile = {};
  const shape = SettingsSchema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    const field = shape[key];
    if (!field) continue;
    const parsedEntry = EntrySchema.safeParse(entry);
    if (!parsedEntry.success) continue;
    const parsedValue = field.safeParse(parsedEntry.data.value);
    if (!parsedValue.success) continue;
    out[key] = { value: parsedValue.data, updatedAt: parsedEntry.data.updatedAt };
  }
  return out;
}

export function mergeSettings(local: SettingsFile, remote: SettingsFile): SettingsFile {
  const out: SettingsFile = { ...local };
  for (const [key, entry] of Object.entries(remote)) {
    const mine = out[key];
    if (!mine || entry.updatedAt > mine.updatedAt) out[key] = entry;
  }
  return out;
}
