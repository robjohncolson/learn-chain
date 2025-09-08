/**
 * Enhanced Rate Limiter
 * Advanced rate limiting with persistence and grace periods
 */

import { RateLimiter, RateLimitEntry } from '../core/rate-limiter';
import { loadState, saveState } from '../persistence/storage';

export interface EnhancedRateLimitEntry extends RateLimitEntry {
  gracePeriodUsed: boolean;
  violations: number;
  lastViolation?: number;
}

export interface RateLimitState {
  entries: Map<string, EnhancedRateLimitEntry>;
  globalViolations: number;
  lastSaved: number;
}

export class EnhancedRateLimiter extends RateLimiter {
  private enhancedLimits: Map<string, EnhancedRateLimitEntry>;
  private globalViolations: number = 0;
  private readonly GRACE_PERIOD_DAYS = 3;
  private readonly GRACE_PERIOD_MS = this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  private readonly MAX_VIOLATIONS = 3;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.enhancedLimits = new Map();
    this.loadLimits();
    this.startAutoSave();
  }

  /**
   * Check if user can attest with grace period
   */
  canAttest(userId: string, questionId: string): boolean {
    const key = this.getKey(userId, questionId);
    const entry = this.enhancedLimits.get(key);

    if (!entry) {
      return true; // First attestation
    }

    // Check if user has too many violations
    if (entry.violations >= this.MAX_VIOLATIONS) {
      console.warn(`User ${userId} has exceeded maximum violations`);
      return false;
    }

    const timeSinceLastAttestation = Date.now() - entry.lastAttestation;
    
    // Standard check
    if (timeSinceLastAttestation >= this.RATE_LIMIT_MS) {
      return true;
    }

    // Check grace period
    if (this.checkGracePeriod(userId, questionId)) {
      return true;
    }

    // Record violation
    this.recordViolation(key);
    return false;
  }

  /**
   * Record attestation with enhanced tracking
   */
  recordAttestation(userId: string, questionId: string): void {
    const key = this.getKey(userId, questionId);
    const now = Date.now();

    const existingEntry = this.enhancedLimits.get(key);
    
    const entry: EnhancedRateLimitEntry = existingEntry || {
      userId,
      questionId,
      lastAttestation: now,
      attemptCount: 0,
      gracePeriodUsed: false,
      violations: 0
    };

    // Check if this is using grace period
    const timeSinceLastAttestation = now - entry.lastAttestation;
    if (timeSinceLastAttestation < this.RATE_LIMIT_MS && 
        timeSinceLastAttestation >= this.RATE_LIMIT_MS - this.GRACE_PERIOD_MS) {
      entry.gracePeriodUsed = true;
    }

    entry.lastAttestation = now;
    entry.attemptCount++;

    this.enhancedLimits.set(key, entry);
    
    // Also update parent class
    super.recordAttestation(userId, questionId);
  }

  /**
   * Check if user can use grace period
   */
  checkGracePeriod(userId: string, questionId: string): boolean {
    const key = this.getKey(userId, questionId);
    const entry = this.enhancedLimits.get(key);

    if (!entry) {
      return false;
    }

    // Can only use grace period once
    if (entry.gracePeriodUsed) {
      return false;
    }

    const timeSinceLastAttestation = Date.now() - entry.lastAttestation;
    const timeUntilAllowed = this.RATE_LIMIT_MS - timeSinceLastAttestation;

    // Grace period applies only when close to the limit
    if (timeUntilAllowed <= this.GRACE_PERIOD_MS) {
      console.info(`Grace period granted for user ${userId} on question ${questionId}`);
      return true;
    }

    return false;
  }

  /**
   * Batch check for multiple questions
   */
  canAttestBatch(userId: string, questionIds: string[]): Map<string, boolean> {
    const results = new Map<string, boolean>();

    for (const questionId of questionIds) {
      results.set(questionId, this.canAttest(userId, questionId));
    }

    return results;
  }

  /**
   * Record a rate limit violation
   */
  private recordViolation(key: string): void {
    const entry = this.enhancedLimits.get(key);
    
    if (entry) {
      entry.violations = (entry.violations || 0) + 1;
      entry.lastViolation = Date.now();
      this.enhancedLimits.set(key, entry);
    }

    this.globalViolations++;
    
    // Log if violations are getting high
    if (entry && entry.violations >= 2) {
      console.warn(`User ${entry.userId} has ${entry.violations} rate limit violations`);
    }
  }

  /**
   * Get violation count for a user
   */
  getViolationCount(userId: string): number {
    let count = 0;
    
    for (const entry of this.enhancedLimits.values()) {
      if (entry.userId === userId) {
        count += entry.violations || 0;
      }
    }

    return count;
  }

  /**
   * Clear violations for a user (admin function)
   */
  clearViolations(userId: string): void {
    for (const [key, entry] of this.enhancedLimits) {
      if (entry.userId === userId) {
        entry.violations = 0;
        entry.lastViolation = undefined;
        this.enhancedLimits.set(key, entry);
      }
    }
  }

  /**
   * Save limits to persistence
   */
  saveLimits(): void {
    try {
      const state: RateLimitState = {
        entries: this.enhancedLimits,
        globalViolations: this.globalViolations,
        lastSaved: Date.now()
      };

      // Convert Map to array for serialization
      const serializable = {
        entries: Array.from(state.entries.entries()),
        globalViolations: state.globalViolations,
        lastSaved: state.lastSaved
      };

      localStorage.setItem('rateLimits', JSON.stringify(serializable));
      console.debug('Rate limits saved');
    } catch (error) {
      console.error('Failed to save rate limits:', error);
    }
  }

  /**
   * Load limits from persistence
   */
  loadLimits(): void {
    try {
      const saved = localStorage.getItem('rateLimits');
      
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Convert array back to Map
        this.enhancedLimits = new Map(parsed.entries);
        this.globalViolations = parsed.globalViolations || 0;
        
        // Clean up old entries (older than 60 days)
        const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
        for (const [key, entry] of this.enhancedLimits) {
          if (entry.lastAttestation < sixtyDaysAgo) {
            this.enhancedLimits.delete(key);
          }
        }
        
        console.debug(`Loaded ${this.enhancedLimits.size} rate limit entries`);
      }
    } catch (error) {
      console.error('Failed to load rate limits:', error);
      this.enhancedLimits = new Map();
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    // Save every 5 minutes
    this.autoSaveInterval = setInterval(() => {
      this.saveLimits();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Save one last time
    this.saveLimits();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalEntries: number;
    activeUsers: number;
    globalViolations: number;
    gracePeriodUsers: number;
    highViolationUsers: number;
  } {
    const uniqueUsers = new Set<string>();
    let gracePeriodUsers = 0;
    let highViolationUsers = 0;

    for (const entry of this.enhancedLimits.values()) {
      uniqueUsers.add(entry.userId);
      
      if (entry.gracePeriodUsed) {
        gracePeriodUsers++;
      }
      
      if (entry.violations >= 2) {
        highViolationUsers++;
      }
    }

    return {
      totalEntries: this.enhancedLimits.size,
      activeUsers: uniqueUsers.size,
      globalViolations: this.globalViolations,
      gracePeriodUsers,
      highViolationUsers
    };
  }

  /**
   * Export rate limit data for analysis
   */
  exportData(): any {
    return {
      limits: Array.from(this.enhancedLimits.entries()),
      statistics: this.getStatistics(),
      timestamp: Date.now()
    };
  }

  /**
   * Clean up and destroy
   */
  destroy(): void {
    this.stopAutoSave();
    this.saveLimits();
  }

  /**
   * Override parent method to get key
   */
  private getKey(userId: string, questionId: string): string {
    return `${userId}:${questionId}`;
  }
}

// Export singleton instance
export const enhancedRateLimiter = new EnhancedRateLimiter();