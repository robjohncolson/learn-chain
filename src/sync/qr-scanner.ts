/**
 * QR Code Scanner Module
 * Scans and reassembles QR chunks from camera
 */

import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { QRChunk, SyncSession, SyncDiff } from './types';
import { Compressor } from './compression';

export class QRScanner {
  private compressor: Compressor;
  private scanner: Html5Qrcode | null = null;
  private session: SyncSession | null = null;
  private onProgressCallback: ((progress: number) => void) | null = null;

  constructor() {
    this.compressor = new Compressor();
  }

  /**
   * Start scanning QR codes
   */
  async startScanning(
    containerId: string,
    onComplete: (diff: SyncDiff) => void,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    this.onProgressCallback = onProgress || null;
    
    // Initialize scanner
    this.scanner = new Html5Qrcode(containerId);
    
    // Configure scanner
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    try {
      // Start scanning
      await this.scanner.start(
        { facingMode: 'environment' }, // Use back camera
        config,
        (decodedText: string) => {
          this.handleQRCode(decodedText, onComplete);
        },
        (errorMessage: string) => {
          // Ignore scan errors (common when no QR in view)
        }
      );
    } catch (err) {
      console.error('Failed to start scanner:', err);
      throw new Error('Camera access denied or not available');
    }
  }

  /**
   * Handle scanned QR code
   */
  private handleQRCode(qrData: string, onComplete: (diff: SyncDiff) => void): void {
    try {
      // Decode chunk
      const chunk = this.compressor.decodeChunk(qrData);
      
      // Initialize or update session
      if (!this.session || this.session.id !== chunk.syncId) {
        this.initializeSession(chunk);
      }
      
      // Add chunk to session
      this.addChunk(chunk);
      
      // Check if complete
      if (this.isSessionComplete()) {
        this.completeSession(onComplete);
      }
    } catch (err) {
      console.error('Failed to process QR code:', err);
      // Continue scanning
    }
  }

  /**
   * Initialize new sync session
   */
  private initializeSession(chunk: QRChunk): void {
    this.session = {
      id: chunk.syncId,
      chunks: new Map(),
      totalChunks: chunk.total,
      checksum: chunk.checksum,
      startTime: Date.now(),
      status: 'scanning'
    };
  }

  /**
   * Add chunk to current session
   */
  private addChunk(chunk: QRChunk): void {
    if (!this.session) return;
    
    // Skip if already have this chunk
    if (this.session.chunks.has(chunk.index)) {
      return;
    }
    
    // Add chunk
    this.session.chunks.set(chunk.index, chunk.data);
    
    // Update progress
    const progress = (this.session.chunks.size / this.session.totalChunks) * 100;
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
    
    // Play feedback sound
    this.playFeedback('chunk');
  }

  /**
   * Check if all chunks collected
   */
  private isSessionComplete(): boolean {
    if (!this.session) return false;
    return this.session.chunks.size === this.session.totalChunks;
  }

  /**
   * Complete session and reassemble data
   */
  private completeSession(onComplete: (diff: SyncDiff) => void): void {
    if (!this.session) return;
    
    this.session.status = 'processing';
    
    try {
      // Create chunk array from map
      const chunks: QRChunk[] = [];
      for (let i = 0; i < this.session.totalChunks; i++) {
        const data = this.session.chunks.get(i);
        if (!data) {
          throw new Error(`Missing chunk ${i}`);
        }
        chunks.push({
          syncId: this.session.id,
          index: i,
          total: this.session.totalChunks,
          data,
          checksum: this.session.checksum
        });
      }
      
      // Reassemble compressed data
      const compressed = this.compressor.reassemble(chunks);
      
      // Decompress to get sync diff
      const diff = this.compressor.decompress(compressed);
      
      // Mark complete
      this.session.status = 'complete';
      
      // Stop scanner
      this.stop();
      
      // Play success sound
      this.playFeedback('complete');
      
      // Callback with result
      onComplete(diff);
    } catch (err) {
      console.error('Failed to complete session:', err);
      this.session.status = 'error';
      throw err;
    }
  }

  /**
   * Stop scanning
   */
  async stop(): Promise<void> {
    if (this.scanner) {
      await this.scanner.stop();
      this.scanner = null;
    }
    this.session = null;
    this.onProgressCallback = null;
  }

  /**
   * Create scanner UI
   */
  static createScannerUI(containerId: string): HTMLElement {
    const container = document.createElement('div');
    container.id = containerId;
    container.className = 'qr-scanner-container';
    
    // Add camera view
    const cameraView = document.createElement('div');
    cameraView.id = `${containerId}-camera`;
    cameraView.className = 'camera-view';
    
    // Add progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.className = 'scan-progress';
    progressDiv.innerHTML = `
      <div class="scan-status">Scanning for QR codes...</div>
      <div class="chunks-collected">
        <span class="chunk-count">0</span> / <span class="chunk-total">?</span> chunks
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
    `;
    
    // Add instructions
    const instructions = document.createElement('div');
    instructions.className = 'scan-instructions';
    instructions.innerHTML = `
      <p>Hold your camera steady and scan each QR code as it appears.</p>
      <p>The app will automatically detect and collect all chunks.</p>
    `;
    
    container.appendChild(cameraView);
    container.appendChild(progressDiv);
    container.appendChild(instructions);
    
    return container;
  }

  /**
   * Update scanner UI with progress
   */
  static updateProgress(containerId: string, current: number, total: number): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const countSpan = container.querySelector('.chunk-count');
    const totalSpan = container.querySelector('.chunk-total');
    const progressFill = container.querySelector('.progress-fill') as HTMLElement;
    
    if (countSpan) countSpan.textContent = current.toString();
    if (totalSpan) totalSpan.textContent = total.toString();
    if (progressFill) {
      const percent = (current / total) * 100;
      progressFill.style.width = `${percent}%`;
    }
  }

  /**
   * Play feedback sound/vibration
   */
  private playFeedback(type: 'chunk' | 'complete'): void {
    // Vibration API (if available)
    if ('vibrate' in navigator) {
      if (type === 'chunk') {
        navigator.vibrate(50); // Short buzz
      } else {
        navigator.vibrate([100, 50, 100]); // Success pattern
      }
    }
    
    // Audio feedback (integrate with existing audio system)
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'chunk') {
      oscillator.frequency.value = 800; // High beep
      gainNode.gain.value = 0.1;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    } else {
      // Success chord
      oscillator.frequency.value = 523.25; // C5
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    }
  }

  /**
   * Add scanner styles
   */
  static addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .qr-scanner-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
      }

      .camera-view {
        width: 100%;
        max-width: 400px;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      }

      .camera-view video {
        width: 100%;
        height: auto;
      }

      .scan-progress {
        margin-top: 20px;
        width: 100%;
        max-width: 400px;
        text-align: center;
      }

      .scan-status {
        font-size: 16px;
        margin-bottom: 10px;
        color: #333;
      }

      .chunks-collected {
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
      }

      .chunk-count {
        font-weight: bold;
        color: #4CAF50;
      }

      .scan-instructions {
        margin-top: 20px;
        padding: 15px;
        background: #f5f5f5;
        border-radius: 8px;
        max-width: 400px;
      }

      .scan-instructions p {
        margin: 5px 0;
        font-size: 14px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }
}