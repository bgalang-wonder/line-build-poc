/**
 * Draft/Active Status Manager
 * Handles state transitions for LineBuild status with validation constraints
 */

import { LineBuild, BuildValidationStatus } from "../types";

// ============================================================================
// Types
// ============================================================================

export type BuildStatus = "draft" | "active";

export interface StatusTransitionResult {
  success: boolean;
  newStatus: BuildStatus;
  reason?: string; // Explanation if transition was blocked
  timestamp: string;
}

// ============================================================================
// Status Manager
// ============================================================================

/**
 * Manages draft/active status transitions for line builds
 * Enforces rules: Draft→Active requires no validation failures, Active→Draft always allowed
 */
export class BuildStatusManager {
  /**
   * Check if a transition is allowed
   * Returns true if the transition can proceed, false if blocked
   */
  static canTransition(
    currentStatus: BuildStatus,
    targetStatus: BuildStatus,
    validationStatus?: BuildValidationStatus | null
  ): boolean {
    // Same status, no transition needed
    if (currentStatus === targetStatus) {
      return false;
    }

    // Active → Draft always allowed
    if (currentStatus === "active" && targetStatus === "draft") {
      return true;
    }

    // Draft → Active only allowed if no validation failures
    if (currentStatus === "draft" && targetStatus === "active") {
      if (!validationStatus) {
        // No validation run yet, block transition
        return false;
      }

      // Block if there are any failures
      return !validationStatus.hasStructuredFailures && !validationStatus.hasSemanticFailures;
    }

    return false;
  }

  /**
   * Attempt to transition to a new status
   * Returns transition result with reason if blocked
   */
  static transitionTo(
    currentStatus: BuildStatus,
    targetStatus: BuildStatus,
    validationStatus?: BuildValidationStatus | null
  ): StatusTransitionResult {
    const timestamp = new Date().toISOString();

    // Same status, no transition
    if (currentStatus === targetStatus) {
      return {
        success: false,
        newStatus: currentStatus,
        reason: "Already in target status",
        timestamp,
      };
    }

    // Active → Draft always allowed
    if (currentStatus === "active" && targetStatus === "draft") {
      return {
        success: true,
        newStatus: "draft",
        timestamp,
      };
    }

    // Draft → Active: check validation
    if (currentStatus === "draft" && targetStatus === "active") {
      if (!validationStatus) {
        return {
          success: false,
          newStatus: "draft",
          reason: "Cannot transition to active: No validation results. Run validation first.",
          timestamp,
        };
      }

      if (validationStatus.hasStructuredFailures) {
        return {
          success: false,
          newStatus: "draft",
          reason: `Cannot transition to active: ${validationStatus.failureCount} structured validation failure(s) found`,
          timestamp,
        };
      }

      if (validationStatus.hasSemanticFailures) {
        return {
          success: false,
          newStatus: "draft",
          reason: `Cannot transition to active: ${validationStatus.failureCount} semantic validation failure(s) found`,
          timestamp,
        };
      }

      // All validation passed
      return {
        success: true,
        newStatus: "active",
        timestamp,
      };
    }

    // Invalid transition
    return {
      success: false,
      newStatus: currentStatus,
      reason: `Invalid transition from ${currentStatus} to ${targetStatus}`,
      timestamp,
    };
  }

  /**
   * Apply status transition to a LineBuild
   * Returns updated LineBuild if transition succeeds
   */
  static applyTransition(
    build: LineBuild,
    targetStatus: BuildStatus,
    validationStatus?: BuildValidationStatus | null
  ): { build: LineBuild; result: StatusTransitionResult } {
    const result = this.transitionTo(
      build.metadata.status,
      targetStatus,
      validationStatus
    );

    if (result.success) {
      return {
        build: {
          ...build,
          metadata: {
            ...build.metadata,
            status: result.newStatus,
          },
        },
        result,
      };
    }

    // Transition failed, return unchanged build
    return {
      build,
      result,
    };
  }

  /**
   * Get human-readable status label
   */
  static getStatusLabel(status: BuildStatus): string {
    switch (status) {
      case "draft":
        return "Draft";
      case "active":
        return "Active";
      default:
        return status;
    }
  }

  /**
   * Get status description for UI display
   */
  static getStatusDescription(
    status: BuildStatus,
    validationStatus?: BuildValidationStatus | null
  ): string {
    switch (status) {
      case "draft":
        return validationStatus
          ? `Draft (${validationStatus.failureCount} validation issue${validationStatus.failureCount !== 1 ? "s" : ""})`
          : "Draft";
      case "active":
        return "Active";
      default:
        return status;
    }
  }

  /**
   * Check if status is editable
   * Draft can be edited freely, Active requires demotion to draft first
   */
  static isEditableStatus(status: BuildStatus): boolean {
    return status === "draft";
  }

  /**
   * Get suggested next action based on current status
   */
  static getSuggestedAction(
    status: BuildStatus,
    validationStatus?: BuildValidationStatus | null
  ): string {
    if (status === "draft") {
      if (!validationStatus) {
        return "Run validation to check for issues";
      }
      if (validationStatus.failureCount === 0) {
        return "Ready to activate - all validations passed";
      }
      return `Fix ${validationStatus.failureCount} validation issue${validationStatus.failureCount !== 1 ? "s" : ""} before activating`;
    }

    if (status === "active") {
      return "Demote to draft to make edits";
    }

    return "";
  }
}

// ============================================================================
// Status Helper Functions
// ============================================================================

/**
 * Initialize LineBuild with default status
 */
export function createDefaultStatus(): BuildStatus {
  return "draft";
}

/**
 * Check if a status change requires validation
 */
export function requiresValidationForTransition(
  fromStatus: BuildStatus,
  toStatus: BuildStatus
): boolean {
  return fromStatus === "draft" && toStatus === "active";
}

/**
 * Get all possible transitions from current status
 */
export function getPossibleTransitions(
  currentStatus: BuildStatus
): BuildStatus[] {
  if (currentStatus === "draft") {
    return ["active"];
  }
  if (currentStatus === "active") {
    return ["draft"];
  }
  return [];
}
