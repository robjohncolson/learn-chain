// Phase 2: Outlier Detection System
// ADR-028: Anti-gaming mechanisms to identify suspicious attestations

import { QuestionAttestation, FRQAttestation } from '../questions/types.js';
import { FRQDistribution, MCQDistribution } from './consensus.js';

export interface OutlierResult {
  isOutlier: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

export class OutlierDetector {
  // Thresholds for outlier detection
  private readonly Z_SCORE_THRESHOLD = 3; // Standard deviations from mean
  private readonly MIN_ATTESTATIONS_FOR_DETECTION = 5;
  private readonly RAPID_FIRE_THRESHOLD_MS = 5000; // 5 seconds between attestations
  private readonly PATTERN_SIMILARITY_THRESHOLD = 0.9; // 90% similar answers
  
  /**
   * Detect outliers in attestations
   * ADR-028: Flag suspicious patterns for review
   */
  detectOutliers(attestations: QuestionAttestation[]): string[] {
    const outlierIds: string[] = [];
    
    // Group by user
    const userAttestations = this.groupByUser(attestations);
    
    for (const [userId, userAtts] of userAttestations) {
      // Check for rapid-fire attestations
      if (this.hasRapidFirePattern(userAtts)) {
        outlierIds.push(userId);
        continue;
      }
      
      // Check for copy-paste patterns in FRQ
      if (this.hasCopyPastePattern(userAtts)) {
        outlierIds.push(userId);
        continue;
      }
      
      // Check for systematic gaming patterns
      if (this.hasGamingPattern(userAtts)) {
        outlierIds.push(userId);
      }
    }
    
    return outlierIds;
  }
  
  /**
   * Check if an FRQ score is an outlier
   * Uses z-score method for statistical outlier detection
   */
  isFRQScoreOutlier(score: number, distribution: FRQDistribution): OutlierResult {
    if (distribution.scores.length < this.MIN_ATTESTATIONS_FOR_DETECTION) {
      return { isOutlier: false, severity: 'low' };
    }
    
    const zScore = Math.abs((score - distribution.mean) / distribution.stdDev);
    
    if (zScore > this.Z_SCORE_THRESHOLD) {
      return {
        isOutlier: true,
        reason: `Score ${score} is ${zScore.toFixed(1)} standard deviations from mean`,
        severity: zScore > 4 ? 'high' : 'medium',
        suggestions: [
          'Review scoring criteria',
          'Check for misunderstanding of question',
          'Verify attestation is genuine'
        ]
      };
    }
    
    return { isOutlier: false, severity: 'low' };
  }
  
  /**
   * Check if MCQ pattern is suspicious
   */
  isMCQPatternSuspicious(
    userChoices: string[],
    distribution: MCQDistribution
  ): OutlierResult {
    // Check if user always picks the least popular answer
    const leastPopularCount = this.countLeastPopularChoices(userChoices, distribution);
    const suspicionRatio = leastPopularCount / userChoices.length;
    
    if (suspicionRatio > 0.8) {
      return {
        isOutlier: true,
        reason: 'Consistently choosing unpopular answers',
        severity: 'medium',
        suggestions: ['May be gaming for minority bonus']
      };
    }
    
    // Check for pattern in choices (e.g., always A, or A-B-C-D-E repeating)
    if (this.hasRepetitivePattern(userChoices)) {
      return {
        isOutlier: true,
        reason: 'Repetitive answer pattern detected',
        severity: 'low',
        suggestions: ['Answers appear to follow a pattern rather than question content']
      };
    }
    
    return { isOutlier: false, severity: 'low' };
  }
  
  /**
   * Group attestations by user
   */
  private groupByUser(
    attestations: QuestionAttestation[]
  ): Map<string, QuestionAttestation[]> {
    const grouped = new Map<string, QuestionAttestation[]>();
    
    for (const attestation of attestations) {
      const userId = attestation.attesterPubkey;
      const userAtts = grouped.get(userId) || [];
      userAtts.push(attestation);
      grouped.set(userId, userAtts);
    }
    
    return grouped;
  }
  
