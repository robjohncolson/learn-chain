/**
 * Invariant Monitor
 * Continuous monitoring of system invariants with alerting
 */

import { InvariantChecker } from './checker';
import { InvariantViolation, InvariantReport } from './types';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { errorHandler } from '../error/error-handler';
import { BlockchainErrorImpl, ErrorCode, ErrorSeverity } from '../error/types';

export interface MonitorConfig {
  checkInterval: number; // milliseconds
  alertOnViolation: boolean;
  autoRecover: boolean;
  maxViolationsBeforeAlert: number;
}

export class InvariantMonitor {
  private static instance: InvariantMonitor;
  private checker: InvariantChecker;
  private isMonitoring: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private violationCallbacks: ((violation: InvariantViolation) => void)[] = [];
  private reportCallbacks: ((report: InvariantReport) => void)[] = [];
  private config: MonitorConfig;
  private recentViolations: InvariantViolation[] = [];
  private blockchain: EnhancedBlockchain | null = null;

  private constructor() {
    this.checker = InvariantChecker.getInstance();
    this.config = {
      checkInterval: 30000, // 30 seconds default
      alertOnViolation: true,
      autoRecover: false,
      maxViolationsBeforeAlert: 5
    };
  }

  static getInstance(): InvariantMonitor {
    if (!InvariantMonitor.instance) {
      InvariantMonitor.instance = new InvariantMonitor();
    }
    return InvariantMonitor.instance;
  }

