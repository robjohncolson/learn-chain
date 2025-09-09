/**
 * Local Testing Simulator
 * Simulates multi-user scenarios for testing consensus and anti-gaming
 */

import { 
  SimulatedUser, 
  UserBehavior, 
  SimulatedAttestation,
  TestQuestion,
  FRQRubric
} from './types';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { createTransaction } from '../core/blockchain';
import { AttestationData } from '../core/types';

// Define Profile interface locally to avoid import issues
interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
  reputationScore?: number;
}
import { sha256 } from '../core/crypto';
import { QuestionDistribution } from '../core/consensus';

export class LocalSimulator {
  private blockchain: EnhancedBlockchain;
  private users: Map<string, SimulatedUser>;
  private questionHistory: Map<string, SimulatedAttestation[]>;
  private timeAcceleration: number = 1; // Speed up time for testing

  constructor(blockchain?: EnhancedBlockchain) {
    this.blockchain = blockchain || new EnhancedBlockchain();
    this.users = new Map();
    this.questionHistory = new Map();
  }

  /**
   * Create simulated users with different behaviors
   */
  createSimulatedUsers(count: number, behaviors?: UserBehavior[]): SimulatedUser[] {
    const users: SimulatedUser[] = [];
    const defaultBehaviors = behaviors || this.getDefaultBehaviorMix(count);

    for (let i = 0; i < count; i++) {
      const behavior = defaultBehaviors[i % defaultBehaviors.length];
      const user = this.createUser(i, behavior);
      users.push(user);
      this.users.set(user.id, user);
    }

    return users;
  }

  /**
   * Create a single simulated user
   */
  private createUser(index: number, behavior: UserBehavior): SimulatedUser {
    const profile = new Profile();
    profile.username = `sim_user_${index}_${behavior.toLowerCase()}`;
    
    return {
      id: `user_${index}`,
      username: profile.username,
      pubkey: profile.pubkey,
      privkey: profile.privkey,
      reputationScore: 100,
      behavior,
      attestationHistory: []
    };
  }

  /**
   * Get default behavior mix for realistic simulation
   */
  private getDefaultBehaviorMix(count: number): UserBehavior[] {
    const mix: UserBehavior[] = [];
    
    // 60% honest users
    const honestCount = Math.floor(count * 0.6);
    for (let i = 0; i < honestCount; i++) {
      mix.push(UserBehavior.HONEST);
    }
    
    // 20% random users
    const randomCount = Math.floor(count * 0.2);
    for (let i = 0; i < randomCount; i++) {
      mix.push(UserBehavior.RANDOM);
    }
    
    // 10% lazy users
    const lazyCount = Math.floor(count * 0.1);
    for (let i = 0; i < lazyCount; i++) {
      mix.push(UserBehavior.LAZY);
    }
    
    // 5% outliers
    const outlierCount = Math.floor(count * 0.05);
    for (let i = 0; i < outlierCount; i++) {
      mix.push(UserBehavior.OUTLIER);
    }
    
    // 5% malicious
    const remaining = count - mix.length;
    for (let i = 0; i < remaining; i++) {
      mix.push(UserBehavior.MALICIOUS);
    }
    
    return mix;
  }

  /**
   * Simulate attestations for a question
   */
  async simulateAttestations(
    users: SimulatedUser[], 
    question: TestQuestion
  ): Promise<void> {
    const attestations: SimulatedAttestation[] = [];

    for (const user of users) {
      const attestation = await this.generateAttestation(user, question);
      attestations.push(attestation);
      
      // Add to blockchain
      await this.submitAttestation(user, question, attestation);
      
      // Small delay between attestations
      await this.delay(100 * this.timeAcceleration);
    }

    this.questionHistory.set(question.id, attestations);
  }

  /**
   * Generate attestation based on user behavior
   */
  private async generateAttestation(
    user: SimulatedUser,
    question: TestQuestion
  ): Promise<SimulatedAttestation> {
    let answer: string | number;
    let confidence: number;

    switch (user.behavior) {
      case UserBehavior.HONEST:
        answer = this.getHonestAnswer(question);
        confidence = 4 + Math.random(); // 4-5
        break;

      case UserBehavior.RANDOM:
        answer = this.getRandomAnswer(question);
        confidence = 2 + Math.random() * 2; // 2-4
        break;

      case UserBehavior.MALICIOUS:
        answer = this.getMaliciousAnswer(question);
        confidence = 5; // Always confident
        break;

      case UserBehavior.LAZY:
        answer = await this.getLazyAnswer(question);
        confidence = 3; // Medium confidence
        break;

      case UserBehavior.OUTLIER:
        answer = this.getOutlierAnswer(question);
        confidence = 5; // Very confident in extreme views
        break;

      case UserBehavior.COLLUDER:
        answer = await this.getColludedAnswer(question);
        confidence = 4;
        break;

      default:
        answer = this.getRandomAnswer(question);
        confidence = 3;
    }

    return {
      questionId: question.id,
      answer,
      timestamp: Date.now(),
      confidence: Math.min(5, Math.max(1, confidence))
    };
  }

