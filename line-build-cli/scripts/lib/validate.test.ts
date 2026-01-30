import { describe, expect, it } from "vitest";

import { ActionFamily, type BenchTopLineBuild, type Step } from "./schema";
import { validateBuild } from "./validate";

const DEFAULT_LOC = { stationId: "garnish", sublocation: { type: "work_surface" as const } };

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
  const outputAssemblyId = `out_${id}`;
  return {
    id,
    orderIndex,
    action: { family },
    stationId: "garnish", // Default station for tests (avoids station ambiguity)
    workLocation: { type: "work_surface" as const }, // Required by H46
    input: [],
    output: [{ source: { type: "in_build", assemblyId: outputAssemblyId }, to: DEFAULT_LOC }],
    // Note: from/to removed - steps don't have these fields anymore (only assemblies do)
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
    const s1 = step("s1", 1, ActionFamily.PREP, {
      dependsOn: ["missing"],
      input: [{ source: { type: "in_build", assemblyId: "a0" }, from: DEFAULT_LOC }],
    });
    const s2 = step("s2", 2, ActionFamily.PREP);
    const result = validateBuild(baseBuild([s1, s2]));

    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H8")).toBe(true);
    expect(result.hardErrors.some((e) => e.ruleId === "H9")).toBe(false);
  });

  it("detects dependency cycles (H9)", () => {
    const a = step("a", 1, ActionFamily.PREP, {
      dependsOn: ["b"],
      input: [{ source: { type: "in_build", assemblyId: "x" }, from: DEFAULT_LOC }],
    });
    const b = step("b", 2, ActionFamily.PREP, {
      dependsOn: ["a"],
      input: [{ source: { type: "in_build", assemblyId: "y" }, from: DEFAULT_LOC }],
    });
    const result = validateBuild(baseBuild([a, b]));

    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H9")).toBe(true);
    expect(result.hardErrors.some((e) => e.ruleId === "H8")).toBe(false);
  });

  it("requires external_build references to be declared in requiresBuilds", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE, {
      input: [
        {
          source: { type: "external_build", itemId: "component-1" },
          from: DEFAULT_LOC,
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

  it("does not require assemblies metadata for in_build refs (C3 relaxed in PoC)", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE, {
      output: [{ source: { type: "in_build", assemblyId: "a1" }, to: DEFAULT_LOC }],
    });

    const result = validateBuild(baseBuild([s1]));
    expect(result.hardErrors.some((e) => e.ruleId === "C3")).toBe(false);

    const result2 = validateBuild(
      baseBuild([s1], { assemblies: [{ id: "a1" }] }),
    );
    expect(result2.hardErrors.some((e) => e.ruleId === "C3")).toBe(false);
  });

  it("warns (strong) when assemblies exist but primaryOutputAssemblyId is missing", () => {
    const s1 = step("s1", 1, ActionFamily.ASSEMBLE, {
      output: [{ source: { type: "in_build", assemblyId: "a1" }, to: DEFAULT_LOC }],
    });
    const result = validateBuild(baseBuild([s1], { assemblies: [{ id: "a1" }] }));

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.ruleId === "S6" && w.severity === "strong")).toBe(
      true,
    );
  });

  it("warns (soft) when graph appears under-specified (H26)", () => {
    const a = step("a", 1, ActionFamily.PREP, { notes: "a" });
    const b = step("b", 2, ActionFamily.PREP, { notes: "b" });
    const c = step("c", 3, ActionFamily.PREP, {
      dependsOn: ["a"],
      notes: "c",
      input: [{ source: { type: "in_build", assemblyId: "a0" }, from: DEFAULT_LOC }],
    });
    const result = validateBuild(baseBuild([a, b, c]));
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.ruleId === "H26" && w.severity === "soft")).toBe(
      true,
    );
  });

  it("requires stationId when locations are ambiguous (H42)", () => {
    const ambiguousLoc = { sublocation: { type: "work_surface" as const } };
    const s1 = step("s1", 1, ActionFamily.PREP, {
      stationId: undefined,
      from: ambiguousLoc,
      to: ambiguousLoc,
      input: [{ source: { type: "in_build", assemblyId: "a0" }, from: ambiguousLoc }],
      output: [{ source: { type: "in_build", assemblyId: "a1" }, to: ambiguousLoc }],
    });
    const result = validateBuild(baseBuild([s1]));
    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H42")).toBe(true);
  });

  it("requires merge inputs to declare base/added roles (H29)", () => {
    const merge = step("m1", 1, ActionFamily.ASSEMBLE, {
      input: [
        { source: { type: "in_build", assemblyId: "a1" }, from: DEFAULT_LOC },
        { source: { type: "in_build", assemblyId: "b1" }, from: DEFAULT_LOC },
      ],
      output: [{ source: { type: "in_build", assemblyId: "c1" }, to: DEFAULT_LOC }],
    });
    const result = validateBuild(
      baseBuild([merge], { assemblies: [{ id: "a1" }, { id: "b1" }, { id: "c1" }] }),
    );
    expect(result.warnings.some((e) => e.ruleId === "H29")).toBe(true);
  });

  it("requires lineage on 1:1 transformations (H30)", () => {
    const evolve = step("e1", 1, ActionFamily.HEAT, {
      input: [{ source: { type: "in_build", assemblyId: "raw" }, from: DEFAULT_LOC }],
      output: [{ source: { type: "in_build", assemblyId: "cooked" }, to: DEFAULT_LOC }],
    });
    const result = validateBuild(
      baseBuild([evolve], {
        assemblies: [{ id: "raw" }, { id: "cooked" }],
      }),
    );
    expect(result.warnings.some((e) => e.ruleId === "H30")).toBe(true);
  });

  it("rejects authored TRANSFER steps (H38)", () => {
    const s1 = step("s1", 1, ActionFamily.TRANSFER);
    const result = validateBuild(baseBuild([s1]));
    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H38")).toBe(true);
  });

  it("warns when dependsOn exists without input (S20)", () => {
    const s1 = step("s1", 1, ActionFamily.PREP, { notes: "prep" });
    const s2 = step("s2", 2, ActionFamily.ASSEMBLE, { dependsOn: ["s1"], input: [] });
    const result = validateBuild(baseBuild([s1, s2]));
    expect(result.valid).toBe(true);
    expect(result.warnings.some((e) => e.ruleId === "S20")).toBe(true);
  });

  it("warns on material flow location mismatch (S22)", () => {
    const otherLoc = { stationId: "expo", sublocation: { type: "window_shelf" as const } };
    const s1 = step("s1", 1, ActionFamily.PREP, {
      notes: "prep",
      output: [{ source: { type: "in_build", assemblyId: "a1" }, to: DEFAULT_LOC }],
    });
    const s2 = step("s2", 2, ActionFamily.ASSEMBLE, {
      input: [{ source: { type: "in_build", assemblyId: "a1" }, from: otherLoc }],
    });
    const result = validateBuild(baseBuild([s1, s2]));
    expect(result.valid).toBe(true);
    // S22 for cross-station mismatches creates info-level warnings
    expect(result.infos.some((e) => e.ruleId === "S22")).toBe(true);
  });

  it("errors on material flow mismatch when published (H43)", () => {
    const otherLoc = { stationId: "expo", sublocation: { type: "window_shelf" as const } };
    const s1 = step("s1", 1, ActionFamily.PREP, {
      notes: "prep",
      output: [{ source: { type: "in_build", assemblyId: "a1" }, to: DEFAULT_LOC }],
    });
    const s2 = step("s2", 2, ActionFamily.ASSEMBLE, {
      input: [{ source: { type: "in_build", assemblyId: "a1" }, from: otherLoc }],
    });
    const result = validateBuild(baseBuild([s1, s2], { status: "published" }));
    expect(result.valid).toBe(false);
    expect(result.hardErrors.some((e) => e.ruleId === "H43")).toBe(true);
  });
});
