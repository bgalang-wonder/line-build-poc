export type BuildSummary = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  createdAt: string;
};

export type ValidationError = {
  severity: "hard" | "strong" | "soft";
  ruleId: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
};

export type ValidationOutput = {
  buildId: string;
  itemId: string;
  timestamp: string;
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
};

export type Step = {
  id: string;
  orderIndex: number;
  action: {
    family: string;
    techniqueId?: string;
  };
  instruction?: string;
  notes?: string;
  target?: {
    type?: string;
    name?: string;
    bomUsageId?: string;
    bomComponentId?: string;
  };
  equipment?: {
    applianceId?: string;
    presetId?: string;
  };
  time?: {
    durationSeconds: number;
    isActive: boolean;
  };
  stationId?: string;
  cookingPhase?: string;
  prepType?: string;
  container?: {
    type?: string;
    name?: string;
  };
  dependsOn?: string[];
  consumes?: Array<{
    source:
      | { type: "in_build"; artifactId: string }
      | { type: "external_build"; itemId: string; version?: number | "latest_published"; artifactId?: string };
    quantity?: { value: number; unit: string; kind?: "absolute" | "multiplier" };
    notes?: string;
  }>;
  produces?: Array<{
    source:
      | { type: "in_build"; artifactId: string }
      | { type: "external_build"; itemId: string; version?: number | "latest_published"; artifactId?: string };
    quantity?: { value: number; unit: string; kind?: "absolute" | "multiplier" };
    notes?: string;
  }>;
};

export type BenchTopLineBuild = {
  id: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  steps: Step[];
  artifacts?: Array<{
    id: string;
    name?: string;
    type?: string;
  }>;
  requiresBuilds?: Array<{
    itemId: string;
  }>;
  createdAt: string;
  updatedAt: string;
};
