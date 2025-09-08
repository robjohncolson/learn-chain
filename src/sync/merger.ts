/**
 * State Merger Module
 * Merges synced transactions into blockchain with conflict resolution
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { Transaction } from '../core/types';
import { SyncDiff, MergeResult, ConflictReport } from './types';
import { validateSignature } from '../core/crypto';
import { ConsensusCalculator } from '../core/consensus';
import { DistributionTracker } from '../core/distributions';
import { ReputationCalculator } from '../reputation/calculator';

export class StateMerger {
  private blockchain: EnhancedBlockchain;
  private consensusCalculator: ConsensusCalculator;
  private distributionTracker: DistributionTracker;
  private reputationCalculator: ReputationCalculator;

  constructor(blockchain: EnhancedBlockchain) {
    this.blockchain = blockchain;
    this.consensusCalculator = new ConsensusCalculator();
    this.distributionTracker = new DistributionTracker();
    this.reputationCalculator = new ReputationCalculator();
  }

  /**
   * Merge sync diff into blockchain
   */
  async merge(diff: SyncDiff): Promise<MergeResult> {
    const result: MergeResult = {
      addedTransactions: 0,
      updatedDistributions: [],
      reputationChanges: new Map(),
      conflicts: [],
      success: false
    };

    try {
      // Validate diff version
      if (diff.version !== '1.0.0') {
        throw new Error(`Unsupported sync version: ${diff.version}`);
      }

      // Process each transaction
      for (const tx of diff.transactions) {
        const conflict = await this.processTransaction(tx, result);
        if (conflict) {
          result.conflicts.push(conflict);
        }
      }

      // Recalculate affected distributions
      await this.recalculateDistributions(result);

      // Update reputation scores
      await this.updateReputations(result);

      result.success = true;
      return result;
    } catch (err) {
      console.error('Merge failed:', err);
      result.success = false;
      return result;
    }
  }

  /**
   * Process individual transaction
   */
  private async processTransaction(
    tx: Transaction,
    result: MergeResult
  ): Promise<ConflictReport | null> {
    // Check for duplicate
    if (this.isDuplicate(tx)) {
      return {
        type: 'duplicate',
        transactionHash: tx.hash,
        resolution: 'skipped'
      };
    }

    // Validate signature
    if (!this.validateTransaction(tx)) {
      return {
        type: 'invalid_signature',
        transactionHash: tx.hash,
        resolution: 'skipped'
      };
    }

    // Check rate limits for attestations
    if (tx.txType === 'Attestation') {
      const rateLimitCheck = this.checkRateLimit(tx);
      if (!rateLimitCheck) {
        return {
          type: 'rate_limit',
          transactionHash: tx.hash,
          resolution: 'skipped'
        };
      }

      // Track affected question
      const questionId = (tx.data as any)?.questionId;
      if (questionId && !result.updatedDistributions.includes(questionId)) {
        result.updatedDistributions.push(questionId);
      }
    }

    // Add transaction to blockchain
    try {
      const added = await this.blockchain.addTransaction(tx);
      if (added) {
        result.addedTransactions++;
      }
    } catch (err) {
      console.error(`Failed to add transaction ${tx.hash}:`, err);
      return {
        type: 'invalid_signature',
        transactionHash: tx.hash,
        resolution: 'skipped'
      };
    }

    return null;
  }

  /**
   * Check if transaction already exists
   */
  private isDuplicate(tx: Transaction): boolean {
    const chain = (this.blockchain as any).chain || [];
    
    for (const block of chain) {
      if (block.transactions) {
        for (const existingTx of block.transactions) {
          if (existingTx.hash === tx.hash) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Validate transaction signature
   */
  private validateTransaction(tx: Transaction): boolean {
    try {
      // Reconstruct signed data
      const signedData = {
        prevHash: tx.prevHash,
        timestamp: tx.timestamp,
        attesterPubkey: tx.attesterPubkey,
        txType: tx.txType,
        data: tx.data
      };
      
      const message = JSON.stringify(signedData);
      return validateSignature(message, tx.signature, tx.attesterPubkey);
    } catch (err) {
      console.error('Signature validation failed:', err);
      return false;
    }
  }

  /**
   * Check rate limit (30 days per question per user)
   */
  private checkRateLimit(tx: Transaction): boolean {
    const attestationData = tx.data as any;
    if (!attestationData?.questionId) return true;
    
    const userId = tx.attesterPubkey;
    const questionId = attestationData.questionId;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    // Get existing attestations for this user/question
    const chain = (this.blockchain as any).chain || [];
    for (const block of chain) {
      if (block.transactions) {
        for (const existingTx of block.transactions) {
          if (existingTx.txType === 'Attestation' &&
              existingTx.attesterPubkey === userId) {
            const existingData = existingTx.data as any;
            if (existingData?.questionId === questionId) {
              const timeDiff = tx.timestamp - existingTx.timestamp;
              if (timeDiff < thirtyDaysMs) {
                return false; // Rate limit violated
              }
            }
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Recalculate distributions for affected questions
   */
  private async recalculateDistributions(result: MergeResult): Promise<void> {
    for (const questionId of result.updatedDistributions) {
      // Get all attestations for this question
      const attestations = this.getQuestionAttestations(questionId);
      
      // Update distribution
      const distributions = this.distributionTracker.getAllDistributions();
      this.consensusCalculator.updateDistributions(attestations, distributions);
      
      // Check for consensus
      const distribution = distributions.get(questionId);
      if (distribution) {
        const hasConsensus = this.consensusCalculator.calculateConsensus(
          attestations,
          distribution
        );
        
        if (hasConsensus) {
          console.log(`Consensus reached for question ${questionId}`);
        }
      }
    }
  }

  /**
   * Get all attestations for a question
   */
  private getQuestionAttestations(questionId: string): any[] {
    const attestations: any[] = [];
    const chain = (this.blockchain as any).chain || [];
    
    for (const block of chain) {
      if (block.transactions) {
        for (const tx of block.transactions) {
          if (tx.txType === 'Attestation') {
            const data = tx.data as any;
            if (data?.questionId === questionId) {
              attestations.push({
                userId: tx.attesterPubkey,
                timestamp: tx.timestamp,
                ...data
              });
            }
          }
        }
      }
    }
    
    return attestations;
  }

  /**
   * Update reputation scores based on new attestations
   */
  private async updateReputations(result: MergeResult): Promise<void> {
    // Get all users who made attestations
    const users = new Set<string>();
    const chain = (this.blockchain as any).chain || [];
    
    for (const block of chain) {
      if (block.transactions) {
        for (const tx of block.transactions) {
          if (tx.txType === 'Attestation') {
            users.add(tx.attesterPubkey);
          }
        }
      }
    }
    
    // Calculate new reputation for each user
    for (const userId of users) {
      const oldScore = this.getUserReputation(userId);
      const newScore = await this.calculateUserReputation(userId);
      
      if (oldScore !== newScore) {
        result.reputationChanges.set(userId, newScore - oldScore);
      }
    }
  }

  /**
   * Get current user reputation
   */
  private getUserReputation(userId: string): number {
    // This would typically be stored in the profile
    // For now, return a default
    return 0;
  }

  /**
   * Calculate user reputation based on attestations
   */
  private async calculateUserReputation(userId: string): Promise<number> {
    const userAttestations = this.getUserAttestations(userId);
    
    let totalScore = 0;
    for (const attestation of userAttestations) {
      // Check if attestation aligns with consensus
      const questionId = attestation.questionId;
      const distribution = this.distributionTracker.getAllDistributions().get(questionId);
      
      if (distribution) {
        // Calculate reward based on alignment with consensus
        const reward = this.reputationCalculator.calculateReward(
          attestation,
          distribution,
          attestation.confidence || 3
        );
        totalScore += reward;
      }
    }
    
    return totalScore;
  }

  /**
   * Get all attestations by a user
   */
  private getUserAttestations(userId: string): any[] {
    const attestations: any[] = [];
    const chain = (this.blockchain as any).chain || [];
    
    for (const block of chain) {
      if (block.transactions) {
        for (const tx of block.transactions) {
          if (tx.txType === 'Attestation' && tx.attesterPubkey === userId) {
            attestations.push({
              ...tx.data,
              timestamp: tx.timestamp,
              questionId: (tx.data as any).questionId
            });
          }
        }
      }
    }
    
    return attestations;
  }

  /**
   * Generate merge report
   */
  generateReport(result: MergeResult): string {
    const lines: string[] = [
      '=== Sync Merge Report ===',
      `Status: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      `Transactions Added: ${result.addedTransactions}`,
      `Distributions Updated: ${result.updatedDistributions.length}`,
      `Reputation Changes: ${result.reputationChanges.size} users`,
      `Conflicts: ${result.conflicts.length}`
    ];

    if (result.conflicts.length > 0) {
      lines.push('\nConflict Details:');
      const conflictCounts = new Map<string, number>();
      for (const conflict of result.conflicts) {
        conflictCounts.set(conflict.type, (conflictCounts.get(conflict.type) || 0) + 1);
      }
      for (const [type, count] of conflictCounts) {
        lines.push(`  - ${type}: ${count}`);
      }
    }

    if (result.reputationChanges.size > 0) {
      lines.push('\nTop Reputation Changes:');
      const changes = Array.from(result.reputationChanges.entries())
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5);
      for (const [userId, change] of changes) {
        const sign = change > 0 ? '+' : '';
        lines.push(`  - ${userId.substring(0, 8)}: ${sign}${change.toFixed(2)}`);
      }
    }

    return lines.join('\n');
  }
}