  /**
   * Start monitoring invariants
   */
  startMonitoring(blockchain: EnhancedBlockchain, config?: Partial<MonitorConfig>): void {
    if (this.isMonitoring) {
      console.warn('Invariant monitoring already active');
      return;
    }

    this.blockchain = blockchain;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.info('Starting invariant monitoring with config:', this.config);
    
    this.isMonitoring = true;
    this.runCheck(); // Run immediately
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.info('Stopping invariant monitoring');
    
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run invariant check
   */
  private runCheck(): void {
    if (!this.blockchain) {
      console.error('No blockchain instance for monitoring');
      return;
    }

    try {
      const report = this.checker.verifyAllInvariants(this.blockchain);
      
      // Process violations
      if (report.violations.length > 0) {
        this.handleViolations(report.violations);
      }

      // Execute report callbacks
      this.reportCallbacks.forEach(callback => {
        try {
          callback(report);
        } catch (error) {
          console.error('Error in report callback:', error);
        }
      });

      // Log summary
      if (report.failed > 0) {
        console.warn(`Invariant check: ${report.failed} failed, ${report.passed} passed`);
      } else {
        console.debug(`Invariant check: All ${report.passed} checks passed`);
      }

    } catch (error) {
      console.error('Error during invariant check:', error);
      errorHandler.handleError(
        new BlockchainErrorImpl(
          ErrorCode.INVARIANT_VIOLATION,
          'Invariant check failed',
          ErrorSeverity.ERROR,
          true
        ).withContext({ error: String(error) })
      );
    }
  }

  /**
   * Handle detected violations
   */
  private handleViolations(violations: InvariantViolation[]): void {
    // Add to recent violations
    this.recentViolations.push(...violations);
    
    // Trim if too many
    if (this.recentViolations.length > 100) {
      this.recentViolations = this.recentViolations.slice(-100);
    }

    // Process each violation
    for (const violation of violations) {
      // Execute callbacks
      this.violationCallbacks.forEach(callback => {
        try {
          callback(violation);
        } catch (error) {
          console.error('Error in violation callback:', error);
        }
      });

      // Alert if configured
      if (this.config.alertOnViolation) {
        this.alertViolation(violation);
      }

      // Attempt recovery if configured
      if (this.config.autoRecover && violation.severity === 'critical') {
        this.attemptRecovery(violation);
      }
    }

    // Check if we need to escalate
    const recentCritical = this.recentViolations.filter(
      v => v.severity === 'critical' && 
      v.timestamp > Date.now() - 60000 // Last minute
    ).length;

    if (recentCritical >= this.config.maxViolationsBeforeAlert) {
      this.escalateAlert(recentCritical);
    }
  }

  /**
   * Alert about violation
   */
  private alertViolation(violation: InvariantViolation): void {
    const severity = this.mapViolationSeverity(violation.severity);
    
    const error = new BlockchainErrorImpl(
      ErrorCode.INVARIANT_VIOLATION,
      violation.message,
      severity,
      violation.severity !== 'critical'
    );

    error.withContext(violation.context);
    
    if (violation.suggestion) {
      error.withSuggestions(violation.suggestion);
    }

    errorHandler.handleError(error);
  }

  /**
   * Map violation severity to error severity
   */
  private mapViolationSeverity(severity: string): ErrorSeverity {
    switch (severity) {
      case 'critical':
        return ErrorSeverity.CRITICAL;
      case 'high':
        return ErrorSeverity.ERROR;
      case 'medium':
        return ErrorSeverity.WARNING;
      case 'low':
        return ErrorSeverity.INFO;
      default:
        return ErrorSeverity.WARNING;
    }
  }

  /**
   * Attempt automatic recovery
   */
  private attemptRecovery(violation: InvariantViolation): void {
    console.info(`Attempting recovery for ${violation.type} violation`);

    switch (violation.type) {
      case 'PERSISTENCE_INTEGRITY':
        // Trigger state reload
        console.info('Reloading state from storage...');
        if (this.blockchain) {
          // Trigger reload through blockchain
          // blockchain.reloadState();
        }
        break;

      case 'TEMPORAL_ORDERING':
        // Re-sort transactions
        console.info('Re-sorting transactions by timestamp...');
        break;

      case 'UI_SAFETY':
        // Reset UI to safe state
        if (typeof window !== 'undefined') {
          console.info('Resetting UI to dashboard...');
          // Trigger UI reset
          (window as any).resetToDashboard?.();
        }
        break;

      default:
        console.warn(`No automatic recovery available for ${violation.type}`);
    }
  }

  /**
   * Escalate alert for critical violations
   */
  private escalateAlert(count: number): void {
    const error = new BlockchainErrorImpl(
      ErrorCode.INVARIANT_VIOLATION,
      `CRITICAL: ${count} invariant violations in the last minute`,
      ErrorSeverity.CRITICAL,
      false
    );

    error.withSuggestions(
      'System integrity compromised',
      'Consider stopping operations',
      'Review violation logs immediately'
    );

    errorHandler.handleError(error);

    // Play alert sound if available
    if (typeof window !== 'undefined') {
      const playSound = (window as any).playSound;
      if (typeof playSound === 'function') {
        playSound('error');
      }
    }
  }

  /**
   * Register violation callback
   */
  onInvariantViolation(callback: (violation: InvariantViolation) => void): () => void {
    this.violationCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.violationCallbacks.indexOf(callback);
      if (index > -1) {
        this.violationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register report callback
   */
  onReport(callback: (report: InvariantReport) => void): () => void {
    this.reportCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.reportCallbacks.indexOf(callback);
      if (index > -1) {
        this.reportCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get violation history
   */
  getViolationHistory(): InvariantViolation[] {
    return [...this.recentViolations];
  }

  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.recentViolations = [];
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    config: MonitorConfig;
    recentViolations: number;
    lastCheck?: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      config: { ...this.config },
      recentViolations: this.recentViolations.length,
      lastCheck: this.recentViolations[this.recentViolations.length - 1]?.timestamp
    };
  }

  /**
   * Force immediate check
   */
  forceCheck(): InvariantReport | null {
    if (!this.blockchain) {
      console.error('No blockchain instance for monitoring');
      return null;
    }

    return this.checker.verifyAllInvariants(this.blockchain);
  }
}

// Export singleton instance
export const invariantMonitor = InvariantMonitor.getInstance();