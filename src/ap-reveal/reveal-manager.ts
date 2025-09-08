/**
 * AP Reveal Manager
 * Orchestrates AP reveals after 50% convergence
 */

import { 
  APRevealData, 
  APRevealTransaction, 
  RevealConditions,
  RevealImpact 
} from './types';
import { AnonymityProvider } from './anonymity';
import { QuestionDistribution } from '../core/consensus';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { errorHandler } from '../error/error-handler';
import { BlockchainErrorImpl, ErrorCode, ErrorSeverity } from '../error/types';

export class APRevealManager {
  private anonymityProvider: AnonymityProvider;
  private revealHistory: Map<string, APRevealData[]>;
  private cooldowns: Map<string, number>;
  private conditions: RevealConditions;
  private blockchain: EnhancedBlockchain | null = null;

  constructor() {
    this.anonymityProvider = new AnonymityProvider();
    this.revealHistory = new Map();
    this.cooldowns = new Map();
    this.conditions = {
      minConvergence: 0.5,      // 50% convergence required
      minAttestations: 5,        // At least 5 attestations
      cooldownPeriod: 24 * 60 * 60 * 1000  // 24 hours between reveals
    };
  }

  /**
   * Initialize with blockchain instance
   */
  initialize(blockchain: EnhancedBlockchain): void {
    this.blockchain = blockchain;
  }

  /**
   * Check if reveal conditions are met
   */
  canReveal(distribution: QuestionDistribution): boolean {
    // Check convergence threshold
    if (distribution.convergence < this.conditions.minConvergence) {
      console.debug(`Convergence ${distribution.convergence} below threshold ${this.conditions.minConvergence}`);
      return false;
    }

    // Check minimum attestations
    if (distribution.totalAttestations < this.conditions.minAttestations) {
      console.debug(`Only ${distribution.totalAttestations} attestations, need ${this.conditions.minAttestations}`);
      return false;
    }

    // Check cooldown
    const lastReveal = this.cooldowns.get(distribution.questionId);
    if (lastReveal) {
      const timeSinceReveal = Date.now() - lastReveal;
      if (timeSinceReveal < this.conditions.cooldownPeriod) {
        console.debug(`Cooldown active: ${timeSinceReveal}ms since last reveal`);
        return false;
      }
    }

    // Check if reveal already exists
    const existingReveals = this.revealHistory.get(distribution.questionId) || [];
    if (existingReveals.length > 0) {
      // Allow multiple reveals only if consensus has shifted significantly
      const lastRevealConvergence = existingReveals[existingReveals.length - 1].convergenceAtReveal;
      if (Math.abs(distribution.convergence - lastRevealConvergence) < 0.2) {
        console.debug('Consensus has not shifted significantly since last reveal');
        return false;
      }
    }

    return true;
  }

  /**
   * Create an AP reveal for a question
   */
  createAPReveal(
    questionId: string,
    answer: string,
    hint: string,
    distribution: QuestionDistribution
  ): APRevealData {
    // Validate conditions
    if (!this.canReveal(distribution)) {
      throw new BlockchainErrorImpl(
        ErrorCode.REVEAL_TOO_EARLY,
        'AP reveal conditions not met',
        ErrorSeverity.WARNING,
        false
      ).withContext({ 
        convergence: distribution.convergence,
        attestations: distribution.totalAttestations 
      });
    }

    // Generate anonymous signature
    const anonymousSignature = this.anonymityProvider.generateOneTimeKey();

    // Create reveal data
    const revealData: APRevealData = {
      questionId,
      anonymousSignature,
      officialAnswer: hint, // Gentle correction, not full answer
      convergenceAtReveal: distribution.convergence,
      timestamp: Date.now(),
      revealType: distribution.type,
      metadata: this.generateMetadata(distribution, answer)
    };

    // Store reveal
    const reveals = this.revealHistory.get(questionId) || [];
    reveals.push(revealData);
    this.revealHistory.set(questionId, reveals);

    // Set cooldown
    this.cooldowns.set(questionId, Date.now());

    console.info(`AP reveal created for question ${questionId} at ${distribution.convergence} convergence`);

    return revealData;
  }

