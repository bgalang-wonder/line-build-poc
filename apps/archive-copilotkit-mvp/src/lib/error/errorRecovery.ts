/**
 * Error Recovery Service (benchtop-oqi)
 *
 * Handles app-level error recovery for:
 * - State corruption (reset to last-known-good)
 * - API errors during load/save (retry with exponential backoff)
 * - Network timeouts
 * - CopilotKit connection failures
 * - Persistent error logging for debugging
 */

import { LineBuild } from '../model/types';

// ============================================================================
// Error Types and Logging
// ============================================================================

export interface ErrorLog {
  id: string;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * In-memory error log (persisted to localStorage for debugging)
 */
class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;
  private storageKey = 'line-build:error-logs';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load error logs from storage');
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to save error logs to storage');
    }
  }

  log(entry: Omit<ErrorLog, 'id'>) {
    const log: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...entry,
    };

    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.saveToStorage();

    // Also log to console for development
    console.error(`[${log.severity}] ${log.component}: ${log.message}`, log.context);
  }

  getLogs(filter?: { component?: string; severity?: string }) {
    if (!filter) return this.logs;

    return this.logs.filter((log) => {
      if (filter.component && log.component !== filter.component) return false;
      if (filter.severity && log.severity !== filter.severity) return false;
      return true;
    });
  }

  clear() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const errorLogger = new ErrorLogger();

// ============================================================================
// State Recovery
// ============================================================================

interface StateSnapshot {
  build: LineBuild | null;
  timestamp: string;
}

/**
 * Manages last-known-good state for recovery
 */
class StateSnapshotManager {
  private snapshot: StateSnapshot | null = null;
  private storageKey = 'line-build:state-snapshot';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.snapshot = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load state snapshot from storage');
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.snapshot));
    } catch (e) {
      console.warn('Failed to save state snapshot to storage');
    }
  }

  /**
   * Save current state as recovery point
   */
  saveSnapshot(build: LineBuild | null) {
    this.snapshot = {
      build,
      timestamp: new Date().toISOString(),
    };
    this.saveToStorage();
  }

  /**
   * Get last-known-good state
   */
  getSnapshot(): StateSnapshot | null {
    return this.snapshot;
  }

  /**
   * Clear snapshot (after successful recovery)
   */
  clear() {
    this.snapshot = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const stateSnapshotManager = new StateSnapshotManager();

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors and timeouts, not on validation errors
    if (error?.code === 'ECONNREFUSED') return true;
    if (error?.message?.includes('timeout')) return true;
    if (error?.message?.includes('Network')) return true;
    if (error?.status >= 500) return true; // Retry 5xx errors
    return false;
  },
};

/**
 * Execute async function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts) {
        break;
      }

      if (!opts.shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'warning',
        component: 'RetryLogic',
        message: `Retry attempt ${attempt}/${opts.maxAttempts} after ${delayMs}ms`,
        context: { error: String(error) },
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// ============================================================================
// CopilotKit Error Handling
// ============================================================================

export interface CopilotKitError {
  type: 'connection' | 'timeout' | 'malformed-response' | 'other';
  message: string;
  originalError?: any;
}

/**
 * Track CopilotKit connection state
 */
class CopilotKitConnectionManager {
  private isConnected = true;
  private connectionErrorCount = 0;
  private maxConsecutiveErrors = 3;
  private listeners: Set<(connected: boolean) => void> = new Set();

  onConnectionChange(listener: (connected: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.isConnected));
  }

  recordError(error: CopilotKitError) {
    this.connectionErrorCount++;

    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: this.connectionErrorCount >= this.maxConsecutiveErrors ? 'error' : 'warning',
      component: 'CopilotKit',
      message: `Connection error (${this.connectionErrorCount}/${this.maxConsecutiveErrors}): ${error.message}`,
      context: { errorType: error.type },
    });

    if (this.connectionErrorCount >= this.maxConsecutiveErrors) {
      this.setConnected(false);
    }
  }

  recordSuccess() {
    this.connectionErrorCount = 0;
    if (!this.isConnected) {
      this.setConnected(true);
    }
  }

  private setConnected(connected: boolean) {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.notifyListeners();
    }
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}

export const copilotKitConnectionManager = new CopilotKitConnectionManager();

// ============================================================================
// Global Error Recovery
// ============================================================================

export interface ErrorRecoveryOptions {
  onStateCorruption?: (snapshot: StateSnapshot | null) => void;
  onNetworkError?: (error: any) => void;
  onCopilotKitError?: (error: CopilotKitError) => void;
}

/**
 * Global error recovery handler
 */
export class ErrorRecoveryManager {
  private options: ErrorRecoveryOptions;

  constructor(options?: ErrorRecoveryOptions) {
    this.options = options || {};
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'error',
        component: 'GlobalErrorHandler',
        message: `Unhandled promise rejection: ${String(error)}`,
        stack: error?.stack,
        context: { error },
      });

      // If it's a persistence/API error, attempt recovery
      if (this.isRecoverableError(error)) {
        const snapshot = stateSnapshotManager.getSnapshot();
        this.options.onStateCorruption?.(snapshot);
      }
    });

    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'error',
        component: 'GlobalErrorHandler',
        message: `Unhandled error: ${event.message}`,
        stack: event.error?.stack,
      });
    });
  }

  private isRecoverableError(error: any): boolean {
    if (!error) return false;
    if (error.message?.includes('persist')) return true;
    if (error.message?.includes('load')) return true;
    if (error.message?.includes('save')) return true;
    if (error.message?.includes('corrupt')) return true;
    return false;
  }

  /**
   * Recover from state corruption by restoring last-known-good state
   */
  async recoverFromStateCorruption(onRestore: (build: LineBuild | null) => void): Promise<boolean> {
    const snapshot = stateSnapshotManager.getSnapshot();

    if (!snapshot) {
      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'warning',
        component: 'ErrorRecovery',
        message: 'No state snapshot available for recovery',
      });
      return false;
    }

    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'info',
      component: 'ErrorRecovery',
      message: 'Recovering state from snapshot',
      context: { snapshotTime: snapshot.timestamp },
    });

    // Restore the state
    onRestore(snapshot.build);

    // Clear the snapshot after recovery
    stateSnapshotManager.clear();

    return true;
  }

  /**
   * Handle API errors with user-friendly messages
   */
  handleApiError(error: any, context: string): string {
    let message = 'An error occurred';

    if (error?.message?.includes('Network')) {
      message = 'Network error. Please check your connection and try again.';
    } else if (error?.message?.includes('timeout')) {
      message = 'Request timed out. The server took too long to respond.';
    } else if (error?.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (error?.status >= 500) {
      message = 'Server error. Please try again later.';
    } else if (error?.message) {
      message = error.message;
    }

    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'error',
      component: context,
      message: `API error: ${message}`,
      context: { originalError: String(error) },
    });

    return message;
  }
}

export const errorRecoveryManager = new ErrorRecoveryManager();
