/**
 * JSON persistence layer for ValidationRule objects
 * Handles save, load, update, delete of structured and semantic validation rules
 */

import {
  ValidationRule,
  StructuredValidationRule,
  SemanticValidationRule,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface RulesPersistenceOptions {
  dataDir?: string; // Optional custom data directory
  autoBackup?: boolean; // Enable automatic backups (default: true)
}

export interface SaveRuleResult {
  ruleId: string;
  timestamp: string;
}

export interface LoadRulesResult {
  rules: ValidationRule[];
  loadedAt: string;
}

// ============================================================================
// Rules Persistence Manager
// ============================================================================

/**
 * Manages JSON persistence for ValidationRule objects
 * Supports save, load, update, delete, and load-all operations
 */
export class ValidationRulesPersistence {
  private dataDir: string;
  private autoBackup: boolean;
  private rulesFile = "validation-rules.json";

  constructor(options: RulesPersistenceOptions = {}) {
    this.dataDir = options.dataDir || "data/validation-rules";
    this.autoBackup = options.autoBackup !== false;
  }

  /**
   * Save a single ValidationRule to the rules collection
   */
  async saveRule(rule: ValidationRule): Promise<SaveRuleResult> {
    try {
      const timestamp = new Date().toISOString();

      // Load existing rules
      let rules: ValidationRule[] = [];
      try {
        const result = await this.loadAll();
        rules = result.rules;
      } catch {
        // File doesn't exist yet, start with empty array
        rules = [];
      }

      // Find and replace existing rule, or add new one
      const existingIndex = rules.findIndex((r) => r.id === rule.id);
      if (existingIndex >= 0) {
        rules[existingIndex] = rule;
      } else {
        rules.push(rule);
      }

      // Persist updated rules collection
      await this.persistRules(rules);

      return {
        ruleId: rule.id,
        timestamp,
      };
    } catch (error) {
      throw new Error(
        `Failed to save ValidationRule ${rule.id}: ${String(error)}`
      );
    }
  }

  /**
   * Save multiple ValidationRules at once
   */
  async saveRules(rules: ValidationRule[]): Promise<SaveRuleResult[]> {
    try {
      const timestamp = new Date().toISOString();

      // Load existing rules
      let existingRules: ValidationRule[] = [];
      try {
        const result = await this.loadAll();
        existingRules = result.rules;
      } catch {
        // File doesn't exist yet
        existingRules = [];
      }

      // Merge: replace existing rules by ID, append new ones
      const existingIds = new Set(existingRules.map((r) => r.id));
      const newRules = rules.filter((r) => !existingIds.has(r.id));
      const updatedRules = rules.filter((r) => existingIds.has(r.id));

      const merged = [
        ...existingRules.map((r) => updatedRules.find((u) => u.id === r.id) || r),
        ...newRules,
      ];

      // Persist merged rules collection
      await this.persistRules(merged);

      return rules.map((rule) => ({
        ruleId: rule.id,
        timestamp,
      }));
    } catch (error) {
      throw new Error(`Failed to save ValidationRules: ${String(error)}`);
    }
  }

  /**
   * Load all ValidationRules from JSON
   */
  async loadAll(): Promise<LoadRulesResult> {
    try {
      const jsonContent = await this.readFile(this.rulesFile);

      // Parse JSON with error handling
      let data: unknown;
      try {
        data = JSON.parse(jsonContent);
      } catch (parseError) {
        // If JSON is corrupted, try to recover from backup
        const recovered = await this.tryRecoverFromBackup(this.rulesFile);
        if (recovered) {
          data = recovered;
        } else {
          throw new Error(
            `Failed to parse corrupted JSON in ${this.rulesFile}: ${String(parseError)}`
          );
        }
      }

      // Validate that data is an array of ValidationRules
      const rules = this.validateRulesArray(data);

      return {
        rules,
        loadedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to load ValidationRules: ${String(error)}`
      );
    }
  }

  /**
   * Load a specific rule by ID
   */
  async loadRule(ruleId: string): Promise<ValidationRule | undefined> {
    try {
      const result = await this.loadAll();
      return result.rules.find((r) => r.id === ruleId);
    } catch (error) {
      throw new Error(
        `Failed to load ValidationRule ${ruleId}: ${String(error)}`
      );
    }
  }

  /**
   * Load rules by type (structured or semantic)
   */
  async loadRulesByType(
    type: "structured" | "semantic"
  ): Promise<ValidationRule[]> {
    try {
      const result = await this.loadAll();
      return result.rules.filter((r) => r.type === type);
    } catch (error) {
      throw new Error(
        `Failed to load ${type} ValidationRules: ${String(error)}`
      );
    }
  }

  /**
   * Update a rule (by ID)
   */
  async updateRule(ruleId: string, updates: Partial<ValidationRule>): Promise<void> {
    try {
      const result = await this.loadAll();
      const ruleIndex = result.rules.findIndex((r) => r.id === ruleId);

      if (ruleIndex < 0) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      // Merge updates with existing rule (but keep ID)
      result.rules[ruleIndex] = {
        ...result.rules[ruleIndex],
        ...updates,
        id: ruleId, // Ensure ID doesn't change
      } as ValidationRule;

      await this.persistRules(result.rules);
    } catch (error) {
      throw new Error(
        `Failed to update ValidationRule ${ruleId}: ${String(error)}`
      );
    }
  }

  /**
   * Delete a rule by ID
   */
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const result = await this.loadAll();
      const filtered = result.rules.filter((r) => r.id !== ruleId);

      if (filtered.length === result.rules.length) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      await this.persistRules(filtered);
    } catch (error) {
      throw new Error(
        `Failed to delete ValidationRule ${ruleId}: ${String(error)}`
      );
    }
  }

  /**
   * Check if rules file exists
   */
  async exists(): Promise<boolean> {
    try {
      await this.readFile(this.rulesFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all rules (delete the file)
   */
  async clear(): Promise<void> {
    try {
      await this.deleteFile(this.rulesFile);
    } catch (error) {
      throw new Error(`Failed to clear ValidationRules: ${String(error)}`);
    }
  }

  // ========================================================================
  // Private helper methods
  // ========================================================================

  /**
   * Persist rules collection to JSON
   */
  private async persistRules(rules: ValidationRule[]): Promise<void> {
    try {
      // Create backup of existing file if autoBackup enabled
      if (this.autoBackup) {
        await this.createBackup(this.rulesFile);
      }

      // Prepare data with metadata
      const persistedData = {
        rules,
        _metadata: {
          savedAt: new Date().toISOString(),
          version: 1,
          ruleCount: rules.length,
        },
      };

      // Convert to readable JSON (2-space indent)
      const jsonContent = JSON.stringify(persistedData, null, 2);

      // Write to file
      await this.writeFile(this.rulesFile, jsonContent);
    } catch (error) {
      throw new Error(`Failed to persist ValidationRules: ${String(error)}`);
    }
  }

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
  private async tryRecoverFromBackup(filename: string): Promise<unknown | null> {
    try {
      const files = await this.listFiles();
      const backups = files.filter(
        (f) => f.startsWith(filename) && f.includes("backup")
      );

      if (backups.length === 0) {
        return null;
      }

      // Try most recent backup first
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
   * Validate that data is an array of ValidationRules
   */
  private validateRulesArray(data: unknown): ValidationRule[] {
    // Handle both direct array and {rules: [...]} wrapper
    let rulesArray: unknown[];

    if (Array.isArray(data)) {
      rulesArray = data;
    } else if (
      typeof data === "object" &&
      data !== null &&
      "rules" in data &&
      Array.isArray((data as Record<string, unknown>).rules)
    ) {
      rulesArray = (data as Record<string, unknown>).rules as unknown[];
    } else {
      throw new Error("Invalid ValidationRules structure");
    }

    // Validate each rule
    return rulesArray.map((item, index) => {
      if (!this.isValidationRule(item)) {
        throw new Error(`Invalid ValidationRule at index ${index}`);
      }
      return item as ValidationRule;
    });
  }

  /**
   * Type guard for ValidationRule
   */
  private isValidationRule(obj: unknown): obj is ValidationRule {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    const rule = obj as Record<string, unknown>;

    // Common fields
    if (
      typeof rule.id !== "string" ||
      typeof rule.type !== "string" ||
      typeof rule.name !== "string" ||
      typeof rule.enabled !== "boolean"
    ) {
      return false;
    }

    // Type-specific validation
    if (rule.type === "structured") {
      return (
        typeof rule.condition === "object" &&
        rule.condition !== null &&
        typeof rule.failureMessage === "string"
      );
    } else if (rule.type === "semantic") {
      return typeof rule.prompt === "string";
    }

    return false;
  }

  /**
   * Write file to storage
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
      // Client-side: use localStorage
      const key = `valrules:${filename}`;
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
      const key = `valrules:${filename}`;
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
      const key = `valrules:${filename}`;
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
        if (key?.startsWith("valrules:")) {
          files.push(key.replace("valrules:", ""));
        }
      }
      return files;
    }
  }
}

// ============================================================================
// Factory function
// ============================================================================

let rulesPersistenceInstance: ValidationRulesPersistence | null = null;

/**
 * Get or create the shared rules persistence instance
 */
export function getRulesPersistence(
  options?: RulesPersistenceOptions
): ValidationRulesPersistence {
  if (!rulesPersistenceInstance) {
    rulesPersistenceInstance = new ValidationRulesPersistence(options);
  }
  return rulesPersistenceInstance;
}

/**
 * Create a new rules persistence instance (for testing)
 */
export function createRulesPersistence(
  options?: RulesPersistenceOptions
): ValidationRulesPersistence {
  return new ValidationRulesPersistence(options);
}
