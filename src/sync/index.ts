/**
 * Sync Controller
 * Main orchestrator for QR code synchronization
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { Profile } from '../core/profile';
import { DiffExtractor } from './diff';
import { Compressor } from './compression';
import { QRDisplay } from './qr-display';
import { QRScanner } from './qr-scanner';
import { StateMerger } from './merger';
import { SyncDiff, MergeResult, SyncMetadata } from './types';
import { v4 as uuidv4 } from 'uuid';

export class SyncController {
  private blockchain: EnhancedBlockchain;
  private profile: Profile;
  private diffExtractor: DiffExtractor;
  private compressor: Compressor;
  private qrDisplay: QRDisplay;
  private qrScanner: QRScanner;
  private merger: StateMerger;
  private metadata: SyncMetadata;

  constructor(blockchain: EnhancedBlockchain, profile: Profile) {
    this.blockchain = blockchain;
    this.profile = profile;
    this.diffExtractor = new DiffExtractor(blockchain);
    this.compressor = new Compressor();
    this.qrDisplay = new QRDisplay();
    this.qrScanner = new QRScanner();
    this.merger = new StateMerger(blockchain);
    this.metadata = this.loadMetadata();
  }

  /**
   * Share current state via QR codes
   */
  async shareState(
    container: HTMLElement,
    onComplete?: () => void
  ): Promise<void> {
    try {
      // Extract diff since last sync
      const diff = this.diffExtractor.extractDiff(this.metadata.lastSyncTimestamp);
      
      // Check if there's anything to sync
      if (diff.transactions.length === 0) {
        this.showMessage(container, 'No new transactions to share', 'info');
        if (onComplete) onComplete();
        return;
      }

      // Show statistics
      this.showSyncStats(container, diff);

      // Compress the diff
      const compressed = this.compressor.compress(diff);
      const stats = this.compressor.getCompressionStats(diff, compressed);
      
      console.log(`Compression: ${stats.originalSize} → ${stats.compressedSize} bytes (${(stats.ratio * 100).toFixed(1)}% reduction)`);
      console.log(`Will generate ${stats.chunkCount} QR codes`);

      // Chunk the compressed data
      const syncId = uuidv4();
      const chunks = this.compressor.chunk(compressed, syncId);

      // Display QR codes
      await this.qrDisplay.displayCycle(chunks, container, () => {
        // Update metadata
        this.updateMetadata('sent', diff.transactions.length);
        
        // Show success message
        this.showMessage(container, 'Sync complete! All QR codes have been displayed.', 'success');
        
        if (onComplete) onComplete();
      });
    } catch (err) {
      console.error('Failed to share state:', err);
      this.showMessage(container, `Error: ${err}`, 'error');
    }
  }

  /**
   * Receive state via QR scanning
   */
  async receiveState(
    container: HTMLElement,
    onComplete?: (result: MergeResult) => void
  ): Promise<void> {
    try {
      // Create scanner UI
      const scannerUI = QRScanner.createScannerUI('qr-scanner');
      container.appendChild(scannerUI);

      // Start scanning
      await this.qrScanner.startScanning(
        'qr-scanner-camera',
        async (diff: SyncDiff) => {
          // Show processing message
          this.showMessage(container, 'Processing received data...', 'info');

          // Merge the diff
          const result = await this.merger.merge(diff);

          // Generate and show report
          const report = this.merger.generateReport(result);
          console.log(report);
          this.showMergeResult(container, result);

          // Update metadata
          if (result.success) {
            this.updateMetadata('received', result.addedTransactions);
          }

          // Play success sound
          if (result.success && result.addedTransactions > 0) {
            this.playSuccessSound();
          }

          if (onComplete) onComplete(result);
        },
        (progress: number) => {
          // Update progress UI
          const chunks = this.qrScanner['session']?.chunks.size || 0;
          const total = this.qrScanner['session']?.totalChunks || 0;
          QRScanner.updateProgress('qr-scanner', chunks, total);
        }
      );
    } catch (err) {
      console.error('Failed to receive state:', err);
      this.showMessage(container, `Error: ${err}`, 'error');
    }
  }

  /**
   * Stop any active sync operation
   */
  async stop(): Promise<void> {
    this.qrDisplay.stop();
    await this.qrScanner.stop();
  }

  /**
   * Load sync metadata
   */
  private loadMetadata(): SyncMetadata {
    const stored = localStorage.getItem('syncMetadata');
    if (stored) {
      return JSON.parse(stored);
    }
    
    return {
      lastSyncTimestamp: 0,
      deviceId: uuidv4(),
      syncHistory: []
    };
  }

  /**
   * Update and save metadata
   */
  private updateMetadata(direction: 'sent' | 'received', transactionCount: number): void {
    this.metadata.lastSyncTimestamp = Date.now();
    this.metadata.syncHistory.push({
      timestamp: Date.now(),
      direction,
      transactionCount,
      deviceId: this.metadata.deviceId
    });

    // Keep only last 10 sync entries
    if (this.metadata.syncHistory.length > 10) {
      this.metadata.syncHistory = this.metadata.syncHistory.slice(-10);
    }

    localStorage.setItem('syncMetadata', JSON.stringify(this.metadata));
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    if (this.metadata.lastSyncTimestamp > 0) {
      return new Date(this.metadata.lastSyncTimestamp);
    }
    return null;
  }

  /**
   * Get sync history
   */
  getSyncHistory(): typeof this.metadata.syncHistory {
    return [...this.metadata.syncHistory];
  }

  /**
   * Show sync statistics
   */
  private showSyncStats(container: HTMLElement, diff: SyncDiff): void {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'sync-stats';
    
    const timeSinceLastSync = Date.now() - this.metadata.lastSyncTimestamp;
    const days = Math.floor(timeSinceLastSync / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeSinceLastSync % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    statsDiv.innerHTML = `
      <h3>Sync Statistics</h3>
      <ul>
        <li>Transactions to share: <strong>${diff.transactions.length}</strong></li>
        <li>Time since last sync: <strong>${days}d ${hours}h</strong></li>
        <li>Estimated QR codes: <strong>${this.diffExtractor.estimateChunkCount(diff)}</strong></li>
      </ul>
    `;
    
    container.appendChild(statsDiv);
  }

  /**
   * Show merge result
   */
  private showMergeResult(container: HTMLElement, result: MergeResult): void {
    const resultDiv = document.createElement('div');
    resultDiv.className = `merge-result ${result.success ? 'success' : 'error'}`;
    
    resultDiv.innerHTML = `
      <h3>${result.success ? '✓ Sync Successful' : '✗ Sync Failed'}</h3>
      <ul>
        <li>Transactions added: <strong>${result.addedTransactions}</strong></li>
        <li>Questions updated: <strong>${result.updatedDistributions.length}</strong></li>
        <li>Reputation changes: <strong>${result.reputationChanges.size}</strong></li>
        ${result.conflicts.length > 0 ? `<li>Conflicts resolved: <strong>${result.conflicts.length}</strong></li>` : ''}
      </ul>
    `;
    
    container.innerHTML = '';
    container.appendChild(resultDiv);
  }

  /**
   * Show message
   */
  private showMessage(container: HTMLElement, message: string, type: 'info' | 'success' | 'error'): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `sync-message ${type}`;
    messageDiv.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(messageDiv);
  }

  /**
   * Play success sound
   */
  private playSuccessSound(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Success chord progression
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  }

  /**
   * Initialize styles
   */
  static initStyles(): void {
    QRDisplay.addStyles();
    QRScanner.addStyles();
    
    const style = document.createElement('style');
    style.textContent = `
      .sync-stats {
        padding: 15px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .sync-stats h3 {
        margin-top: 0;
        color: #333;
      }

      .sync-stats ul {
        list-style: none;
        padding: 0;
      }

      .sync-stats li {
        margin: 8px 0;
        color: #666;
      }

      .sync-message {
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        font-size: 16px;
      }

      .sync-message.info {
        background: #E3F2FD;
        color: #1976D2;
      }

      .sync-message.success {
        background: #E8F5E9;
        color: #388E3C;
      }

      .sync-message.error {
        background: #FFEBEE;
        color: #C62828;
      }

      .merge-result {
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
      }

      .merge-result.success {
        background: #E8F5E9;
        border: 2px solid #4CAF50;
      }

      .merge-result.error {
        background: #FFEBEE;
        border: 2px solid #F44336;
      }

      .merge-result h3 {
        margin-top: 0;
        color: #333;
      }

      .merge-result ul {
        list-style: none;
        padding: 0;
      }

      .merge-result li {
        margin: 8px 0;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }
}