  /**
   * Check for rapid-fire attestation pattern
   */
  private hasRapidFirePattern(attestations: QuestionAttestation[]): boolean {
    if (attestations.length < 2) return false;
    
    // Sort by timestamp
    const sorted = [...attestations].sort((a, b) => a.timestamp - b.timestamp);
    
    let rapidCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (timeDiff < this.RAPID_FIRE_THRESHOLD_MS) {
        rapidCount++;
      }
    }
    
    // Flag if more than 50% are rapid-fire
    return rapidCount > attestations.length * 0.5;
  }
  
  /**
   * Check for copy-paste patterns in FRQ responses
   */
  private hasCopyPastePattern(attestations: QuestionAttestation[]): boolean {
    const frqResponses = attestations
      .filter(a => 'answerText' in a)
      .map(a => (a as FRQAttestation).answerText);
    
    if (frqResponses.length < 2) return false;
    
    // Check for identical or near-identical responses
    const uniqueResponses = new Set(frqResponses);
    const uniquenessRatio = uniqueResponses.size / frqResponses.length;
    
    // Flag if less than 30% unique responses
    return uniquenessRatio < 0.3;
  }
  
  /**
   * Check for systematic gaming patterns
   */
  private hasGamingPattern(attestations: QuestionAttestation[]): boolean {
    // Check if user only attests when convergence is high (cherry-picking)
    // This would require access to historical convergence data
    
    // Check if confidence is always max (5) regardless of accuracy
    const frqAttestations = attestations.filter(a => 'confidence' in a) as FRQAttestation[];
    if (frqAttestations.length > 5) {
      const allMaxConfidence = frqAttestations.every(a => a.confidence === 5);
      if (allMaxConfidence) return true;
    }
    
    return false;
  }
  
  /**
   * Count how many times user chose the least popular answer
   */
  private countLeastPopularChoices(
    userChoices: string[],
    distribution: MCQDistribution
  ): number {
    const minCount = Math.min(...Object.values(distribution.choices));
    let leastPopularCount = 0;
    
    for (const choice of userChoices) {
      if (distribution.choices[choice] === minCount) {
        leastPopularCount++;
      }
    }
    
    return leastPopularCount;
  }
  
  /**
   * Check for repetitive patterns in choices
   */
  private hasRepetitivePattern(choices: string[]): boolean {
    if (choices.length < 5) return false;
    
    // Check for single choice repeated
    const uniqueChoices = new Set(choices);
    if (uniqueChoices.size === 1) return true;
    
    // Check for simple patterns (A-B-C-D-E repeating)
    const patterns = [
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'A', 'B', 'B', 'C'],
      ['A', 'B', 'A', 'B', 'A']
    ];
    
    for (const pattern of patterns) {
      if (this.matchesPattern(choices, pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if choices match a repeating pattern
   */
  private matchesPattern(choices: string[], pattern: string[]): boolean {
    if (choices.length < pattern.length) return false;
    
    for (let i = 0; i < choices.length; i++) {
      const expectedChoice = pattern[i % pattern.length];
      if (choices[i] !== expectedChoice) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculate suspicion score for a user
   * Combines multiple factors into a single score
   */
  calculateSuspicionScore(
    userAttestations: QuestionAttestation[],
    allDistributions: Map<string, MCQDistribution | FRQDistribution>
  ): number {
    let suspicionScore = 0;
    
    // Rapid fire penalty
    if (this.hasRapidFirePattern(userAttestations)) {
      suspicionScore += 30;
    }
    
    // Copy-paste penalty
    if (this.hasCopyPastePattern(userAttestations)) {
      suspicionScore += 25;
    }
    
    // Gaming pattern penalty
    if (this.hasGamingPattern(userAttestations)) {
      suspicionScore += 20;
    }
    
    // Check individual attestations
    for (const attestation of userAttestations) {
      const distribution = allDistributions.get(attestation.questionId);
      if (!distribution) continue;
      
      if ('score' in attestation && 'scores' in distribution) {
        const outlierResult = this.isFRQScoreOutlier(
          attestation.score,
          distribution as FRQDistribution
        );
        if (outlierResult.isOutlier) {
          suspicionScore += outlierResult.severity === 'high' ? 15 : 10;
        }
      }
    }
    
    // Normalize to 0-100 scale
    return Math.min(100, suspicionScore);
  }
}