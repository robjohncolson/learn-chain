// Phase 2: Reputation Calculator
// ADR-028: Confidence-weighted rewards with minority bonuses

import { QuestionAttestation, FRQAttestation } from '../questions/types.js';
import { 
  QuestionDistribution, 
  MCQDistribution, 
  FRQDistribution,
  ConsensusCalculator
} from '../core/consensus.js';
import { confidenceToWeight } from '../questions/scoring.js';

export interface ReputationUpdate {
  userId: string;
  questionId: string;
  basePoints: number;
  bonuses: BonusMultipliers;
  finalScore: number;
  timestamp: number;
}

export interface BonusMultipliers {
  minorityBonus: number; // 1.5x if in minority correct
  confidenceWeight: number; // 1-5 scale normalized to 0.2-1.0
  timeDecay: number; // Exponential decay factor
}

export class ReputationCalculator {
  private consensusCalculator: ConsensusCalculator;
  private readonly BASE_REWARD = 1.0;
  private readonly MINORITY_MULTIPLIER = 1.5;
  private readonly DECAY_LAMBDA = 0.01; // Decay rate per day
  
  constructor() {
    this.consensusCalculator = new ConsensusCalculator();
  }
  
  /**
   * Calculate reward for an attestation based on consensus
   * ADR-028: Base reward with minority bonus and confidence weighting
   */
  calculateReward(
    attestation: QuestionAttestation,
    distribution: QuestionDistribution
  ): number {
    // Check if consensus has been reached
    if (!this.consensusCalculator.hasReachedConsensus(distribution)) {
      return 0; // No reward until consensus
    }
    
    // Base reward for participating in consensus
    let reward = this.BASE_REWARD;
    
    // Apply minority bonus if applicable
    const isMinority = this.consensusCalculator.isMinorityAttestation(
      attestation,
      distribution
    );
    const minorityBonus = this.applyMinorityBonus(isMinority);
    reward *= minorityBonus;
    
    // Apply confidence weight for FRQ attestations
    if ('confidence' in attestation) {
      const confidenceWeight = this.applyConfidenceWeight(
        (attestation as FRQAttestation).confidence
      );
      reward *= confidenceWeight;
    }
    
    // Apply time decay based on when the attestation was made
    const currentTime = Date.now();
    const timeDecay = this.applyTimeDecay(attestation.timestamp, currentTime);
    reward *= timeDecay;
    
    return reward;
  }
  
  /**
   * Apply minority bonus
   * ADR-028: 1.5x multiplier for correct minority answers
   */
  applyMinorityBonus(isMinority: boolean): number {
    return isMinority ? this.MINORITY_MULTIPLIER : 1.0;
  }
  
  /**
   * Apply confidence weight
   * ADR-028: Scale 1-5 confidence to 0.2-1.0 multiplier
   */
  applyConfidenceWeight(confidence: number): number {
    return confidenceToWeight(confidence);
  }
  
  /**
   * Apply time decay to rewards
   * ADR-028: Exponential decay over time
   * @param timestamp When the attestation was made
   * @param currentTime Current time for decay calculation
   */
  applyTimeDecay(timestamp: number, currentTime: number): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = (currentTime - timestamp) / millisecondsPerDay;
    
    // Exponential decay: e^(-λ * days)
    return Math.exp(-this.DECAY_LAMBDA * daysElapsed);
  }
  
  /**
   * Create a detailed reputation update record
   */
  createReputationUpdate(
    userId: string,
    attestation: QuestionAttestation,
    distribution: QuestionDistribution
  ): ReputationUpdate {
    const isMinority = this.consensusCalculator.isMinorityAttestation(
      attestation,
      distribution
    );
    
    const minorityBonus = this.applyMinorityBonus(isMinority);
    const confidenceWeight = 'confidence' in attestation
      ? this.applyConfidenceWeight((attestation as FRQAttestation).confidence)
      : 1.0;
    const timeDecay = this.applyTimeDecay(attestation.timestamp, Date.now());
    
    const finalScore = this.calculateReward(attestation, distribution);
    
    return {
      userId,
      questionId: attestation.questionId,
      basePoints: this.BASE_REWARD,
      bonuses: {
        minorityBonus,
        confidenceWeight,
        timeDecay
      },
      finalScore,
      timestamp: Date.now()
    };
  }
  
  /**
   * Calculate cumulative reputation score for a user
   */
  calculateCumulativeScore(updates: ReputationUpdate[]): number {
    return updates.reduce((total, update) => total + update.finalScore, 0);
  }
  
  /**
   * Get reputation breakdown by question type
   */
  getReputationBreakdown(
    updates: ReputationUpdate[],
    distributions: Map<string, QuestionDistribution>
  ): {
    mcqScore: number;
    frqScore: number;
    totalScore: number;
    questionsAnswered: number;
  } {
    let mcqScore = 0;
    let frqScore = 0;
    const uniqueQuestions = new Set<string>();
    
    for (const update of updates) {
      uniqueQuestions.add(update.questionId);
      const distribution = distributions.get(update.questionId);
      
      if (distribution) {
        if (distribution.type === 'multiple-choice') {
          mcqScore += update.finalScore;
        } else if (distribution.type === 'free-response') {
          frqScore += update.finalScore;
        }
      }
    }
    
    return {
      mcqScore,
      frqScore,
      totalScore: mcqScore + frqScore,
      questionsAnswered: uniqueQuestions.size
    };
  }
  
  /**
   * Identify top performers based on reputation
   */
  getTopPerformers(
    userReputations: Map<string, number>,
    limit: number = 10
  ): Array<{ userId: string; score: number }> {
    const sorted = Array.from(userReputations.entries())
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score);
    
    return sorted.slice(0, limit);
  }
}