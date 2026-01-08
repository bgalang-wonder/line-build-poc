/**
 * JSON persistence layer for LineBuild objects
 * Supports save/load with conflict prevention and error recovery
 */

import { LineBuild } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface PersistenceOptions {
  dataDir?: string; // Optional custom data directory
  autoBackup?: boolean; // Enable automatic backups (default: true)
}

export interface SaveResult {
  id: string;
  timestamp: string;
  backupFile?: string;
}

export interface LoadResult {
  build: LineBuild;
  loadedAt: string;
}

// ============================================================================
// Persistence Manager
// ============================================================================

/**
 * Manages JSON persistence for LineBuild objects
 * Handles save, load, backup, and conflict prevention
 */
export class LineBuildPersistence {
  private dataDir: string;
  private autoBackup: boolean;

  constructor(options: PersistenceOptions = {}) {
    this.dataDir = options.dataDir || "data/line-builds";
    this.autoBackup = options.autoBackup !== false;
  }

  /**
   * Save a LineBuild to JSON
   * Creates timestamped backups to prevent conflicts
   * Ensures JSON is readable and debuggable with formatting
   */
  async save(build: LineBuild): Promise<SaveResult> {
    try {
      const timestamp = new Date().toISOString();
      const filename = `${build.id}.json`;

      // Prepare the data with metadata
      const persistedData = {
        ...build,
        _persisted: {
          savedAt: timestamp,
          version: 1,
        },
      };

      // Convert to readable JSON (2-space indent for debugging)
      const jsonContent = JSON.stringify(persistedData, null, 2);

      // Create backup if file exists and autoBackup is enabled
      let backupFile: string | undefined;
      if (this.autoBackup) {
        backupFile = await this.createBackup(filename);
      }

      // Write to file
      await this.writeFile(filename, jsonContent);

      return {
        id: build.id,
        timestamp,
        backupFile,
      };
    } catch (error) {
      throw new Error(`Failed to save LineBuild ${build.id}: ${String(error)}`);
    }
  }

