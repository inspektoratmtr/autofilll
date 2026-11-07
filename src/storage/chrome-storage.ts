import { z } from "zod";
import { DEFAULT_DATA, DEFAULT_PROFILE_ID, STORAGE_KEY } from "../shared/constants";
import type { AppData } from "../shared/types";

const ProfileSchema = z.object({
  id: z.string(), name: z.string(), enabled: z.boolean(), createdAt: z.number()
});
const RuleSchema = z.object({
  id: z.string(), profileId: z.string(),
  type: z.enum(["text", "checkbox", "radio", "select", "javascript"]),
  matcher: z.object({
    attribute: z.enum(["name", "id", "label", "class", "placeholder", "aria-label", "autocomplete"]).optional(),
    pattern: z.string().optional(),
    matchMode: z.enum(["partial", "exact", "regex"]).optional(),
    selector: z.string().optional()
  }),
  value: z.string(), site: z.string().optional(),
  mode: z.enum(["safe", "overwrite"]), enabled: z.boolean(), order: z.number()
});
const DataSchema = z.object({
  version: z.literal(1), profiles: z.array(ProfileSchema), rules: z.array(RuleSchema)
});

export async function loadData(): Promise<AppData> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const parsed = DataSchema.safeParse(result[STORAGE_KEY] ?? DEFAULT_DATA);
  if (!parsed.success) return DEFAULT_DATA;
  return parsed.data;
}

export async function saveData(data: AppData): Promise<void> {
  const validated = DataSchema.parse(data);
  await chrome.storage.local.set({ [STORAGE_KEY]: validated });
}

export const ACTIVE_PROFILE_KEY = "mataramActiveProfileId";

export async function getActiveProfileId(): Promise<string> {
  const result = await chrome.storage.local.get(ACTIVE_PROFILE_KEY);
  return result[ACTIVE_PROFILE_KEY] || DEFAULT_PROFILE_ID;
}

export async function setActiveProfileId(id: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PROFILE_KEY]: id });
}
