import { z } from "zod";

export const SettingsSchema = z.object({
  theme: z.string().min(1).max(40).optional(),
  model: z.string().min(1).max(120).optional(),
  reasoning: z.boolean().optional(),
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

export const SETTINGS_KEYS = ["theme", "model", "reasoning"] as const;

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

export function extractSettings(
  config: Record<string, unknown>,
  prev: SettingsFile,
  stamp: number,
): SettingsFile {
  const out: SettingsFile = { ...prev };
  for (const key of SETTINGS_KEYS) {
    const value = config[key];
    const prevEntry = prev[key];
    if (value !== undefined && value !== prevEntry?.value) {
      out[key] = { value, updatedAt: stamp };
    }
  }
  return out;
}

export function settingsToConfigPatch(merged: SettingsFile): Record<string, unknown> {
  const shape = SettingsSchema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) {
    const entry = merged[key];
    if (!entry) continue;
    const parsed = shape[key]!.safeParse(entry.value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}
