/**
 * Legacy Line Build Connector
 *
 * Parses legacy line build data from JSON/BigQuery and normalizes to internal format.
 * This is Phase 1 (MVP) - reads from JSON files.
 * Phase 2 will extend to BigQuery reader for production data.
 */

import { readFileSync } from 'fs';

export type LegacyActivityType = 'GARNISH' | 'COOK' | 'COMPLETE' | 'VEND';

export interface LegacyProcedureStep {
  id?: string;
  activity_type: LegacyActivityType;
  sub_steps_title: string; // Free text instructions (99.99% populated)
  related_item_number?: string; // BOM reference (10.6% populated)
  appliance_config_id?: string; // Equipment config (24.1% populated)
  customization_option_id?: string; // Customization (53.7% populated)
}

export interface LegacyLineBuild {
  item_id: string;
  item_name: string;
  procedures: LegacyProcedureStep[];
  location?: string; // Optional: location variant identifier
  variant_id?: string; // Optional: variant identifier
}

export interface NormalizedLegacyItem {
  sourceId: string;
  itemId: string;
  itemName: string;
  location?: string;
  variantId?: string;
  steps: LegacyProcedureStep[];
  metadata: {
    source: 'json' | 'bigquery';
    loadedAt: string;
  };
}

/**
 * Connects to legacy line build data sources
 */
export class LegacyLineBuildConnector {
  /**
   * Load legacy line builds from JSON file
   * Format: array of LegacyLineBuild objects
   */
  async loadFromJSON(jsonPath: string): Promise<NormalizedLegacyItem[]> {
    try {
      const raw = readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);

      // Handle both array and wrapped format
      const items = Array.isArray(data) ? data : data.items || [];

      return items.map((item: any, index: number) =>
        this.normalize(item, index, 'json')
      );
    } catch (error) {
      throw new Error(
        `Failed to load legacy line builds from ${jsonPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Normalize raw legacy item to internal format
   */
  private normalize(
    raw: any,
    index: number,
    source: 'json' | 'bigquery'
  ): NormalizedLegacyItem {
    const procedures = Array.isArray(raw.procedures)
      ? raw.procedures
      : raw.line_builds?.[0]?.tasks?.[0]?.procedures || [];

    return {
      sourceId: raw.item_id || `legacy-${index}`,
      itemId: raw.item_id || `item-${index}`,
      itemName: raw.item_name || 'Unknown Item',
      location: raw.location,
      variantId: raw.variant_id,
      steps: this.normalizeProcedures(procedures),
      metadata: {
        source,
        loadedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Normalize procedure array, flatten if nested
   */
  private normalizeProcedures(procedures: any[]): LegacyProcedureStep[] {
    return procedures
      .flatMap((proc: any) => {
        // Handle nested procedure_steps
        if (proc.procedure_steps && Array.isArray(proc.procedure_steps)) {
          return proc.procedure_steps.map((step: any, idx: number) => ({
            id: step.id || `step-${idx}`,
            activity_type: step.activity_type || proc.activity_type || 'GARNISH',
            sub_steps_title: step.sub_steps_title || step.title || '',
            related_item_number: step.related_item_number,
            appliance_config_id: step.appliance_config_id,
            customization_option_id: step.customization_option_id,
          }));
        }

        // Handle flat procedure format
        return {
          id: proc.id || `proc-${Math.random().toString(36).slice(2, 9)}`,
          activity_type: proc.activity_type || 'GARNISH',
          sub_steps_title: proc.sub_steps_title || proc.title || '',
          related_item_number: proc.related_item_number,
          appliance_config_id: proc.appliance_config_id,
          customization_option_id: proc.customization_option_id,
        };
      })
      .filter((step: any) => step.sub_steps_title?.trim().length > 0); // Skip empty steps
  }

  /**
   * Batch reader for large-scale migration
   * (Phase 2: extend with BigQuery cursor support)
   */
  async readBatch(
    items: NormalizedLegacyItem[],
    startIndex: number,
    batchSize: number
  ): Promise<NormalizedLegacyItem[]> {
    return items.slice(startIndex, startIndex + batchSize);
  }

  /**
   * Validate legacy data quality
   */
  validateItem(item: NormalizedLegacyItem): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (!item.itemId) warnings.push('Missing item_id');
    if (!item.itemName) warnings.push('Missing item_name');
    if (item.steps.length === 0) warnings.push('No procedures found');

    // Check for common issues
    const unstructuredCount = item.steps.filter(
      (s) => !s.related_item_number
    ).length;
    if (unstructuredCount === item.steps.length) {
      warnings.push('All steps are free text (no BOM references)');
    }

    return {
      valid: !!(item.itemId && item.itemName && item.steps.length > 0),
      warnings,
    };
  }
}
