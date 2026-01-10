import { describe, expect, it } from "vitest";

import { ActionFamily, type BenchTopLineBuild, type Step } from "./schema";
import { validateBuild } from "./validate";

function baseBuild(
  steps: Step[],
  partial: Partial<BenchTopLineBuild> = {},
): BenchTopLineBuild {
  return {
    id: "build-1",
    itemId: "item-1",
    version: 1,
    status: "draft",
    steps,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function step(
  id: string,
  orderIndex: number,
  family: ActionFamily,
  partial: Partial<Step> = {},
): Step {
  return {
    id,
    orderIndex,
    action: { family },
    ...partial,
  };
}

describe("validateBuild (hard rules + composition/flow)", () => {
  it("enforces H15 and H22 for HEAT steps", () => {
    const s1 = step("s1", 1, ActionFamily.HEAT);
    const result = validateBuild(baseBuild([s1]));

    expect(result.valid).toBe(false);
    expect(result.hardErrors.map((e) => e.ruleId)).toEqual(["H15", "H22"]);

    const s2 = step("s2", 1, ActionFamily.HEAT, { notes: "cook until hot" });
    const result2 = validateBuild(baseBuild([s2]));
    expect(result2.hardErrors.map((e) => e.ruleId)).toEqual(["H15"]);
  });

  it("detects missing dependsOn refs (H8)", () => {
    const s1 = step("s1", 1, ActionFamily.PREP, { dependsOn: ["missing"] });
    const s2 = step("s2", 2, ActionFamily.PREP);
    const result = validateBuild(baseBuild([s1, s2]));

    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H8")).toBe(true);
    expect(result.hardErrors.some((e) => e.ruleId === "H9")).toBe(false);
  });

  it("detects dependency cycles (H9)", () => {
    const a = step("a", 1, ActionFamily.PREP, { dependsOn: ["b"] });
    const b = step("b", 2, ActionFamily.PREP, { dependsOn: ["a"] });
    const result = validateBuild(baseBuild([a, b]));

    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H9")).toBe(true);
    expect(result.hardErrors.some((e) => e.ruleId === "H8")).toBe(false);
  });

  it("requires external_build references to be declared in requiresBuilds", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE, {
      consumes: [
        {
          source: { type: "external_build", itemId: "component-1" },
        },
      ],
    });
    const result = validateBuild(baseBuild([s1]));
    expect(result.hardErrors.some((e) => e.ruleId === "C2")).toBe(true);

    const result2 = validateBuild(
      baseBuild([s1], { requiresBuilds: [{ itemId: "component-1" }] }),
    );
    expect(result2.hardErrors.some((e) => e.ruleId === "C2")).toBe(false);
  });

  it("requires in_build artifact references to resolve", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE, {
      produces: [{ source: { type: "in_build", artifactId: "a1" } }],
    });

    const result = validateBuild(baseBuild([s1]));
    expect(result.hardErrors.some((e) => e.ruleId === "C3")).toBe(true);

    const result2 = validateBuild(
      baseBuild([s1], { artifacts: [{ id: "a1" }] }),
    );
    expect(result2.hardErrors.some((e) => e.ruleId === "C3")).toBe(false);
  });

  it("warns (strong) when artifacts exist but primaryOutputArtifactId is missing", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE);
    const result = validateBuild(baseBuild([s1], { artifacts: [{ id: "a1" }] }));

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.ruleId === "S6" && w.severity === "strong")).toBe(
      true,
    );
  });
});

