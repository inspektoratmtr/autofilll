export const STORAGE_KEY = "mataramAutofill";
export const DEFAULT_PROFILE_ID = "default";
export const DEFAULT_DATA = {
  version: 1 as const,
  profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default", enabled: true, createdAt: Date.now() }],
  rules: []
};
