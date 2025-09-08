// Phase 2: Enhanced Blockchain with Consensus Integration
// Extends Phase 1 blockchain with ADR-028 features

import { Blockchain as Phase1Blockchain, createTransaction } from './blockchain';
import { Transaction, AttestationData } from './types';
import { ConsensusCalculator, QuestionDistribution } from './consensus';
import { DistributionTracker } from './distributions';
import { ReputationCalculator } from '../reputation/calculator';
import { OutlierDetector } from './outliers';
import { RateLimiter } from './rate-limiter';
import { MCQAttestation, FRQAttestation, QuestionAttestation } from '../questions/types';
import { hashMCQAnswer } from '../questions/hashing';
import type { ConsensusData } from '../types/consensus';

// Extended attestation data for Phase 2
export interface Phase2AttestationData extends AttestationData {
  score?: number; // FRQ score (1-5)
  confidence?: number; // Confidence level (1-5)
}

// Extended transaction for Phase 2
export interface Phase2Transaction extends Transaction {
  data: Phase2AttestationData | any;
}

export class EnhancedBlockchain extends Phase1Blockchain {
  private consensusCalculator: ConsensusCalculator;
  private distributionTracker: DistributionTracker;
  private reputationCalculator: ReputationCalculator;
  private outlierDetector: OutlierDetector;
  private rateLimiter: RateLimiter;
  private userReputations: Map<string, number>;
  
  constructor() {
    super();
    this.consensusCalculator = new ConsensusCalculator();
    this.distributionTracker = new DistributionTracker();
    this.reputationCalculator = new ReputationCalculator();
    this.outlierDetector = new OutlierDetector();
    this.rateLimiter = new RateLimiter();
    this.userReputations = new Map();
  }
  
  /**
   * Override addTransaction to include Phase 2 features
   */
  async addTransaction(transaction: Transaction): Promise<boolean> {
    // Phase 1 validation
    const baseValid = await super.addTransaction(transaction);
    if (!baseValid) return false;
    
    // Phase 2: Process attestation transactions
    if (transaction.txType === 'Attestation') {
      return await this.processAttestation(transaction as Phase2Transaction);
    }
    
    return true;
  }
  
  /**
   * Process attestation with consensus and reputation
   */
  private async processAttestation(transaction: Phase2Transaction): Promise<boolean> {
    const attestationData = transaction.data as Phase2AttestationData;
    const userId = transaction.attesterPubkey;
    const questionId = attestationData.questionId;
    
    // Check rate limiting (30 days per ADR-028)
    if (!this.rateLimiter.canAttest(userId, questionId)) {
      console.error(`Rate limit exceeded for user ${userId} on question ${questionId}`);
      return false;
    }
    
    // Convert to QuestionAttestation format
    const attestation = this.transactionToAttestation(transaction);
    if (!attestation) {
      console.error('Invalid attestation format');
      return false;
    }
    
    // Check for outliers
    const existingAttestations = this.distributionTracker.getAttestationHistory(questionId);
    const outliers = this.outlierDetector.detectOutliers([...existingAttestations, attestation]);
    if (outliers.includes(userId)) {
      console.warn(`Potential outlier detected for user ${userId}`);
      // Don't reject, but flag for review
    }
    
    // Update distributions
    const distributions = this.distributionTracker.getAllDistributions();
    this.consensusCalculator.updateDistributions([attestation], distributions);
    
    // Get updated distribution
    const distribution = distributions.get(questionId);
    if (!distribution) {
      console.error('Failed to update distribution');
      return false;
    }
    
    // Save updated distribution
    this.distributionTracker.setDistribution(questionId, distribution);
    this.distributionTracker.addAttestationToHistory(attestation);
    
    // Check if consensus reached
    if (this.consensusCalculator.hasReachedConsensus(distribution)) {
      await this.processConsensusReached(questionId, distribution);
    }
    
    // Update rate limiter
    this.rateLimiter.recordAttestation(userId, questionId);
    
    return true;
  }
  
  /**
   * Convert transaction to attestation format
   */
  private transactionToAttestation(transaction: Phase2Transaction): QuestionAttestation | null {
    const data = transaction.data as Phase2AttestationData;
    
    if (data.answerHash) {
      // MCQ Attestation
      const mcqAttestation: MCQAttestation = {
        questionId: data.questionId,
        answerHash: data.answerHash,
        timestamp: transaction.timestamp,
        attesterPubkey: transaction.attesterPubkey,
        signature: transaction.signature
      };
      return mcqAttestation;
    } else if (data.answerText && data.score !== undefined) {
      // FRQ Attestation
      const frqAttestation: FRQAttestation = {
        questionId: data.questionId,
        answerText: data.answerText,
        score: data.score,
        confidence: data.confidence || 3,
        timestamp: transaction.timestamp,
        attesterPubkey: transaction.attesterPubkey,
        signature: transaction.signature
      };
      return frqAttestation;
    }
    
    return null;
  }
  
  /**
   * Process when consensus is reached for a question
   */
  private async processConsensusReached(
    questionId: string,
    distribution: QuestionDistribution
  ): Promise<void> {
    console.log(`Consensus reached for question ${questionId} with convergence ${distribution.convergence}`);
    
    // Calculate rewards for all participants
    const attestations = this.distributionTracker.getAttestationHistory(questionId);
    
    for (const attestation of attestations) {
      const userId = attestation.attesterPubkey;
      const reward = this.reputationCalculator.calculateReward(attestation, distribution);
      
      // Update user reputation
      const currentRep = this.userReputations.get(userId) || 0;
      this.userReputations.set(userId, currentRep + reward);
      
      console.log(`User ${userId} earned ${reward.toFixed(2)} reputation points`);
    }
  }
  