  /**
   * Generate metadata for reveal
   */
  private generateMetadata(
    distribution: QuestionDistribution,
    correctAnswer: string
  ): APRevealData['metadata'] {
    const metadata: APRevealData['metadata'] = {};

    if (distribution.type === 'MCQ' && distribution.mcqDistribution) {
      // Find most common wrong answer
      const wrongAnswers = Object.entries(distribution.mcqDistribution)
        .filter(([choice]) => choice !== correctAnswer)
        .sort(([, a], [, b]) => b - a);

      if (wrongAnswers.length > 0 && wrongAnswers[0][1] > 0) {
        metadata.commonMistakes = [
          `Many chose ${wrongAnswers[0][0]} - consider why ${correctAnswer} is more accurate`
        ];
      }

      metadata.explanation = this.generateMCQHint(correctAnswer, distribution);
    } else if (distribution.type === 'FRQ' && distribution.frqDistribution) {
      const avgScore = distribution.frqDistribution.mean;
      
      if (avgScore < 3) {
        metadata.rubricPoints = [
          'Focus on key concepts',
          'Provide specific examples',
          'Structure your response clearly'
        ];
      } else if (avgScore < 4) {
        metadata.rubricPoints = [
          'Add more detail to support points',
          'Connect ideas more explicitly',
          'Consider alternative perspectives'
        ];
      } else {
        metadata.rubricPoints = [
          'Strong responses overall',
          'Minor improvements in clarity possible'
        ];
      }

      metadata.explanation = this.generateFRQHint(avgScore);
    }

    return metadata;
  }

  /**
   * Generate MCQ hint without giving away answer
   */
  private generateMCQHint(correctAnswer: string, distribution: QuestionDistribution): string {
    const hints: Record<string, string> = {
      'A': 'Consider the first option more carefully',
      'B': 'The second choice has important implications',
      'C': 'The middle option often requires careful analysis',
      'D': 'Later options deserve consideration',
      'E': 'Don\'t overlook the final choice'
    };

    // Generic hint that doesn't reveal answer
    return hints[correctAnswer] || 'Review all options systematically';
  }

  /**
   * Generate FRQ hint based on average score
   */
  private generateFRQHint(avgScore: number): string {
    if (avgScore < 2) {
      return 'Review the fundamental concepts for this topic';
    } else if (avgScore < 3) {
      return 'Focus on providing more complete explanations';
    } else if (avgScore < 4) {
      return 'Good foundation - enhance with specific examples';
    } else {
      return 'Strong understanding demonstrated by most';
    }
  }

  /**
   * Process reveal impact on consensus
   */
  processRevealImpact(
    reveal: APRevealData,
    distribution: QuestionDistribution
  ): RevealImpact {
    const beforeConvergence = distribution.convergence;
    
    // Simulate impact (in real system, this would track actual changes)
    const impact: RevealImpact = {
      beforeConvergence,
      afterConvergence: beforeConvergence, // Will be updated after attestations
      usersAffected: []
    };

    // For MCQ, track if consensus shifts
    if (reveal.revealType === 'MCQ' && distribution.mcqDistribution) {
      const currentLeader = Object.entries(distribution.mcqDistribution)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (currentLeader) {
        impact.consensusShift = {
          from: currentLeader[0],
          to: reveal.officialAnswer.charAt(0) // Assuming hint contains the answer letter
        };
      }
    }

    // For FRQ, track score changes
    if (reveal.revealType === 'FRQ' && distribution.frqDistribution) {
      impact.consensusShift = {
        from: distribution.frqDistribution.mean,
        to: 4 // Assume reveal guides toward better scores
      };
    }

    return impact;
  }

  /**
   * Create AP reveal transaction
   */
  createRevealTransaction(reveal: APRevealData): APRevealTransaction {
    const tx: APRevealTransaction = {
      hash: this.generateTransactionHash(reveal),
      txType: 'APReveal',
      data: reveal,
      timestamp: reveal.timestamp,
      signature: reveal.anonymousSignature
    };

    return tx;
  }

  /**
   * Generate transaction hash
   */
  private generateTransactionHash(reveal: APRevealData): string {
    // Simple hash generation - in production would use proper crypto
    const data = JSON.stringify(reveal);
    return Array.from(data)
      .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
      .toString(16);
  }

