/**
 * QR Code Display Module
 * Generates and cycles through QR codes for sync data transmission
 */

import QRCode from 'qrcode';
import { QRChunk, QRProtocol } from './types';
import { Compressor } from './compression';

export class QRDisplay {
  private compressor: Compressor;
  private protocol: QRProtocol;
  private cycleTimer: NodeJS.Timeout | null = null;
  private isPaused: boolean = false;
  private currentIndex: number = 0;

  constructor() {
    this.compressor = new Compressor();
    this.protocol = this.compressor.getProtocol();
  }

  /**
   * Display cycling QR codes in container
   */
  async displayCycle(
    chunks: QRChunk[],
    container: HTMLElement,
    onComplete?: () => void
  ): Promise<void> {
    // Clear container
    container.innerHTML = '';
    container.className = 'qr-display-container';

    // Create elements
    const canvas = document.createElement('canvas');
    canvas.className = 'qr-canvas';
    canvas.width = 300;
    canvas.height = 300;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'qr-info';

    const progressDiv = document.createElement('div');
    progressDiv.className = 'qr-progress';

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'qr-controls';

    // Add pause/resume button
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.className = 'btn-pause';
    pauseBtn.onclick = () => this.togglePause(pauseBtn);

    // Add manual navigation
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.className = 'btn-nav';
    prevBtn.onclick = () => this.showPrevious(chunks, canvas, infoDiv, progressDiv);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.className = 'btn-nav';
    nextBtn.onclick = () => this.showNext(chunks, canvas, infoDiv, progressDiv);

    controlsDiv.appendChild(prevBtn);
    controlsDiv.appendChild(pauseBtn);
    controlsDiv.appendChild(nextBtn);

    // Add sync ID display
    const syncIdDiv = document.createElement('div');
    syncIdDiv.className = 'sync-id';
    syncIdDiv.textContent = `Sync ID: ${chunks[0]?.syncId.substring(0, 8)}`;

    // Assemble container
    container.appendChild(syncIdDiv);
    container.appendChild(canvas);
    container.appendChild(infoDiv);
    container.appendChild(progressDiv);
    container.appendChild(controlsDiv);

    // Start cycling
    this.currentIndex = 0;
    await this.displayChunk(chunks[0], canvas, infoDiv, progressDiv, 0, chunks.length);
    
    // Set up cycle timer
    this.cycleTimer = setInterval(async () => {
      if (!this.isPaused) {
        this.currentIndex = (this.currentIndex + 1) % chunks.length;
        await this.displayChunk(
          chunks[this.currentIndex],
          canvas,
          infoDiv,
          progressDiv,
          this.currentIndex,
          chunks.length
        );

        // Check if cycle complete
        if (this.currentIndex === chunks.length - 1 && onComplete) {
          setTimeout(() => {
            this.stop();
            onComplete();
          }, this.protocol.cycleInterval);
        }
      }
    }, this.protocol.cycleInterval);
  }

  /**
   * Display single QR chunk
   */
  private async displayChunk(
    chunk: QRChunk,
    canvas: HTMLCanvasElement,
    infoDiv: HTMLElement,
    progressDiv: HTMLElement,
    index: number,
    total: number
  ): Promise<void> {
    // Encode chunk data
    const qrData = this.compressor.encodeChunk(chunk);

    // Generate QR code
    await QRCode.toCanvas(canvas, qrData, {
      errorCorrectionLevel: this.protocol.errorCorrection,
      margin: 2,
      scale: 6,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Update info
    infoDiv.innerHTML = `
      <strong>Chunk ${index + 1} of ${total}</strong><br>
      <span class="chunk-size">${chunk.data.length} bytes</span>
    `;

    // Update progress bar
    const progress = ((index + 1) / total) * 100;
    progressDiv.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="progress-text">${Math.round(progress)}% transmitted</div>
    `;
  }

  /**
   * Toggle pause/resume
   */
  private togglePause(button: HTMLButtonElement): void {
    this.isPaused = !this.isPaused;
    button.textContent = this.isPaused ? 'Resume' : 'Pause';
    button.classList.toggle('paused', this.isPaused);
  }

  /**
   * Show previous chunk manually
   */
  private async showPrevious(
    chunks: QRChunk[],
    canvas: HTMLCanvasElement,
    infoDiv: HTMLElement,
    progressDiv: HTMLElement
  ): Promise<void> {
    this.currentIndex = (this.currentIndex - 1 + chunks.length) % chunks.length;
    await this.displayChunk(
      chunks[this.currentIndex],
      canvas,
      infoDiv,
      progressDiv,
      this.currentIndex,
      chunks.length
    );
  }

  /**
   * Show next chunk manually
   */
  private async showNext(
    chunks: QRChunk[],
    canvas: HTMLCanvasElement,
    infoDiv: HTMLElement,
    progressDiv: HTMLElement
  ): Promise<void> {
    this.currentIndex = (this.currentIndex + 1) % chunks.length;
    await this.displayChunk(
      chunks[this.currentIndex],
      canvas,
      infoDiv,
      progressDiv,
      this.currentIndex,
      chunks.length
    );
  }

  /**
   * Stop cycling
   */
  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    this.isPaused = false;
    this.currentIndex = 0;
  }

  /**
   * Generate static QR code for single chunk
   */
  async generateSingleQR(chunk: QRChunk): Promise<string> {
    const qrData = this.compressor.encodeChunk(chunk);
    return await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: this.protocol.errorCorrection,
      margin: 2,
      scale: 6
    });
  }

  /**
   * Add display styles
   */
  static addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .qr-display-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .sync-id {
        font-family: monospace;
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
      }

      .qr-canvas {
        border: 2px solid #ddd;
        border-radius: 4px;
        margin: 10px 0;
      }

      .qr-info {
        text-align: center;
        margin: 10px 0;
        font-size: 14px;
      }

      .chunk-size {
        color: #666;
        font-size: 12px;
      }

      .qr-progress {
        width: 100%;
        max-width: 300px;
        margin: 10px 0;
      }

      .progress-bar {
        height: 20px;
        background: #f0f0f0;
        border-radius: 10px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #45a049);
        transition: width 0.3s ease;
      }

      .progress-text {
        text-align: center;
        margin-top: 5px;
        font-size: 12px;
        color: #666;
      }

      .qr-controls {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }

      .btn-nav, .btn-pause {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .btn-nav:hover, .btn-pause:hover {
        background: #f0f0f0;
      }

      .btn-pause.paused {
        background: #FFF3E0;
        border-color: #FF9800;
        color: #E65100;
      }
    `;
    document.head.appendChild(style);
  }
}