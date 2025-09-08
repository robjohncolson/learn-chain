/**
 * Phase 4: QR Sync Type Definitions
 * Core interfaces for offline device synchronization
 */

import { Transaction } from '../core/types';

export interface SyncDiff {
  fromTimestamp: number;
  toTimestamp: number;
  transactions: Transaction[];
  blockHashes: string[];
  version: string;
}

export interface QRChunk {
  syncId: string;
  index: number;
  total: number;
  data: string;
  checksum: string;
}

export interface QRProtocol {
  version: '1.0.0';
  maxChunkSize: 1500;
  cycleInterval: 2000;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export interface SyncSession {
  id: string;
  chunks: Map<number, string>;
  totalChunks: number;
  checksum: string;
  startTime: number;
  status: 'scanning' | 'processing' | 'complete' | 'error';
}

export interface MergeResult {
  addedTransactions: number;
  updatedDistributions: string[];
  reputationChanges: Map<string, number>;
  conflicts: ConflictReport[];
  success: boolean;
}

export interface ConflictReport {
  type: 'duplicate' | 'invalid_signature' | 'rate_limit';
  transactionHash: string;
  resolution: 'skipped' | 'merged';
}

export interface SyncMetadata {
  lastSyncTimestamp: number;
  deviceId: string;
  syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  timestamp: number;
  direction: 'sent' | 'received';
  transactionCount: number;
  deviceId: string;
}