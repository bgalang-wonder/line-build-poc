/**
 * HDR Configuration Loader
 *
 * Utilities for loading and managing HDR pod configurations from JSON files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { HdrPodConfig } from "../../config/hdr-pod.mock";

// Resolve project root from this file's location
// This file is at: <root>/scripts/lib/hdrConfig.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const HDR_CONFIGS_DIR = path.join(PROJECT_ROOT, "data", "hdr-configs");
const ACTIVE_CONFIG_FILE = path.join(HDR_CONFIGS_DIR, ".active");

/**
 * Get the active HDR configuration ID.
 * Reads from data/hdr-configs/.active file.
 */
export function getActiveConfigId(): string {
  try {
    const activeData = fs.readFileSync(ACTIVE_CONFIG_FILE, "utf-8");
    const { activeConfigId } = JSON.parse(activeData);
    return activeConfigId;
  } catch (error) {
    console.warn("Failed to read active HDR config, using default: mock-11-pod");
    return "mock-11-pod";
  }
}

/**
 * Load an HDR configuration by ID.
 * Reads from data/hdr-configs/<configId>.json file.
 */
export function loadHdrConfig(configId: string): HdrPodConfig {
  const configPath = path.join(HDR_CONFIGS_DIR, `${configId}.json`);

  try {
    const configData = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(configData) as HdrPodConfig;
  } catch (error) {
    throw new Error(
      `Failed to load HDR config '${configId}' from ${configPath}: ${error}`
    );
  }
}

/**
 * Load the active HDR configuration.
 * Convenience function that combines getActiveConfigId() and loadHdrConfig().
 */
export function loadActiveHdrConfig(): HdrPodConfig {
  const activeId = getActiveConfigId();
  return loadHdrConfig(activeId);
}

/**
 * List all available HDR configurations.
 * Returns metadata for all .json files in data/hdr-configs/.
 */
export function listHdrConfigs(): Array<{
  hdrId: string;
  name: string;
  podCount: number;
  isActive: boolean;
}> {
  const activeId = getActiveConfigId();
  const files = fs.readdirSync(HDR_CONFIGS_DIR);

  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const configId = file.replace(".json", "");
      const config = loadHdrConfig(configId);
      return {
        hdrId: config.hdrId,
        name: config.name,
        podCount: config.pods.length,
        isActive: config.hdrId === activeId,
      };
    });
}

/**
 * Set the active HDR configuration.
 * Updates the .active file with the new config ID.
 */
export function setActiveHdrConfig(configId: string): void {
  // Verify the config exists before setting it as active
  loadHdrConfig(configId);

  const activeData = { activeConfigId: configId };
  fs.writeFileSync(ACTIVE_CONFIG_FILE, JSON.stringify(activeData, null, 2));
}

/**
 * Save an HDR configuration.
 * Writes to data/hdr-configs/<configId>.json file.
 */
export function saveHdrConfig(config: HdrPodConfig): void {
  const configPath = path.join(HDR_CONFIGS_DIR, `${config.hdrId}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
