import * as path from "node:path";

const ENV_VAR = "LINE_BUILD_POC_DATA_DIR";

/**
 * Resolve the data root directory, honoring LINE_BUILD_POC_DATA_DIR when set.
 * Defaults to the repo-relative ../data when run inside viewer/.
 */
export function resolveDataRoot(): string {
  const envOverride = process.env[ENV_VAR];
  if (typeof envOverride === "string" && envOverride.trim().length > 0) {
    return path.resolve(envOverride.trim());
  }
  return path.resolve(process.cwd(), "../data");
}

export function resolveBuildsDir(): string {
  return path.join(resolveDataRoot(), "line-builds");
}

export function resolveValidationDir(): string {
  return path.join(resolveDataRoot(), "validation");
}

export function resolveDerivedDir(): string {
  return path.join(resolveDataRoot(), "derived");
}

export function resolveSelectionPath(): string {
  return path.join(resolveDataRoot(), "viewer", "selection.json");
}