  /**
   * Get honest answer (correct or close to correct)
   */
  private getHonestAnswer(question: TestQuestion): string | number {
    if (question.type === 'MCQ') {
      // 90% chance of correct answer
      if (Math.random() < 0.9 && question.correctAnswer) {
        return question.correctAnswer as string;
      }
      // Otherwise random from ABCDE
      return 'ABCDE'[Math.floor(Math.random() * 5)];
    } else {
      // FRQ: Return good score with some variation
      const baseScore = 4;
      const variation = (Math.random() - 0.5) * 1;
      return Math.round((baseScore + variation) * 2) / 2; // Round to nearest 0.5
    }
  }

  /**
   * Get random answer
   */
  private getRandomAnswer(question: TestQuestion): string | number {
    if (question.type === 'MCQ') {
      return 'ABCDE'[Math.floor(Math.random() * 5)];
    } else {
      return Math.round((1 + Math.random() * 4) * 2) / 2; // 1-5 in 0.5 increments
    }
  }

  /**
   * Get malicious answer (tries to game the system)
   */
  private getMaliciousAnswer(question: TestQuestion): string | number {
    if (question.type === 'MCQ') {
      // Always choose A (trying to skew distribution)
      return 'A';
    } else {
      // Always give perfect score (trying to inflate)
      return 5;
    }
  }

  /**
   * Get lazy answer (copies most common)
   */
  private async getLazyAnswer(question: TestQuestion): Promise<string | number> {
    const existing = this.questionHistory.get(question.id) || [];
    
    if (existing.length === 0) {
      return this.getRandomAnswer(question);
    }

    // Copy most common answer
    const answerCounts = new Map<string | number, number>();
    for (const att of existing) {
      const count = answerCounts.get(att.answer) || 0;
      answerCounts.set(att.answer, count + 1);
    }

    let maxCount = 0;
    let mostCommon = this.getRandomAnswer(question);
    
    for (const [answer, count] of answerCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = answer;
      }
    }

