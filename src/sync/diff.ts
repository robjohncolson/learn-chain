/**
 * Diff Extraction Module
 * Extracts transactions since last sync for QR transmission
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { Transaction } from '../core/types';
import { SyncDiff } from './types';
import { createHash } from 'crypto';

export class DiffExtractor {
  private blockchain: EnhancedBlockchain;

  constructor(blockchain: EnhancedBlockchain) {
    this.blockchain = blockchain;
  }

  /**
   * Extract diff since last sync timestamp
   */
  extractDiff(lastSyncTimestamp: number): SyncDiff {
    const currentTimestamp = Date.now();
    
    // Get all transactions from blockchain
    const allTransactions = this.getAllTransactions();
    
    // Filter transactions since last sync
    const newTransactions = allTransactions.filter(
      tx => tx.timestamp > lastSyncTimestamp
    );

    // Sort by timestamp for deterministic ordering
    newTransactions.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate block hashes for verification
    const blockHashes = this.calculateBlockHashes(newTransactions);

    return {
      fromTimestamp: lastSyncTimestamp,
      toTimestamp: currentTimestamp,
      transactions: this.minimizeTransactions(newTransactions),
      blockHashes,
      version: '1.0.0'
    };
  }

  /**
   * Get all transactions from blockchain
   */
  private getAllTransactions(): Transaction[] {
    const transactions: Transaction[] = [];
    const chain = (this.blockchain as any).chain || [];
    
    for (const block of chain) {
      if (block.transactions) {
        transactions.push(...block.transactions);
      }
    }
    
    return transactions;
  }

  /**
   * Remove redundant data from transactions for smaller QR codes
   */
  private minimizeTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.map(tx => ({
      hash: tx.hash,
      prevHash: tx.prevHash,
      timestamp: tx.timestamp,
      attesterPubkey: tx.attesterPubkey,
      signature: tx.signature,
      txType: tx.txType,
      data: this.minimizeData(tx.data)
    }));
  }

  /**
   * Minimize transaction data payload
   */
  private minimizeData(data: any): any {
    if (!data) return data;
    
    // Keep only essential fields for attestations
    if (data.questionId) {
      return {
        questionId: data.questionId,
        answerHash: data.answerHash,
        answerText: data.answerText,
        score: data.score,
        confidence: data.confidence,
        isMatch: data.isMatch
      };
    }
    
    return data;
  }

  /**
   * Calculate verification hashes for blocks
   */
  private calculateBlockHashes(transactions: Transaction[]): string[] {
    const hashes: string[] = [];
    const chunkSize = 10; // Group transactions into logical blocks
    
    for (let i = 0; i < transactions.length; i += chunkSize) {
      const chunk = transactions.slice(i, i + chunkSize);
      const hash = this.hashChunk(chunk);
      hashes.push(hash);
    }
    
    return hashes;
  }

  /**
   * Create hash of transaction chunk
   */
  private hashChunk(transactions: Transaction[]): string {
    const data = JSON.stringify(transactions.map(tx => tx.hash));
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Calculate diff size for UI display
   */
  calculateDiffSize(diff: SyncDiff): number {
    return JSON.stringify(diff).length;
  }

  /**
   * Estimate number of QR codes needed
   */
  estimateChunkCount(diff: SyncDiff, maxChunkSize: number = 1500): number {
    const jsonSize = this.calculateDiffSize(diff);
    // Estimate compression ratio (~60% reduction)
    const compressedSize = Math.ceil(jsonSize * 0.4);
    return Math.ceil(compressedSize / maxChunkSize);
  }
}