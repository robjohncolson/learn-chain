// Phase 2: Distribution Tracking System
// Manages and persists question consensus distributions

import { 
  QuestionDistribution, 
  MCQDistribution, 
  FRQDistribution,
  isMCQDistribution,
  isFRQDistribution
} from './consensus.js';
import { QuestionAttestation } from '../questions/types.js';

export class DistributionTracker {
  private distributions: Map<string, QuestionDistribution>;
  private attestationHistory: Map<string, QuestionAttestation[]>;
  
  constructor() {
    this.distributions = new Map();
    this.attestationHistory = new Map();
  }
  
  /**
   * Get distribution for a specific question
   */
  getDistribution(questionId: string): QuestionDistribution | undefined {
    return this.distributions.get(questionId);
  }
  
  /**
   * Set or update a distribution
   */
  setDistribution(questionId: string, distribution: QuestionDistribution): void {
    this.distributions.set(questionId, distribution);
  }
  
  /**
   * Get all distributions
   */
  getAllDistributions(): Map<string, QuestionDistribution> {
    return new Map(this.distributions);
  }
  
  /**
   * Add attestation to history
   */
  addAttestationToHistory(attestation: QuestionAttestation): void {
    const questionId = attestation.questionId;
    const history = this.attestationHistory.get(questionId) || [];
    history.push(attestation);
    this.attestationHistory.set(questionId, history);
  }
  
  /**
   * Get attestation history for a question
   */
  getAttestationHistory(questionId: string): QuestionAttestation[] {
    return this.attestationHistory.get(questionId) || [];
  }
  
  /**
   * Get questions that have reached consensus
   */
  getConsensusQuestions(minConvergence: number = 0.5): string[] {
    const consensusQuestions: string[] = [];
    
    for (const [questionId, distribution] of this.distributions) {
      if (distribution.convergence >= minConvergence) {
        consensusQuestions.push(questionId);
      }
    }
    
    return consensusQuestions;
  }
  
  /**
   * Get distribution statistics
   */
  getStatistics(): {
    totalQuestions: number;
    mcqQuestions: number;
    frqQuestions: number;
    averageConvergence: number;
    totalAttestations: number;
  } {
    let mcqCount = 0;
    let frqCount = 0;
    let totalConvergence = 0;
    let totalAttestations = 0;
    
    for (const distribution of this.distributions.values()) {
      if (isMCQDistribution(distribution)) {
        mcqCount++;
      } else if (isFRQDistribution(distribution)) {
        frqCount++;
      }
      
      totalConvergence += distribution.convergence;
      totalAttestations += distribution.totalAttestations;
    }
    
    const totalQuestions = this.distributions.size;
    const averageConvergence = totalQuestions > 0 
      ? totalConvergence / totalQuestions 
      : 0;
    
    return {
      totalQuestions,
      mcqQuestions: mcqCount,
      frqQuestions: frqCount,
      averageConvergence,
      totalAttestations
    };
  }
  
  /**
   * Clear all distributions and history
   */
  clear(): void {
    this.distributions.clear();
    this.attestationHistory.clear();
  }
  
  /**
   * Export distributions for persistence
   */
  export(): {
    distributions: Array<[string, QuestionDistribution]>;
    attestationHistory: Array<[string, QuestionAttestation[]]>;
  } {
    return {
      distributions: Array.from(this.distributions.entries()),
      attestationHistory: Array.from(this.attestationHistory.entries())
    };
  }
  
  /**
   * Import distributions from persistence
   */
  import(data: {
    distributions: Array<[string, QuestionDistribution]>;
    attestationHistory: Array<[string, QuestionAttestation[]]>;
  }): void {
    this.distributions = new Map(data.distributions);
    this.attestationHistory = new Map(data.attestationHistory);
  }
  
  /**
   * Get top questions by convergence
   */
  getTopQuestionsByConvergence(limit: number = 10): QuestionDistribution[] {
    const sorted = Array.from(this.distributions.values())
      .sort((a, b) => b.convergence - a.convergence);
    
    return sorted.slice(0, limit);
  }
  
  /**
   * Get questions needing more attestations
   */
  getQuestionsNeedingAttestations(quorumThreshold: number = 3): string[] {
    const needingAttestations: string[] = [];
    
    for (const [questionId, distribution] of this.distributions) {
      if (distribution.totalAttestations < quorumThreshold) {
        needingAttestations.push(questionId);
      }
    }
    
    return needingAttestations;
  }
  
  /**
   * Calculate time since last attestation for a question
   */
  getTimeSinceLastAttestation(questionId: string): number | null {
    const distribution = this.distributions.get(questionId);
    if (!distribution) return null;
    
    const now = Date.now();
    return now - distribution.lastUpdated;
  }
}