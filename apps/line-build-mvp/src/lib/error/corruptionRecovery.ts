/**
 * JSON Corruption Recovery (benchtop-u2x)
 *
 * Handles detection and recovery from corrupted JSON files:
 * - Automatic detection of parse errors
 * - Backup restoration with fallback chain
 * - Corruption event logging
 * - User-facing recovery UI coordination
 */

import { LineBuild } from '../model/types';
import { LineBuildPersistence } from '../model/data/persistence';
import { errorLogger } from './errorRecovery';

export interface CorruptionEvent {
  id: string;
  timestamp: string;
  buildId: string;
  filename: string;
  error: string;
  recovered: boolean;
  recoverySource?: string; // 'backup' | 'user-provided' | 'manual-reset'
}

export interface RecoveryResult {
  success: boolean;
  build?: LineBuild;
  error?: string;
  source?: string;
  corruptionEvent?: CorruptionEvent;
}

/**
 * Manages corruption detection and recovery for JSON files
 */
class CorruptionRecoveryManager {
  private corruptionLog: CorruptionEvent[] = [];
  private maxLogSize = 50;
  private storageKey = 'line-build:corruption-log';
  private persistence: LineBuildPersistence;

  constructor() {
    this.persistence = LineBuildPersistence.getInstance();
    this.loadCorruptionLog();
  }

  private loadCorruptionLog() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.corruptionLog = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load corruption log from storage');
    }
  }

  private saveCorruptionLog() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.corruptionLog));
    } catch (e) {
      console.warn('Failed to save corruption log to storage');
    }
  }

  private addCorruptionEvent(event: Omit<CorruptionEvent, 'id'>) {
    const corruptionEvent: CorruptionEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...event,
    };

    this.corruptionLog.push(corruptionEvent);
    if (this.corruptionLog.length > this.maxLogSize) {
      this.corruptionLog = this.corruptionLog.slice(-this.maxLogSize);
    }

    this.saveCorruptionLog();
    return corruptionEvent;
  }

  /**
   * Attempt to recover a corrupted file
   * Returns recovery result with build data if successful
   */
  async attemptRecovery(buildId: string): Promise<RecoveryResult> {
    try {
      // Try to load the build (which will attempt backup recovery internally)
      const result = await this.persistence.load(buildId);

      // Log successful recovery
      const event = this.addCorruptionEvent({
        timestamp: new Date().toISOString(),
        buildId,
        filename: `${buildId}.json`,
        error: 'Attempted recovery',
        recovered: true,
        recoverySource: 'backup',
      });

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'info',
        component: 'CorruptionRecovery',
        message: `Successfully recovered ${buildId} from backup`,
        context: { corruptionEventId: event.id },
      });

      return {
        success: true,
        build: result.build,
        source: 'backup',
        corruptionEvent: event,
      };
    } catch (error) {
      const event = this.addCorruptionEvent({
        timestamp: new Date().toISOString(),
        buildId,
        filename: `${buildId}.json`,
        error: String(error),
        recovered: false,
      });

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'error',
        component: 'CorruptionRecovery',
        message: `Failed to recover ${buildId} from backup`,
        context: { error: String(error), corruptionEventId: event.id },
      });

      return {
        success: false,
        error: `Could not recover ${buildId}. Please check backups or contact support.`,
        corruptionEvent: event,
      };
    }
  }

  /**
   * List all available backups for a build
   */
  async listAvailableBackups(buildId: string): Promise<
    Array<{
      filename: string;
      timestamp: string;
    }>
  > {
    try {
      // This would require exposing listFiles or a getBackups method
      // For now, return empty array - will be enhanced with persistence method
      return [];
    } catch (error) {
      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'warning',
        component: 'CorruptionRecovery',
        message: `Failed to list backups for ${buildId}`,
        context: { error: String(error) },
      });
      return [];
    }
  }

  /**
   * Manually restore from a specific backup
   */
  async restoreFromBackup(
    buildId: string,
    backupFilename: string
  ): Promise<RecoveryResult> {
    try {
      // This would require a method in persistence to load from specific backup
      // Placeholder for now - will be enhanced with persistence method
      throw new Error('Restore from specific backup not yet implemented');
    } catch (error) {
      const event = this.addCorruptionEvent({
        timestamp: new Date().toISOString(),
        buildId,
        filename: backupFilename,
        error: String(error),
        recovered: false,
      });

      return {
        success: false,
        error: `Failed to restore from backup: ${String(error)}`,
        corruptionEvent: event,
      };
    }
  }

  /**
   * Reset corrupted file to initial empty state
   */
  async resetCorruptedFile(buildId: string): Promise<RecoveryResult> {
    try {
      // Create a new empty build (requires user input for menu item)
      const emptyBuild: LineBuild = {
        id: buildId,
        menuItemId: '',
        menuItemName: '',
        workUnits: [],
        metadata: {
          author: 'system',
          status: 'draft',
          version: 1,
          sourceConversations: [],
          changelog: [], // Initialize empty audit trail
        },
      };

      // Save the reset file
      await this.persistence.save(emptyBuild);

      const event = this.addCorruptionEvent({
        timestamp: new Date().toISOString(),
        buildId,
        filename: `${buildId}.json`,
        error: 'File was corrupted and reset to empty',
        recovered: true,
        recoverySource: 'manual-reset',
      });

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'info',
        component: 'CorruptionRecovery',
        message: `Reset ${buildId} to empty draft`,
        context: { corruptionEventId: event.id },
      });

      return {
        success: true,
        build: emptyBuild,
        source: 'manual-reset',
        corruptionEvent: event,
      };
    } catch (error) {
      const event = this.addCorruptionEvent({
        timestamp: new Date().toISOString(),
        buildId,
        filename: `${buildId}.json`,
        error: String(error),
        recovered: false,
      });

      return {
        success: false,
        error: `Failed to reset file: ${String(error)}`,
        corruptionEvent: event,
      };
    }
  }

  /**
   * Get corruption history for debugging
   */
  getCorruptionHistory(buildId?: string): CorruptionEvent[] {
    if (buildId) {
      return this.corruptionLog.filter((e) => e.buildId === buildId);
    }
    return this.corruptionLog;
  }

  /**
   * Clear corruption log
   */
  clearCorruptionLog() {
    this.corruptionLog = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const corruptionRecoveryManager = new CorruptionRecoveryManager();
