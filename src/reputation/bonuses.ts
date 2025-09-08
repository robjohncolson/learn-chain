// Phase 2: Bonus and Decay System
// Additional reputation modifiers per ADR-028

export class BonusSystem {
  // Bonus configuration
  private readonly EARLY_ADOPTER_BONUS = 1.2; // 20% bonus for first 10 attestations
  private readonly CONSISTENCY_BONUS = 1.1; // 10% bonus for consistent participation
  private readonly QUALITY_THRESHOLD = 0.8; // 80% accuracy for quality bonus
  private readonly QUALITY_BONUS = 1.15; // 15% bonus for high quality
  
  /**
   * Calculate early adopter bonus
   * Users who attest early (first 10 attestations) get a bonus
   */
  calculateEarlyAdopterBonus(attestationCount: number): number {
    return attestationCount <= 10 ? this.EARLY_ADOPTER_BONUS : 1.0;
  }
  
  /**
   * Calculate consistency bonus
   * Users who participate regularly get a bonus
   * @param daysActive Number of unique days the user has been active
   * @param totalDays Total days since first attestation
   */
  calculateConsistencyBonus(daysActive: number, totalDays: number): number {
    if (totalDays === 0) return 1.0;
    
    const participationRate = daysActive / totalDays;
    // Bonus if participating more than 30% of days
    return participationRate > 0.3 ? this.CONSISTENCY_BONUS : 1.0;
  }
  
  /**
   * Calculate quality bonus
   * Users with high accuracy get a bonus
   * @param correctCount Number of correct attestations
   * @param totalCount Total number of attestations
   */
  calculateQualityBonus(correctCount: number, totalCount: number): number {
    if (totalCount === 0) return 1.0;
    
    const accuracy = correctCount / totalCount;
    return accuracy >= this.QUALITY_THRESHOLD ? this.QUALITY_BONUS : 1.0;
  }
  
  /**
   * Calculate streak bonus
   * Bonus for consecutive correct attestations
   * @param streakLength Current streak of correct attestations
   */
  calculateStreakBonus(streakLength: number): number {
    if (streakLength < 3) return 1.0;
    if (streakLength < 5) return 1.05;
    if (streakLength < 10) return 1.1;
    return 1.2; // Max 20% bonus for 10+ streak
  }
  
  /**
   * Apply all applicable bonuses
   */
  applyAllBonuses(params: {
    baseScore: number;
    attestationCount: number;
    daysActive: number;
    totalDays: number;
    correctCount: number;
    totalCount: number;
    streakLength: number;
  }): {
    finalScore: number;
    appliedBonuses: string[];
  } {
    let score = params.baseScore;
    const appliedBonuses: string[] = [];
    
    // Early adopter bonus
    const earlyBonus = this.calculateEarlyAdopterBonus(params.attestationCount);
    if (earlyBonus > 1.0) {
      score *= earlyBonus;
      appliedBonuses.push(`Early Adopter: ${((earlyBonus - 1) * 100).toFixed(0)}%`);
    }
    
    // Consistency bonus
    const consistencyBonus = this.calculateConsistencyBonus(
      params.daysActive,
      params.totalDays
    );
    if (consistencyBonus > 1.0) {
      score *= consistencyBonus;
      appliedBonuses.push(`Consistency: ${((consistencyBonus - 1) * 100).toFixed(0)}%`);
    }
    
    // Quality bonus
    const qualityBonus = this.calculateQualityBonus(
      params.correctCount,
      params.totalCount
    );
    if (qualityBonus > 1.0) {
      score *= qualityBonus;
      appliedBonuses.push(`Quality: ${((qualityBonus - 1) * 100).toFixed(0)}%`);
    }
    
    // Streak bonus
    const streakBonus = this.calculateStreakBonus(params.streakLength);
    if (streakBonus > 1.0) {
      score *= streakBonus;
      appliedBonuses.push(`Streak: ${((streakBonus - 1) * 100).toFixed(0)}%`);
    }
    
    return {
      finalScore: score,
      appliedBonuses
    };
  }
}

/**
 * Time-based decay functions
 */
export class DecaySystem {
  /**
   * Linear decay over time
   * Score decreases linearly with age
   */
  linearDecay(originalScore: number, ageInDays: number, decayRate: number = 0.01): number {
    const decayFactor = Math.max(0, 1 - (decayRate * ageInDays));
    return originalScore * decayFactor;
  }
  
  /**
   * Exponential decay over time (default per ADR-028)
   * Score decreases exponentially with age
   */
  exponentialDecay(originalScore: number, ageInDays: number, lambda: number = 0.01): number {
    return originalScore * Math.exp(-lambda * ageInDays);
  }
  
  /**
   * Logarithmic decay over time
   * Score decreases logarithmically (slower decay)
   */
  logarithmicDecay(originalScore: number, ageInDays: number, base: number = 2): number {
    if (ageInDays <= 1) return originalScore;
    const decayFactor = 1 / Math.log(ageInDays + 1) * Math.log(base);
    return originalScore * Math.min(1, decayFactor);
  }
  
  /**
   * Step decay - discrete drops at intervals
   * Score drops by fixed percentage at each interval
   */
  stepDecay(
    originalScore: number,
    ageInDays: number,
    intervalDays: number = 30,
    dropPercentage: number = 0.1
  ): number {
    const intervals = Math.floor(ageInDays / intervalDays);
    const decayFactor = Math.pow(1 - dropPercentage, intervals);
    return originalScore * decayFactor;
  }
  
  /**
   * No decay for recent activity
   * Scores within grace period don't decay
   */
  gracePeriodDecay(
    originalScore: number,
    ageInDays: number,
    gracePeriodDays: number = 7,
    decayFunction: (score: number, age: number) => number = this.exponentialDecay
  ): number {
    if (ageInDays <= gracePeriodDays) {
      return originalScore;
    }
    
    const adjustedAge = ageInDays - gracePeriodDays;
    return decayFunction(originalScore, adjustedAge);
  }
}