  /**
   * Load a LineBuild from JSON by ID
   * Handles corrupted files gracefully with error recovery
   */
  async load(buildId: string): Promise<LoadResult> {
    try {
      const filename = `${buildId}.json`;
      const jsonContent = await this.readFile(filename);

      // Parse JSON with error handling
      let data: unknown;
      try {
        data = JSON.parse(jsonContent);
      } catch (parseError) {
        // If JSON is corrupted, try to recover from backup
        const recovered = await this.tryRecoverFromBackup(filename);
        if (recovered) {
          data = recovered;
        } else {
          throw new Error(
            `Failed to parse corrupted JSON in ${filename}: ${String(parseError)}`
          );
        }
      }

      // Validate that data is a LineBuild
      const build = this.validateLineBuild(data);

      return {
        build,
        loadedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to load LineBuild ${buildId}: ${String(error)}`
      );
    }
  }

  /**
   * Load all LineBuild files from data directory
   */
  async loadAll(): Promise<LineBuild[]> {
    try {
      const files = await this.listFiles();
      const builds: LineBuild[] = [];

      for (const file of files) {
        if (!file.endsWith(".json") || file.startsWith("_")) {
          continue;
        }

        try {
          const buildId = file.replace(".json", "");
          const result = await this.load(buildId);
          builds.push(result.build);
        } catch (error) {
          // Skip corrupted files and log the error
          console.warn(`Skipping corrupted file ${file}: ${String(error)}`);
        }
      }

      return builds;
    } catch (error) {
      throw new Error(`Failed to load all LineBuild files: ${String(error)}`);
    }
  }

  /**
   * Delete a LineBuild file (creates backup first)
   */
  async delete(buildId: string): Promise<string | undefined> {
    try {
      const filename = `${buildId}.json`;

      // Create backup before deletion
      let backupFile: string | undefined;
      if (this.autoBackup) {
        backupFile = await this.createBackup(filename);
      }

      // Delete file
      await this.deleteFile(filename);

      return backupFile;
    } catch (error) {
      throw new Error(`Failed to delete LineBuild ${buildId}: ${String(error)}`);
    }
  }

  /**
   * Check if a LineBuild file exists
   */
  async exists(buildId: string): Promise<boolean> {
    try {
      await this.readFile(`${buildId}.json`);
      return true;
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Private helper methods
  // ========================================================================

  /**
   * Create a timestamped backup of a file
   */
  private async createBackup(filename: string): Promise<string | undefined> {
    try {
      const content = await this.readFile(filename);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `${filename}.backup.${timestamp}`;
      await this.writeFile(backupName, content);
      return backupName;
    } catch {
      // File doesn't exist yet, no need to back up
      return undefined;
    }
  }

  /**
   * Attempt to recover corrupted JSON from backup
   */
  private async tryRecoverFromBackup(
    filename: string
  ): Promise<unknown | null> {
    try {
      // List all backup files for this filename
      const files = await this.listFiles();
      const backups = files.filter(
        (f) => f.startsWith(filename) && f.includes("backup")
      );

      if (backups.length === 0) {
        return null;
      }

      // Try to load the most recent backup
      backups.sort().reverse();
      for (const backup of backups) {
        try {
          const content = await this.readFile(backup);
          return JSON.parse(content);
        } catch {
          // Try next backup
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate that data conforms to LineBuild structure
   */
  private validateLineBuild(data: unknown): LineBuild {
    if (
      typeof data !== "object" ||
      data === null ||
      !("id" in data) ||
      !("menuItemId" in data) ||
      !("workUnits" in data) ||
      !("metadata" in data)
    ) {
      throw new Error("Invalid LineBuild structure");
    }

    // Remove persistence metadata if present
    const { _persisted, ...build } = data as Record<string, unknown>;

    return build as unknown as LineBuild;
  }

  /**
   * Write file to storage
   * In Node.js environment: use fs
   * In browser environment: use localStorage (fallback)
   */
  private async writeFile(filename: string, content: string): Promise<void> {
    if (typeof window === "undefined") {
      // Server-side: use fs
      const fs = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), this.dataDir);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      const filepath = path.join(dir, filename);
      await fs.writeFile(filepath, content, "utf-8");
    } else {
      // Client-side: use localStorage (with size limitations)
      const key = `linebuild:${filename}`;
      localStorage.setItem(key, content);
    }
  }

  /**
   * Read file from storage
   */
  private async readFile(filename: string): Promise<string> {
    if (typeof window === "undefined") {
      // Server-side: use fs
      const fs = await import("fs/promises");
      const path = await import("path");
      const filepath = path.join(process.cwd(), this.dataDir, filename);
      return await fs.readFile(filepath, "utf-8");
    } else {
      // Client-side: use localStorage
      const key = `linebuild:${filename}`;
      const content = localStorage.getItem(key);
      if (!content) {
        throw new Error(`File not found: ${filename}`);
      }
      return content;
    }
  }

  /**
   * Delete file from storage
   */
  private async deleteFile(filename: string): Promise<void> {
    if (typeof window === "undefined") {
      // Server-side: use fs
      const fs = await import("fs/promises");
      const path = await import("path");
      const filepath = path.join(process.cwd(), this.dataDir, filename);
      try {
        await fs.unlink(filepath);
      } catch (error) {
        // File doesn't exist, that's okay
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    } else {
      // Client-side: use localStorage
      const key = `linebuild:${filename}`;
      localStorage.removeItem(key);
    }
  }

  /**
   * List all files in data directory
   */
  private async listFiles(): Promise<string[]> {
    if (typeof window === "undefined") {
      // Server-side: use fs
      const fs = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), this.dataDir);

      try {
        return await fs.readdir(dir);
      } catch {
        // Directory doesn't exist yet
        return [];
      }
    } else {
      // Client-side: list localStorage keys
      const files: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("linebuild:")) {
          files.push(key.replace("linebuild:", ""));
        }
      }
      return files;
    }
  }
}

// ============================================================================
// Factory function for creating persistence instances
// ============================================================================

let persistenceInstance: LineBuildPersistence | null = null;

/**
 * Get or create the shared persistence instance
 */
export function getPersistence(
  options?: PersistenceOptions
): LineBuildPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new LineBuildPersistence(options);
  }
  return persistenceInstance;
}

/**
 * Create a new persistence instance (for testing)
 */
export function createPersistence(
  options?: PersistenceOptions
): LineBuildPersistence {
  return new LineBuildPersistence(options);
}
