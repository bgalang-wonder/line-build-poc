import { describe, expect, it } from "vitest";
import { ActionFamily, type BenchTopLineBuild, type Step } from "./schema";
import { normalizeBuild } from "./normalize";

function baseBuild(steps: Step[], partial: Partial<BenchTopLineBuild> = {}): BenchTopLineBuild {
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

function step(id: string, orderIndex: number, family: ActionFamily, partial: Partial<Step> = {}): Step {
  return {
    id,
    orderIndex,
    action: { family },
    input: [],
    output: [],
    from: {},
    to: {},
    dependsOn: [],
    ...partial,
  };
}

describe("normalize.ts", () => {
  it("auto-creates assembly stubs", () => {
    const build = baseBuild([
      step("s1", 1, ActionFamily.PREP, {
        output: [{ source: { type: "in_build", assemblyId: "new-thing" } }]
      })
    ]);

    const normalized = normalizeBuild(build);
    expect(normalized.assemblies?.some(c => c.id === "new-thing")).toBe(true);
    expect(normalized.assemblies?.find(c => c.id === "new-thing")?.name).toBe("new-thing");
  });

  it("merges derived dependencies into dependsOn", () => {
    const build = baseBuild([
      step("s1", 1, ActionFamily.PREP, {
        output: [{ source: { type: "in_build", assemblyId: "a1" } }]
      }),
      step("s2", 2, ActionFamily.HEAT, {
        input: [{ source: { type: "in_build", assemblyId: "a1" } }],
        dependsOn: ["other-step"]
      }),
      step("other-step", 0, ActionFamily.PREP)
    ]);

    const normalized = normalizeBuild(build);
    const s2 = normalized.steps.find(s => s.id === "s2");
    expect(s2?.dependsOn).toContain("s1");
    expect(s2?.dependsOn).toContain("other-step");
    expect(s2?.dependsOn?.length).toBe(2);
  });

  it("fills default arrays for steps", () => {
    // Manually create a step missing optional arrays
    const rawStep = {
      id: "s1",
      orderIndex: 1,
      action: { family: ActionFamily.PREP }
    } as unknown as Step;

    const build = baseBuild([rawStep]);
    const normalized = normalizeBuild(build);

    expect(normalized.steps[0].input).toEqual([]);
    expect(normalized.steps[0].output).toEqual([]);
    expect(normalized.steps[0].dependsOn).toEqual([]);
  });

  it("sets lineage and input roles for evolution + merge steps", () => {
    const build = baseBuild(
      [
        step("s1", 1, ActionFamily.PREP, {
          output: [{ source: { type: "in_build", assemblyId: "a1" } }],
        }),
        step("s2", 2, ActionFamily.HEAT, {
          input: [{ source: { type: "in_build", assemblyId: "a1" } }],
          output: [{ source: { type: "in_build", assemblyId: "a2" } }],
        }),
        step("s3", 3, ActionFamily.ASSEMBLE, {
          input: [
            { source: { type: "in_build", assemblyId: "a2" } },
            { source: { type: "in_build", assemblyId: "b1" } },
          ],
          output: [{ source: { type: "in_build", assemblyId: "c1" } }],
        }),
      ],
      {
        assemblies: [
          { id: "a1", groupId: "quesadilla" },
          { id: "a2", groupId: "quesadilla" },
          { id: "b1", groupId: "cheese" },
          { id: "c1", groupId: "quesadilla" },
        ],
      },
    );

    const normalized = normalizeBuild(build);
    const a2 = normalized.assemblies?.find((c) => c.id === "a2");
    expect(a2?.lineage?.evolvesFrom).toBe("a1");

    const s2 = normalized.steps.find((s) => s.id === "s2");
    expect(s2?.input?.[0]?.role).toBe("base");

    const s3 = normalized.steps.find((s) => s.id === "s3");
    const roles = (s3?.input ?? []).map((r) => r.role).sort();
    expect(roles).toEqual(["added", "base"]);
  });
});
