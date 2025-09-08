// Phase 2: Consensus Calculations
// ADR-012 Social Consensus + ADR-028 Emergent Attestation

import { MCQAttestation, FRQAttestation, QuestionAttestation } from '../questions/types.js';
import { calculateMeanScore, calculateStandardDeviation } from '../questions/scoring.js';
import { getChoiceFromHash } from '../questions/hashing.js';

// --- Distribution Types ---

export interface QuestionDistribution {
  questionId: string;
  type: 'multiple-choice' | 'free-response';
  totalAttestations: number;
  convergence: number; // 0-1 scale
  lastUpdated: number;
}

export interface MCQDistribution extends QuestionDistribution {
  type: 'multiple-choice';
  choices: Record<string, number>; // { 'A': 12, 'B': 3, 'C': 5, ... }
}

export interface FRQDistribution extends QuestionDistribution {
  type: 'free-response';
  scores: number[]; // All scores (1-5)
  mean: number;
  stdDev: number;
}

// Type guards
export function isMCQDistribution(dist: QuestionDistribution): dist is MCQDistribution {
  return dist.type === 'multiple-choice';
}

export function isFRQDistribution(dist: QuestionDistribution): dist is FRQDistribution {
  return dist.type === 'free-response';
}

// --- Consensus Calculator Class ---

export class ConsensusCalculator {
  /**
   * Calculate convergence for MCQ distribution
   * ADR-028: convergence = max_count / total_attestations
   */
  calculateMCQConvergence(distribution: MCQDistribution): number {
    if (distribution.totalAttestations === 0) return 0;
    
    const counts = Object.values(distribution.choices);
    if (counts.length === 0) return 0;
    
    const maxCount = Math.max(...counts);
    return maxCount / distribution.totalAttestations;
  }
  
  /**
   * Calculate convergence for FRQ distribution
   * ADR-028: convergence = max(0, 1 - (stdDev/mean))
   */
  calculateFRQConvergence(distribution: FRQDistribution): number {
    if (distribution.scores.length === 0) return 0;
    if (distribution.mean === 0) return 0;
    
    // When all scores are the same, stdDev is 0, so convergence is 1
    if (distribution.stdDev === 0) return 1;
    
    const convergence = 1 - (distribution.stdDev / distribution.mean);
    return Math.max(0, convergence);
  }
  
  /**
   * Get progressive quorum based on convergence
   * ADR-028: Dynamic quorum based on consensus strength
   * @returns Required number of attestations for consensus
   */
  getProgressiveQuorum(convergence: number): number {
    if (convergence < 0.5) return 5; // Low convergence
    if (convergence < 0.8) return 4; // Medium convergence
    return 3; // High convergence
  }
  
  /**
   * Update distributions with new attestations
   * This is the core function that aggregates consensus data
   */
  updateDistributions(
    attestations: QuestionAttestation[],
    distributions: Map<string, QuestionDistribution>
  ): void {
    for (const attestation of attestations) {
      const questionId = attestation.questionId;
      let distribution = distributions.get(questionId);
      
      if ('answerHash' in attestation) {
        // MCQ Attestation
        distribution = this.updateMCQDistribution(
          attestation as MCQAttestation,
          distribution as MCQDistribution | undefined
        );
      } else {
        // FRQ Attestation
        distribution = this.updateFRQDistribution(
          attestation as FRQAttestation,
          distribution as FRQDistribution | undefined
        );
      }
      
      distributions.set(questionId, distribution);
    }
  }
  
  private updateMCQDistribution(
    attestation: MCQAttestation,
    existing?: MCQDistribution
  ): MCQDistribution {
    const choice = getChoiceFromHash(attestation.answerHash);
    if (!choice) {
      throw new Error(`Invalid answer hash: ${attestation.answerHash}`);
    }
    
    const distribution: MCQDistribution = existing || {
      questionId: attestation.questionId,
      type: 'multiple-choice',
      totalAttestations: 0,
      convergence: 0,
      lastUpdated: Date.now(),
      choices: { A: 0, B: 0, C: 0, D: 0, E: 0 }
    };
    
    // Update choice count
    distribution.choices[choice] = (distribution.choices[choice] || 0) + 1;
    distribution.totalAttestations++;
    distribution.lastUpdated = Date.now();
    
    // Recalculate convergence
    distribution.convergence = this.calculateMCQConvergence(distribution);
    
    return distribution;
  }
  
  private updateFRQDistribution(
    attestation: FRQAttestation,
    existing?: FRQDistribution
  ): FRQDistribution {
    const distribution: FRQDistribution = existing || {
      questionId: attestation.questionId,
      type: 'free-response',
      totalAttestations: 0,
      convergence: 0,
      lastUpdated: Date.now(),
      scores: [],
      mean: 0,
      stdDev: 0
    };
    
    // Add new score
    distribution.scores.push(attestation.score);
    distribution.totalAttestations++;
    distribution.lastUpdated = Date.now();
    
    // Recalculate statistics
    distribution.mean = calculateMeanScore(distribution.scores);
    distribution.stdDev = calculateStandardDeviation(distribution.scores);
    distribution.convergence = this.calculateFRQConvergence(distribution);
    
    return distribution;
  }
  
  /**
   * Check if a question has reached consensus
   * @returns True if attestation count >= progressive quorum
   */
  hasReachedConsensus(distribution: QuestionDistribution): boolean {
    const quorum = this.getProgressiveQuorum(distribution.convergence);
    return distribution.totalAttestations >= quorum;
  }
  
  /**
   * Get the consensus answer for an MCQ
   * @returns The most popular choice or null if no consensus
   */
  getMCQConsensusAnswer(distribution: MCQDistribution): string | null {
    if (!this.hasReachedConsensus(distribution)) return null;
    
    let maxChoice = '';
    let maxCount = 0;
    
    for (const [choice, count] of Object.entries(distribution.choices)) {
      if (count > maxCount) {
        maxCount = count;
        maxChoice = choice;
      }
    }
    
    return maxChoice || null;
  }
  
  /**
   * Get the consensus score for an FRQ
   * @returns The mean score or null if no consensus
   */
  getFRQConsensusScore(distribution: FRQDistribution): number | null {
    if (!this.hasReachedConsensus(distribution)) return null;
    return distribution.mean;
  }
  
  /**
   * Determine if an attestation is in the minority
   * Used for minority bonus calculation
   */
  isMinorityAttestation(
    attestation: QuestionAttestation,
    distribution: QuestionDistribution
  ): boolean {
    if (!distribution) return false;
    
    if (isMCQDistribution(distribution) && 'answerHash' in attestation) {
      const choice = getChoiceFromHash(attestation.answerHash);
      if (!choice) return false;
      
      const choiceCount = distribution.choices[choice] || 0;
      const maxCount = Math.max(...Object.values(distribution.choices));
      
      // Minority if not the most popular choice but still correct
      return choiceCount < maxCount && choiceCount > 0;
    }
    
    if (isFRQDistribution(distribution) && 'score' in attestation) {
      // For FRQ, minority could be scores significantly different from mean
      const deviation = Math.abs(attestation.score - distribution.mean);
      return deviation > distribution.stdDev;
    }
    
    return false;
  }
}