  /**
   * Get user reputation
   */
  getUserReputation(userId: string): number {
    return this.userReputations.get(userId) || 0;
  }
  
  /**
   * Get consensus statistics
   */
  getConsensusStats(): {
    totalQuestions: number;
    consensusReached: number;
    averageConvergence: number;
    totalAttestations: number;
  } {
    const stats = this.distributionTracker.getStatistics();
    const consensusQuestions = this.distributionTracker.getConsensusQuestions();
    
    return {
      totalQuestions: stats.totalQuestions,
      consensusReached: consensusQuestions.length,
      averageConvergence: stats.averageConvergence,
      totalAttestations: stats.totalAttestations
    };
  }
  
  /**
   * Get attestations for a specific question
   */
  getAttestationsForQuestion(questionId: string): Transaction[] {
    return this.chain
      .flatMap(block => block.transactions)
      .filter(tx => 
        tx.txType === 'Attestation' && 
        (tx.data as AttestationData).questionId === questionId
      );
  }

  /**
   * Get consensus data for a question
   */
  getConsensusForQuestion(questionId: string): ConsensusData | null {
    const distribution = this.distributionTracker.getDistribution(questionId);
    if (!distribution) return null;

    // Format as ConsensusData
    const consensusData: ConsensusData = {
      type: distribution.mcqDistribution ? 'mcq' : 'frq',
      convergence: distribution.convergence || 0,
      totalAttestations: distribution.attestationCount || 0
    };

    if (distribution.mcqDistribution) {
      consensusData.mcq = {
        distribution: distribution.mcqDistribution,
        topChoice: Object.entries(distribution.mcqDistribution)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || ''
      };
    }

    if (distribution.frqScores && distribution.frqScores.length > 0) {
      const scores = distribution.frqScores;
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
      
      consensusData.frq = {
        scores,
        mean,
        stdDev: Math.sqrt(variance),
        peerAnswers: [] // TODO: Add peer answer storage
      };
    }

    return consensusData;
  }

  /**
   * Get attestation count for a user
   */
  getAttestationCount(pubkey: string): number {
    return this.chain
      .flatMap(block => block.transactions)
      .filter(tx => 
        tx.txType === 'Attestation' && 
        tx.attesterPubkey === pubkey
      ).length;
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(limit: number = 10): Transaction[] {
    const allTxs = this.chain
      .flatMap(block => block.transactions)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return allTxs.slice(0, limit);
  }

  /**
   * Get user reputation (async version)
   */
  async getUserReputation(pubkey: string): Promise<number> {
    return this.userReputations.get(pubkey) || 0;
  }

  /**
   * Get distribution for a specific question
   */
  getQuestionDistribution(questionId: string): QuestionDistribution | undefined {
    return this.distributionTracker.getDistribution(questionId);
  }
  
  /**
   * Get all distributions
   */
  getAllDistributions(): Map<string, QuestionDistribution> {
    return this.distributionTracker.getAllDistributions();
  }
  
  /**
   * Export enhanced blockchain state
   */
  exportState(): {
    chain: any[];
    distributions: any;
    reputations: Array<[string, number]>;
    rateLimits: any;
  } {
    return {
      chain: this.getChain(),
      distributions: this.distributionTracker.export(),
      reputations: Array.from(this.userReputations.entries()),
      rateLimits: this.rateLimiter.export()
    };
  }
  
  /**
   * Import enhanced blockchain state
   */
  importState(state: {
    chain: any[];
    distributions: any;
    reputations: Array<[string, number]>;
    rateLimits: any;
  }): boolean {
    try {
      // Load chain (Phase 1)
      this.loadChain(state.chain);
      
      // Load distributions
      this.distributionTracker.import(state.distributions);
      
      // Load reputations
      this.userReputations = new Map(state.reputations);
      
      // Load rate limits
      this.rateLimiter.import(state.rateLimits);
      
      return true;
    } catch (error) {
      console.error('Failed to import state:', error);
      return false;
    }
  }
  
  /**
   * Create MCQ attestation transaction
   */
  async createMCQAttestation(
    questionId: string,
    choice: string,
    attesterPubkey: string,
    privkey: string
  ): Promise<Transaction | null> {
    try {
      const answerHash = hashMCQAnswer(choice);
      const attestationData: Phase2AttestationData = {
        questionId,
        answerHash
      };
      
      return await createTransaction('Attestation', attestationData, attesterPubkey, privkey);
    } catch (error) {
      console.error('Failed to create MCQ attestation:', error);
      return null;
    }
  }
  
  /**
   * Create FRQ attestation transaction
   */
  async createFRQAttestation(
    questionId: string,
    answerText: string,
    score: number,
    confidence: number,
    attesterPubkey: string,
    privkey: string
  ): Promise<Transaction | null> {
    try {
      // Validate score and confidence
      if (score < 1 || score > 5) {
        throw new Error('Score must be between 1 and 5');
      }
      if (confidence < 1 || confidence > 5) {
        throw new Error('Confidence must be between 1 and 5');
      }
      
      const attestationData: Phase2AttestationData = {
        questionId,
        answerText,
        score,
        confidence
      };
      
      return await createTransaction('Attestation', attestationData, attesterPubkey, privkey);
    } catch (error) {
      console.error('Failed to create FRQ attestation:', error);
      return null;
    }
  }
}