  /**
   * Verify AP reveal authenticity
   */
  verifyReveal(reveal: APRevealData): boolean {
    // Verify anonymous signature
    if (!this.anonymityProvider.verifyAnonymousSignature(
      reveal.anonymousSignature,
      reveal
    )) {
      console.error('Invalid anonymous signature');
      return false;
    }

    // Verify convergence was actually at threshold
    if (reveal.convergenceAtReveal < this.conditions.minConvergence) {
      console.error('Reveal created before convergence threshold');
      return false;
    }

    // Verify not in cooldown (for new reveals)
    const lastReveal = this.cooldowns.get(reveal.questionId);
    if (lastReveal && reveal.timestamp - lastReveal < this.conditions.cooldownPeriod) {
      console.error('Reveal violates cooldown period');
      return false;
    }

    return true;
  }

  /**
   * Get reveal history for a question
   */
  getRevealHistory(questionId: string): APRevealData[] {
    return this.revealHistory.get(questionId) || [];
  }

  /**
   * Check if question has been revealed
   */
  hasBeenRevealed(questionId: string): boolean {
    return this.revealHistory.has(questionId);
  }

  /**
   * Get time until next reveal allowed
   */
  getTimeUntilReveal(questionId: string): number {
    const lastReveal = this.cooldowns.get(questionId);
    if (!lastReveal) {
      return 0; // Can reveal now
    }

    const timeSinceReveal = Date.now() - lastReveal;
    const timeRemaining = this.conditions.cooldownPeriod - timeSinceReveal;
    
    return Math.max(0, timeRemaining);
  }

  /**
   * Update reveal conditions (admin function)
   */
  updateConditions(newConditions: Partial<RevealConditions>): void {
    this.conditions = {
      ...this.conditions,
      ...newConditions
    };
    
    console.info('AP reveal conditions updated:', this.conditions);
  }

  /**
   * Get current conditions
   */
  getConditions(): RevealConditions {
    return { ...this.conditions };
  }

  /**
   * Monitor for reveal opportunities
   */
  monitorForReveals(): void {
    if (!this.blockchain) {
      console.error('Blockchain not initialized');
      return;
    }

    const distributions = this.blockchain.getDistributions?.() || new Map();
    const opportunities: string[] = [];

    for (const [questionId, distribution] of distributions) {
      if (this.canReveal(distribution)) {
        opportunities.push(questionId);
      }
    }

    if (opportunities.length > 0) {
      console.info(`AP reveal opportunities detected for questions: ${opportunities.join(', ')}`);
      
      // In production, this would trigger actual reveals or notifications
      for (const questionId of opportunities) {
        this.notifyRevealOpportunity(questionId, distributions.get(questionId)!);
      }
    }
  }

  /**
   * Notify about reveal opportunity
   */
  private notifyRevealOpportunity(
    questionId: string,
    distribution: QuestionDistribution
  ): void {
    // This would integrate with UI to show reveal opportunity
    console.info(`Question ${questionId} ready for AP reveal:`, {
      convergence: distribution.convergence,
      attestations: distribution.totalAttestations,
      type: distribution.type
    });

    // Emit event or callback
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('apRevealReady', {
        detail: { questionId, distribution }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalReveals: number;
    questionsCovered: number;
    averageConvergenceAtReveal: number;
    revealsByType: Record<string, number>;
  } {
    let totalReveals = 0;
    let totalConvergence = 0;
    const revealsByType: Record<string, number> = {
      MCQ: 0,
      FRQ: 0
    };

    for (const reveals of this.revealHistory.values()) {
      for (const reveal of reveals) {
        totalReveals++;
        totalConvergence += reveal.convergenceAtReveal;
        revealsByType[reveal.revealType]++;
      }
    }

    return {
      totalReveals,
      questionsCovered: this.revealHistory.size,
      averageConvergenceAtReveal: totalReveals > 0 ? totalConvergence / totalReveals : 0,
      revealsByType
    };
  }

  /**
   * Reset manager (for testing)
   */
  reset(): void {
    this.revealHistory.clear();
    this.cooldowns.clear();
    this.anonymityProvider.reset();
  }
}

// Export singleton instance
export const apRevealManager = new APRevealManager();