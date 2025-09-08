// Phase 2: Rate Limiting System
// ADR-028: 30-day minimum between attestations per user per question

export interface RateLimitEntry {
  userId: string;
  questionId: string;
  lastAttestation: number; // Timestamp
  attemptCount: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private readonly RATE_LIMIT_DAYS = 30;
  private readonly RATE_LIMIT_MS = this.RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000;
  
  constructor() {
    this.limits = new Map();
  }
  
  /**
   * Generate unique key for user-question pair
   */
  private getKey(userId: string, questionId: string): string {
    return `${userId}:${questionId}`;
  }
  
  /**
   * Check if user can attest to a question
   * ADR-028: Users can only attest once per 30 days per question
   */
  canAttest(userId: string, questionId: string): boolean {
    const key = this.getKey(userId, questionId);
    const entry = this.limits.get(key);
    
    if (!entry) {
      return true; // First attestation
    }
    
    const timeSinceLastAttestation = Date.now() - entry.lastAttestation;
    return timeSinceLastAttestation >= this.RATE_LIMIT_MS;
  }
  
  /**
   * Get time until user can attest again (in milliseconds)
   */
  getTimeUntilNextAttestation(userId: string, questionId: string): number {
    const key = this.getKey(userId, questionId);
    const entry = this.limits.get(key);
    
    if (!entry) {
      return 0; // Can attest now
    }
    
    const timeSinceLastAttestation = Date.now() - entry.lastAttestation;
    const timeRemaining = this.RATE_LIMIT_MS - timeSinceLastAttestation;
    
    return Math.max(0, timeRemaining);
  }
  
  /**
   * Get time until user can attest again (human readable)
   */
  getTimeUntilNextAttestationReadable(userId: string, questionId: string): string {
    const msRemaining = this.getTimeUntilNextAttestation(userId, questionId);
    
    if (msRemaining === 0) {
      return 'Can attest now';
    }
    
    const days = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  
  /**
   * Record an attestation
   */
  recordAttestation(userId: string, questionId: string): void {
    const key = this.getKey(userId, questionId);
    const existing = this.limits.get(key);
    
    const entry: RateLimitEntry = {
      userId,
      questionId,
      lastAttestation: Date.now(),
      attemptCount: (existing?.attemptCount || 0) + 1
    };
    
    this.limits.set(key, entry);
  }
  
  /**
   * Get all rate limit entries for a user
   */
  getUserLimits(userId: string): RateLimitEntry[] {
    const userLimits: RateLimitEntry[] = [];
    
    for (const entry of this.limits.values()) {
      if (entry.userId === userId) {
        userLimits.push(entry);
      }
    }
    
    return userLimits;
  }
  
  /**
   * Get all rate limit entries for a question
   */
  getQuestionLimits(questionId: string): RateLimitEntry[] {
    const questionLimits: RateLimitEntry[] = [];
    
    for (const entry of this.limits.values()) {
      if (entry.questionId === questionId) {
        questionLimits.push(entry);
      }
    }
    
    return questionLimits;
  }
  
  /**
   * Clear expired rate limits (older than 30 days)
   */
  clearExpiredLimits(): number {
    const now = Date.now();
    let clearedCount = 0;
    
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.lastAttestation > this.RATE_LIMIT_MS) {
        this.limits.delete(key);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }
  
  /**
   * Get statistics about rate limiting
   */
  getStatistics(): {
    totalLimits: number;
    activeLimits: number;
    expiredLimits: number;
    averageAttempts: number;
  } {
    const now = Date.now();
    let activeLimits = 0;
    let expiredLimits = 0;
    let totalAttempts = 0;
    
    for (const entry of this.limits.values()) {
      if (now - entry.lastAttestation < this.RATE_LIMIT_MS) {
        activeLimits++;
      } else {
        expiredLimits++;
      }
      totalAttempts += entry.attemptCount;
    }
    
    const totalLimits = this.limits.size;
    const averageAttempts = totalLimits > 0 ? totalAttempts / totalLimits : 0;
    
    return {
      totalLimits,
      activeLimits,
      expiredLimits,
      averageAttempts
    };
  }
  
  /**
   * Export rate limits for persistence
   */
  export(): Array<[string, RateLimitEntry]> {
    return Array.from(this.limits.entries());
  }
  
  /**
   * Import rate limits from persistence
   */
  import(data: Array<[string, RateLimitEntry]>): void {
    this.limits = new Map(data);
  }
  
  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear();
  }
  
  /**
   * Check if any user is being rate limited excessively
   * (potential sign of attack or abuse)
   */
  detectAbusePatterns(): {
    userId: string;
    questionCount: number;
    recentAttempts: number;
  }[] {
    const userPatterns = new Map<string, {
      questionCount: number;
      recentAttempts: number;
    }>();
    
    const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    
    for (const entry of this.limits.values()) {
      const pattern = userPatterns.get(entry.userId) || {
        questionCount: 0,
        recentAttempts: 0
      };
      
      pattern.questionCount++;
      if (entry.lastAttestation > recentThreshold) {
        pattern.recentAttempts++;
      }
      
      userPatterns.set(entry.userId, pattern);
    }
    
    // Flag users with suspicious patterns
    const suspicious: any[] = [];
    for (const [userId, pattern] of userPatterns) {
      // Flag if attempting many questions recently
      if (pattern.recentAttempts > 10) {
        suspicious.push({
          userId,
          questionCount: pattern.questionCount,
          recentAttempts: pattern.recentAttempts
        });
      }
    }
    
    return suspicious;
  }
}