    return mostCommon;
  }

  /**
   * Get outlier answer (extreme values)
   */
  private getOutlierAnswer(question: TestQuestion): string | number {
    if (question.type === 'MCQ') {
      // Choose least popular option
      return 'E';
    } else {
      // Always extreme scores
      return Math.random() < 0.5 ? 1 : 5;
    }
  }

  /**
   * Get colluded answer (coordinate with other colluders)
   */
  private async getColludedAnswer(question: TestQuestion): Promise<string | number> {
    // All colluders agree on same answer
    if (question.type === 'MCQ') {
      return 'C'; // Predetermined choice
    } else {
      return 3.5; // Predetermined score
    }
  }

  /**
   * Submit attestation to blockchain
   */
  private async submitAttestation(
    user: SimulatedUser,
    question: TestQuestion,
    attestation: SimulatedAttestation
  ): Promise<void> {
    const attestationData: AttestationData = {
      questionId: question.id,
      confidence: attestation.confidence
    };

    if (question.type === 'MCQ') {
      attestationData.answerHash = sha256(attestation.answer as string);
      attestationData.answer = attestation.answer as string;
    } else {
      attestationData.score = attestation.answer as number;
      attestationData.answerText = `Simulated FRQ response with score ${attestation.answer}`;
    }

    const transaction = createTransaction(
      'Attestation',
      attestationData,
      user.privkey,
      user.pubkey
    );

    await this.blockchain.addTransaction(transaction);
    user.attestationHistory.push(attestation);
  }

  /**
   * Simulate sync between two users
   */
  async simulateSync(user1: SimulatedUser, user2: SimulatedUser): Promise<{
    success: boolean;
    transactionsSynced: number;
    conflicts: number;
  }> {
    // Get transactions from both users
    const user1Txs = this.blockchain.getAllTransactions()
      .filter(tx => tx.attesterPubkey === user1.pubkey);
    const user2Txs = this.blockchain.getAllTransactions()
      .filter(tx => tx.attesterPubkey === user2.pubkey);

    // Simulate merge
    const totalBefore = this.blockchain.getAllTransactions().length;
    
    // Merge user2 transactions into user1's view
    let conflicts = 0;
    let added = 0;
    
    for (const tx of user2Txs) {
      const exists = user1Txs.some(t => t.hash === tx.hash);
      if (!exists) {
        const success = await this.blockchain.addTransaction(tx);
        if (success) {
          added++;
        } else {
          conflicts++;
        }
      }
    }

    return {
      success: conflicts === 0,
      transactionsSynced: added,
      conflicts
    };
  }

  /**
   * Test progressive quorum
   */
  testProgressiveQuorum(attestations: number): {
    convergence: number;
    requiredQuorum: number;
    hasQuorum: boolean;
  } {
    // Simulate convergence based on attestation count
    const convergence = Math.min(0.95, attestations * 0.15);
    
    let requiredQuorum: number;
    if (convergence < 0.5) {
      requiredQuorum = 5;
    } else if (convergence < 0.8) {
      requiredQuorum = 4;
    } else {
      requiredQuorum = 3;
    }

    return {
      convergence,
      requiredQuorum,
      hasQuorum: attestations >= requiredQuorum
    };
  }

  /**
   * Test convergence calculation
   */
  testConvergence(distribution: QuestionDistribution): {
    type: 'MCQ' | 'FRQ';
    convergence: number;
    consensus: boolean;
    details: any;
  } {
    const result = {
      type: distribution.type,
      convergence: distribution.convergence,
      consensus: distribution.hasConsensus,
      details: {} as any
    };

    if (distribution.type === 'MCQ' && distribution.mcqDistribution) {
      const total = Object.values(distribution.mcqDistribution).reduce((a, b) => a + b, 0);
      const max = Math.max(...Object.values(distribution.mcqDistribution));
      result.details = {
        distribution: distribution.mcqDistribution,
        dominantChoice: Object.entries(distribution.mcqDistribution)
          .find(([_, count]) => count === max)?.[0],
        percentage: total > 0 ? (max / total * 100).toFixed(1) + '%' : '0%'
      };
    } else if (distribution.type === 'FRQ' && distribution.frqDistribution) {
      result.details = {
        mean: distribution.frqDistribution.mean.toFixed(2),
        stdDev: distribution.frqDistribution.stdDev.toFixed(2),
        scores: distribution.frqDistribution.scores,
        coefficientOfVariation: (distribution.frqDistribution.stdDev / distribution.frqDistribution.mean).toFixed(3)
      };
    }

    return result;
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting(user: SimulatedUser, questionId: string): Promise<{
    canAttest: boolean;
    timeUntilNext?: number;
  }> {
    // Check if user has attested to this question before
    const previousAttestation = user.attestationHistory.find(
      a => a.questionId === questionId
    );

    if (!previousAttestation) {
      return { canAttest: true };
    }

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const timeSinceLast = Date.now() - previousAttestation.timestamp;
    
    if (timeSinceLast >= thirtyDaysMs) {
      return { canAttest: true };
    }

    return {
      canAttest: false,
      timeUntilNext: thirtyDaysMs - timeSinceLast
    };
  }

  /**
   * Test outlier detection
   */
  testOutlierDetection(outlierUser: SimulatedUser, normalUsers: SimulatedUser[]): {
    isOutlier: boolean;
    reason?: string;
    zScore?: number;
  } {
    if (outlierUser.attestationHistory.length === 0) {
      return { isOutlier: false };
    }

    // Get all FRQ scores
    const allScores: number[] = [];
    
    for (const user of [...normalUsers, outlierUser]) {
      for (const att of user.attestationHistory) {
        if (typeof att.answer === 'number') {
          allScores.push(att.answer);
        }
      }
    }

    if (allScores.length < 5) {
      return { isOutlier: false, reason: 'Insufficient data' };
    }

    // Calculate statistics
    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const variance = allScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allScores.length;
    const stdDev = Math.sqrt(variance);

    // Check outlier's scores
    for (const att of outlierUser.attestationHistory) {
      if (typeof att.answer === 'number') {
        const zScore = Math.abs((att.answer - mean) / stdDev);
        if (zScore > 2) {
          return {
            isOutlier: true,
            reason: `Score ${att.answer} is ${zScore.toFixed(1)} standard deviations from mean`,
            zScore
          };
        }
      }
    }

    return { isOutlier: false };
  }

  /**
   * Helper: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms / this.timeAcceleration));
  }

  /**
   * Set time acceleration for faster testing
   */
  setTimeAcceleration(factor: number): void {
    this.timeAcceleration = Math.max(1, factor);
  }

  /**
   * Get current state summary
   */
  getStateSummary(): {
    users: number;
    transactions: number;
    questions: number;
    behaviors: Record<UserBehavior, number>;
  } {
    const behaviors: Record<UserBehavior, number> = {} as any;
    
    for (const user of this.users.values()) {
      behaviors[user.behavior] = (behaviors[user.behavior] || 0) + 1;
    }

    return {
      users: this.users.size,
      transactions: this.blockchain.getAllTransactions().length,
      questions: this.questionHistory.size,
      behaviors
    };
  }

  /**
   * Reset simulator
   */
  reset(): void {
    this.blockchain = new EnhancedBlockchain();
    this.users.clear();
    this.questionHistory.clear();
  }
}

// Export singleton instance
export const simulator = new LocalSimulator();