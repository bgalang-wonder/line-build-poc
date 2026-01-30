/**
 * Build validation engine.
 *
 * This file re-exports all validation functionality from the modular validate/ directory.
 * See validate/index.ts for the full implementation.
 *
 * Rules are organized by category:
 * - validate/hard-rules.ts: H1-H18 (core structural rules)
 * - validate/hard-rules-advanced.ts: H19-H37 (customization, transfer, station rules)
 * - validate/composition-rules.ts: C1-C3 (build composition)
 * - validate/soft-rules.ts: S6-S19 and strong warnings
 * - validate/helpers.ts: Shared utilities
 */

export * from "./validate/index";
