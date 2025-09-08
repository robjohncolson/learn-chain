// Phase 2: Confidence Weighting System
// ADR-028: Confidence affects reputation rewards

export class ConfidenceSystem {
  /**
   * Calculate confidence score based on user's historical accuracy
   * @param correctCount Number of correct attestations
   * @param totalCount Total attestations made
   * @returns Confidence score 1-5
   */
  calculateUserConfidence(correctCount: number, totalCount: number): number {
    if (totalCount === 0) return 3; // Default middle confidence
    
    const accuracy = correctCount / totalCount;
    
    // Map accuracy to 1-5 confidence scale
    if (accuracy < 0.2) return 1;
    if (accuracy < 0.4) return 2;
    if (accuracy < 0.6) return 3;
    if (accuracy < 0.8) return 4;
    return 5;
  }
  
  /**
   * Validate attestation confidence is within bounds
   */
  validateConfidence(confidence: number): boolean {
    return confidence >= 1 && confidence <= 5 && Number.isInteger(confidence);
  }
  
  /**
   * Adjust confidence based on question difficulty
   * Harder questions (lower convergence) allow higher confidence rewards
   */
  adjustConfidenceForDifficulty(
    baseConfidence: number,
    questionConvergence: number
  ): number {
    // Lower convergence = harder question = boost confidence impact
    const difficultyMultiplier = 1 + (1 - questionConvergence) * 0.5;
    const adjusted = baseConfidence * difficultyMultiplier;
    
    // Keep within 1-5 bounds
    return Math.min(5, Math.max(1, adjusted));
  }
  
  /**
   * Calculate confidence-based weight for reputation
   * Maps 1-5 confidence to weight multiplier
   */
  confidenceToReputationWeight(confidence: number): number {
    // Linear mapping: 1->0.2, 2->0.4, 3->0.6, 4->0.8, 5->1.0
    return confidence * 0.2;
  }
  
  /**
   * Track confidence calibration
   * How well does user's confidence match their accuracy?
   */
  calculateCalibrationScore(
    attestations: Array<{
      confidence: number;
      wasCorrect: boolean;
    }>
  ): number {
    if (attestations.length === 0) return 0;
    
    // Group by confidence level
    const groups = new Map<number, { correct: number; total: number }>();
    
    for (const attestation of attestations) {
      const group = groups.get(attestation.confidence) || { correct: 0, total: 0 };
      group.total++;
      if (attestation.wasCorrect) group.correct++;
      groups.set(attestation.confidence, group);
    }
    
    // Calculate calibration error
    let totalError = 0;
    let totalWeight = 0;
    
    for (const [confidence, stats] of groups) {
      const expectedAccuracy = confidence / 5; // Confidence as probability
      const actualAccuracy = stats.total > 0 ? stats.correct / stats.total : 0;
      const error = Math.abs(expectedAccuracy - actualAccuracy);
      
      totalError += error * stats.total;
      totalWeight += stats.total;
    }
    
    if (totalWeight === 0) return 0;
    
    // Return calibration score (1 - average error)
    const averageError = totalError / totalWeight;
    return Math.max(0, 1 - averageError);
  }
  
  /**
   * Suggest confidence level based on past performance
   */
  suggestConfidence(
    userAccuracy: number,
    questionDifficulty: number // 0-1, where 1 is hardest
  ): number {
    // Base confidence on accuracy
    let suggested = Math.round(userAccuracy * 5);
    
    // Adjust for question difficulty
    if (questionDifficulty > 0.7) {
      suggested = Math.max(1, suggested - 1); // Lower confidence for hard questions
    } else if (questionDifficulty < 0.3) {
      suggested = Math.min(5, suggested + 1); // Higher confidence for easy questions
    }
    
    return Math.max(1, Math.min(5, suggested));
  }
  
  /**
   * Calculate confidence trend over time
   */
  calculateConfidenceTrend(
    attestations: Array<{
      timestamp: number;
      confidence: number;
      wasCorrect: boolean;
    }>
  ): {
    trend: 'improving' | 'declining' | 'stable';
    averageConfidence: number;
    recentConfidence: number;
  } {
    if (attestations.length === 0) {
      return {
        trend: 'stable',
        averageConfidence: 3,
        recentConfidence: 3
      };
    }
    
    // Sort by timestamp
    const sorted = [...attestations].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate overall average
    const totalConfidence = sorted.reduce((sum, a) => sum + a.confidence, 0);
    const averageConfidence = totalConfidence / sorted.length;
    
    // Calculate recent average (last 20% of attestations)
    const recentCount = Math.max(1, Math.floor(sorted.length * 0.2));
    const recentAttestations = sorted.slice(-recentCount);
    const recentTotal = recentAttestations.reduce((sum, a) => sum + a.confidence, 0);
    const recentConfidence = recentTotal / recentCount;
    
    // Determine trend
    let trend: 'improving' | 'declining' | 'stable';
    const difference = recentConfidence - averageConfidence;
    
    if (difference > 0.5) {
      trend = 'improving';
    } else if (difference < -0.5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
    
    return {
      trend,
      averageConfidence,
      recentConfidence
    };
  }
}