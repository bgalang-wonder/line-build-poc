import { describe, expect, it } from "vitest";
import { ActionFamily, type BenchTopLineBuild, type Step } from "./schema";
import { deriveDependencies, computeAssemblyComponents, resolveLatestInGroup } from "./flow";

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
    ...partial,
  };
}

describe("flow.ts", () => {
  describe("deriveDependencies", () => {
    it("derives dependencies from material flow", () => {
      const s1 = step("s1", 1, ActionFamily.PREP, {
        output: [{ source: { type: "in_build", assemblyId: "a1" } }]
      });
      const s2 = step("s2", 2, ActionFamily.HEAT, {
        input: [{ source: { type: "in_build", assemblyId: "a1" } }]
      });

      const build = baseBuild([s1, s2]);
      const deps = deriveDependencies(build);

      expect(deps).toEqual([["s1", "s2"]]);
    });

    it("handles multiple inputs and outputs", () => {
      const s1 = step("s1", 1, ActionFamily.PREP, {
        output: [{ source: { type: "in_build", assemblyId: "a1" } }]
      });
      const s2 = step("s2", 2, ActionFamily.PREP, {
        output: [{ source: { type: "in_build", assemblyId: "a2" } }]
      });
      const s3 = step("s3", 3, ActionFamily.ASSEMBLE, {
        input: [
          { source: { type: "in_build", assemblyId: "a1" } },
          { source: { type: "in_build", assemblyId: "a2" } }
        ]
      });

      const build = baseBuild([s1, s2, s3]);
      const deps = deriveDependencies(build);

      expect(deps).toContainEqual(["s1", "s3"]);
      expect(deps).toContainEqual(["s2", "s3"]);
      expect(deps.length).toBe(2);
    });
  });

  describe("computeAssemblyComponents", () => {
    it("accumulates components through steps", () => {
      const build = baseBuild([
        step("s1", 1, ActionFamily.PREP, {
          output: [{ source: { type: "in_build", assemblyId: "tortilla" } }]
        }),
        step("s2", 2, ActionFamily.PREP, {
          output: [{ source: { type: "in_build", assemblyId: "cheese" } }]
        }),
        step("s3", 3, ActionFamily.COMBINE, {
          input: [
            { source: { type: "in_build", assemblyId: "tortilla" } },
            { source: { type: "in_build", assemblyId: "cheese" } }
          ],
          output: [{ source: { type: "in_build", assemblyId: "quesadilla_v1" } }]
        })
      ], {
        assemblies: [
          { id: "tortilla", bomUsageId: "bom_tortilla" },
          { id: "cheese", bomUsageId: "bom_cheese" }
        ]
      });

      const componentsMap = computeAssemblyComponents(build);

      expect(componentsMap.get("tortilla")).toEqual(["bom_tortilla"]);
      expect(componentsMap.get("cheese")).toEqual(["bom_cheese"]);
      expect(componentsMap.get("quesadilla_v1")).toEqual(expect.arrayContaining(["bom_tortilla", "bom_cheese"]));
    });
  });

  describe("resolveLatestInGroup", () => {
    it("finds the latest version in a group", () => {
      const build = baseBuild([
        step("s1", 1, ActionFamily.PREP, {
          output: [{ source: { type: "in_build", assemblyId: "q_v1" } }]
        }),
        step("s2", 2, ActionFamily.HEAT, {
          input: [{ source: { type: "in_build", assemblyId: "q_v1" } }],
          output: [{ source: { type: "in_build", assemblyId: "q_v2" } }]
        })
      ], {
        assemblies: [
          { id: "q_v1", groupId: "q" },
          { id: "q_v2", groupId: "q" }
        ]
      });

      expect(resolveLatestInGroup(build, "q")).toBe("q_v2");
    });
  });
});
