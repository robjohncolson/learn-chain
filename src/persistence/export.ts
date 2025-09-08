/**
 * USB Export/Import Module
 * Fallback mechanism for devices without cameras
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { DiffExtractor } from '../sync/diff';
import { Compressor } from '../sync/compression';
import { StateMerger } from '../sync/merger';
import { SyncDiff, MergeResult } from '../sync/types';

export class USBExporter {
  private blockchain: EnhancedBlockchain;
  private diffExtractor: DiffExtractor;
  private compressor: Compressor;
  private merger: StateMerger;

  constructor(blockchain: EnhancedBlockchain) {
    this.blockchain = blockchain;
    this.diffExtractor = new DiffExtractor(blockchain);
    this.compressor = new Compressor();
    this.merger = new StateMerger(blockchain);
  }

  /**
   * Export blockchain state to ZIP file
   */
  async exportToZip(): Promise<void> {
    try {
      // Get last sync time from localStorage
      const metadata = this.getMetadata();
      const lastSync = metadata.lastSyncTimestamp || 0;
      
      // Extract diff
      const diff = this.diffExtractor.extractDiff(lastSync);
      
      // Create export data
      const exportData = {
        version: '1.0.0',
        exported: new Date().toISOString(),
        deviceId: metadata.deviceId,
        diff,
        metadata: {
          transactionCount: diff.transactions.length,
          fromTimestamp: diff.fromTimestamp,
          toTimestamp: diff.toTimestamp
        }
      };
      
      // Convert to JSON
      const json = JSON.stringify(exportData, null, 2);
      
      // Create blob
      const blob = new Blob([json], { type: 'application/json' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `ap-stats-sync-${timestamp}.json`;
      
      // Trigger download
      this.downloadFile(blob, filename);
      
      // Update metadata
      this.updateMetadata('exported', diff.transactions.length);
      
      // Show success message
      alert(`Exported ${diff.transactions.length} transactions to ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data: ' + err);
    }
  }

  /**
   * Import blockchain state from file
   */
  async importFromFile(file: File): Promise<MergeResult> {
    try {
      // Read file
      const text = await this.readFile(file);
      
      // Parse JSON
      const exportData = JSON.parse(text);
      
      // Validate format
      if (!exportData.version || !exportData.diff) {
        throw new Error('Invalid file format');
      }
      
      if (exportData.version !== '1.0.0') {
        throw new Error(`Unsupported version: ${exportData.version}`);
      }
      
      // Extract diff
      const diff: SyncDiff = exportData.diff;
      
      // Merge into blockchain
      const result = await this.merger.merge(diff);
      
      // Update metadata
      if (result.success) {
        this.updateMetadata('imported', result.addedTransactions);
      }
      
      // Generate report
      const report = this.merger.generateReport(result);
      console.log('Import Report:\n' + report);
      
      return result;
    } catch (err) {
      console.error('Import failed:', err);
      throw err;
    }
  }

  /**
   * Create file input for import
   */
  createImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) return;
      
      try {
        const result = await this.importFromFile(file);
        
        if (result.success) {
          alert(`Successfully imported ${result.addedTransactions} transactions`);
        } else {
          alert('Import completed with errors. Check console for details.');
        }
      } catch (err) {
        alert('Failed to import file: ' + err);
      }
      
      // Clear input
      input.value = '';
    };
    
    return input;
  }

  /**
   * Trigger import dialog
   */
  triggerImport(): void {
    const input = this.createImportInput();
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  /**
   * Export full blockchain (not just diff)
   */
  async exportFullState(): Promise<void> {
    try {
      // Get all transactions
      const diff = this.diffExtractor.extractDiff(0); // From beginning
      
      // Compress for smaller file
      const compressed = this.compressor.compress(diff);
      
      // Create export data
      const exportData = {
        version: '1.0.0',
        type: 'full',
        exported: new Date().toISOString(),
        compressed,
        metadata: {
          transactionCount: diff.transactions.length,
          compressed: true,
          compressionRatio: this.compressor.getCompressionStats(diff, compressed).ratio
        }
      };
      
      // Convert to JSON
      const json = JSON.stringify(exportData);
      
      // Create blob
      const blob = new Blob([json], { type: 'application/json' });
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `ap-stats-full-backup-${timestamp}.json`;
      
      // Trigger download
      this.downloadFile(blob, filename);
      
      alert(`Exported full blockchain (${diff.transactions.length} transactions) to ${filename}`);
    } catch (err) {
      console.error('Full export failed:', err);
      alert('Failed to export full state: ' + err);
    }
  }

  /**
   * Import full state (replaces current blockchain)
   */
  async importFullState(file: File): Promise<void> {
    const confirmReplace = confirm(
      'WARNING: This will replace your entire blockchain state. ' +
      'Your current data will be lost. Continue?'
    );
    
    if (!confirmReplace) return;
    
    try {
      // Read file
      const text = await this.readFile(file);
      const exportData = JSON.parse(text);
      
      // Validate
      if (exportData.type !== 'full') {
        throw new Error('Not a full backup file');
      }
      
      // Decompress if needed
      let diff: SyncDiff;
      if (exportData.compressed) {
        diff = this.compressor.decompress(exportData.compressed);
      } else {
        diff = exportData.diff;
      }
      
      // Clear current blockchain
      (this.blockchain as any).chain = [(this.blockchain as any).chain[0]]; // Keep genesis
      
      // Import all transactions
      const result = await this.merger.merge(diff);
      
      alert(`Imported ${result.addedTransactions} transactions from backup`);
    } catch (err) {
      console.error('Full import failed:', err);
      alert('Failed to import backup: ' + err);
    }
  }

  /**
   * Download file helper
   */
  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Read file helper
   */
  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Get sync metadata
   */
  private getMetadata(): any {
    const stored = localStorage.getItem('syncMetadata');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      lastSyncTimestamp: 0,
      deviceId: this.generateDeviceId(),
      syncHistory: []
    };
  }

  /**
   * Update metadata
   */
  private updateMetadata(action: string, count: number): void {
    const metadata = this.getMetadata();
    metadata.lastSyncTimestamp = Date.now();
    metadata.syncHistory.push({
      timestamp: Date.now(),
      action,
      transactionCount: count
    });
    
    // Keep only last 10 entries
    if (metadata.syncHistory.length > 10) {
      metadata.syncHistory = metadata.syncHistory.slice(-10);
    }
    
    localStorage.setItem('syncMetadata', JSON.stringify(metadata));
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    return 'device-' + Math.random().toString(36).substring(2, 15);
  }
}