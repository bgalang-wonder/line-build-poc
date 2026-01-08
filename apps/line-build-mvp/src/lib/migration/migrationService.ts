/**
 * Migration Service Orchestrator
 *
 * Coordinates the complete migration workflow:
 * 1. Load legacy data
 * 2. Convert to modern format
 * 3. Validate all conversions
 * 4. Route: auto-accept or review queue
 *
 * P1.8 Implementation: End-to-end orchestration
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MigrationJob,
  MigrationResult,
  LineBuild,
} from '../model/types';
import { LegacyLineBuildConnector, NormalizedLegacyItem } from './legacyConnector';
import { LegacyMapper, LegacyMapperOptions } from './legacyMapper';
import { MigrationValidator } from './migrationValidator';

// ============================================================================
// Migration Options
// ============================================================================

export interface MigrationOptions extends LegacyMapperOptions {
  confidenceThreshold?: 'high' | 'medium' | 'low';
  skipValidation?: boolean;
}

// ============================================================================
// Migration Service Implementation
// ============================================================================

export class MigrationService {
  private connector: LegacyLineBuildConnector;
  private mapper: LegacyMapper;
  private validator: MigrationValidator;

  constructor() {
    this.connector = new LegacyLineBuildConnector();
    this.mapper = new LegacyMapper();
    this.validator = new MigrationValidator();
  }

  /**
   * Main entry point: import and convert legacy line builds
   *
   * Orchestrates complete workflow:
   * 1. Load from JSON
   * 2. Batch convert
   * 3. Validate all
   * 4. Route to storage or review queue
   */
  async importAndConvert(
    jsonPath: string,
    options: MigrationOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<MigrationJob> {
    const jobId = uuidv4();
    const startTime = new Date().toISOString();

    try {
      // Step 1: Load legacy data
      const legacyBuilds = await this.connector.loadFromJSON(jsonPath);

      // Step 2: Create migration job
      const job: MigrationJob = {
        id: jobId,
        legacyBuildCount: legacyBuilds.length,
        convertedCount: 0,
        reviewQueueCount: 0,
        failedCount: 0,
        status: 'in_progress',
        startedAt: startTime,
        results: [],
      };

      // Step 3: Batch convert with progress tracking
      const thresholdMap = { high: 85, medium: 70, low: 50 };
      const threshold = thresholdMap[options.confidenceThreshold || 'high'];

      const allResults = await this.mapper.convertBatch(legacyBuilds, options);

      // Step 4: Validate and route each result
      for (let i = 0; i < allResults.length; i++) {
        const result = allResults[i];

        // Validate conversion
        if (!options.skipValidation) {
          const issues = this.validator.validate(result, threshold);
          result.issues.push(...issues);
        }

        // Route based on validation result
        if (this.validator.shouldAutoAccept(result, threshold)) {
          result.status = 'success';
          job.convertedCount++;
        } else {
          result.status = 'review_needed';
          job.reviewQueueCount++;
        }

        job.results.push(result);

        // Progress callback
        if (onProgress) {
          onProgress(i + 1, allResults.length);
        }
      }

      // Step 5: Complete job
      job.status = 'complete';
      job.completedAt = new Date().toISOString();

      return job;
    } catch (error) {
      return {
        id: jobId,
        legacyBuildCount: 0,
        convertedCount: 0,
        reviewQueueCount: 0,
        failedCount: 1,
        status: 'failed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        results: [],
        error:
          error instanceof Error ? error.message : 'Unknown migration error',
      };
    }
  }

  /**
   * Approve and store a migration result
   *
   * Converts MigrationResult to LineBuild and saves
   */
  convertResultToLineBuild(result: MigrationResult, menuItemId: string): LineBuild {
    return {
      id: uuidv4(),
      menuItemId,
      menuItemName: result.itemName,
      workUnits: result.workUnits,
      metadata: {
        author: 'migration',
        version: 1,
        status: 'draft',
        sourceConversations: [
          `Migrated from legacy item: ${result.legacyItemId}`,
        ],
      },
    };
  }

  /**
   * Get migration job summary
   */
  getJobSummary(job: MigrationJob): {
    total: number;
    success: number;
    reviewNeeded: number;
    failed: number;
    successRate: string;
  } {
    return {
      total: job.legacyBuildCount,
      success: job.convertedCount,
      reviewNeeded: job.reviewQueueCount,
      failed: job.failedCount,
      successRate: `${((job.convertedCount / job.legacyBuildCount) * 100).toFixed(1)}%`,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let migrationServiceInstance: MigrationService | null = null;

/**
 * Get or create migration service singleton
 */
export function getMigrationService(): MigrationService {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new MigrationService();
  }
  return migrationServiceInstance;
}
