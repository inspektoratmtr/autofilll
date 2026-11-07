export type RuleType = "text" | "checkbox" | "radio" | "select" | "javascript";
export type FillMode = "safe" | "overwrite";

export interface Profile {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
}

export interface AutofillRule {
  id: string;
  profileId: string;
  type: RuleType;
  matcher: {
    attribute?: "name" | "id" | "label" | "class" | "placeholder" | "aria-label" | "autocomplete";
    pattern?: string;
    matchMode?: "partial" | "exact" | "regex";
    selector?: string;
  };
  value: string;
  site?: string;
  mode: FillMode;
  enabled: boolean;
  order: number;
}

export interface AppData {
  version: 1;
  profiles: Profile[];
  rules: AutofillRule[];
}
