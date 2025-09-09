/**
 * Sync Modal UI Component
 * User interface for QR code synchronization
 */

import { SyncController } from '../sync';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { USBExporter } from '../persistence/export';

// Define Profile interface locally to avoid import issues
interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
  reputationScore?: number;
}

export class SyncModal {
  private syncController: SyncController;
  private modalElement: HTMLElement | null = null;
  private isOpen: boolean = false;

  constructor(blockchain: EnhancedBlockchain, profile: Profile) {
    this.syncController = new SyncController(blockchain, profile);
  }

  /**
   * Open sync modal
   */
  open(): void {
    if (this.isOpen) return;
    
    this.isOpen = true;
    this.modalElement = this.createModal();
    document.body.appendChild(this.modalElement);
    
    // Initialize styles if not already done
    SyncController.initStyles();
    
    // Animate in
    requestAnimationFrame(() => {
      this.modalElement?.classList.add('open');
    });
  }

  /**
   * Close sync modal
   */
  close(): void {
    if (!this.isOpen || !this.modalElement) return;
    
    this.isOpen = false;
    this.syncController.stop();
    
    // Animate out
    this.modalElement.classList.remove('open');
    setTimeout(() => {
      this.modalElement?.remove();
      this.modalElement = null;
    }, 300);
  }

  /**
   * Create modal element
   */
  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'sync-modal';
    
    // Modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.onclick = () => this.close();
    
    // Modal content
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.onclick = (e) => e.stopPropagation();
    
    // Header
    const header = this.createHeader();
    
    // Body
    const body = this.createBody();
    
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(backdrop);
    modal.appendChild(content);
    
    return modal;
  }

  /**
   * Create modal header
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h2');
    title.textContent = '📱 Device Sync';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => this.close();
    
    // Last sync info
    const lastSync = document.createElement('div');
    lastSync.className = 'last-sync';
    const lastSyncTime = this.syncController.getLastSyncTime();
    if (lastSyncTime) {
      const timeAgo = this.formatTimeAgo(lastSyncTime);
      lastSync.textContent = `Last synced: ${timeAgo}`;
    } else {
      lastSync.textContent = 'Never synced';
    }
    
    header.appendChild(title);
    header.appendChild(lastSync);
    header.appendChild(closeBtn);
    
    return header;
  }

  /**
   * Create modal body
   */
  private createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Initial view with two options
    const optionsView = this.createOptionsView();
    body.appendChild(optionsView);
    
    return body;
  }

  /**
   * Create options view (Share/Scan)
   */
  private createOptionsView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'sync-options';
    
    // Share option
    const shareOption = document.createElement('div');
    shareOption.className = 'sync-option';
    shareOption.innerHTML = `
      <div class="option-icon">📤</div>
      <h3>Share State</h3>
      <p>Generate QR codes to share your attestations with another device</p>
      <button class="btn-primary">Start Sharing</button>
    `;
    
    const shareBtn = shareOption.querySelector('button');
    shareBtn?.addEventListener('click', () => this.startSharing(container));
    
    // Scan option
    const scanOption = document.createElement('div');
    scanOption.className = 'sync-option';
    scanOption.innerHTML = `
      <div class="option-icon">📷</div>
      <h3>Scan & Receive</h3>
      <p>Use your camera to scan QR codes from another device</p>
      <button class="btn-primary">Start Scanning</button>
    `;
    
    const scanBtn = scanOption.querySelector('button');
    scanBtn?.addEventListener('click', () => this.startScanning(container));
    
    // USB fallback option
    const usbOption = document.createElement('div');
    usbOption.className = 'sync-option-secondary';
    usbOption.innerHTML = `
      <div class="option-icon">💾</div>
      <h3>USB Export/Import</h3>
      <p>No camera? Export to file instead</p>
      <div class="usb-buttons">
        <button class="btn-secondary" id="export-btn">Export</button>
        <button class="btn-secondary" id="import-btn">Import</button>
      </div>
    `;
    
    const exportBtn = usbOption.querySelector('#export-btn');
    exportBtn?.addEventListener('click', () => this.exportToFile());
    
    const importBtn = usbOption.querySelector('#import-btn');
    importBtn?.addEventListener('click', () => this.importFromFile());
    
    container.appendChild(shareOption);
    container.appendChild(scanOption);
    container.appendChild(usbOption);
    
    return container;
  }

  /**
   * Start sharing state
   */
  private async startSharing(container: HTMLElement): Promise<void> {
    container.innerHTML = '<div class="loading">Preparing sync data...</div>';
    
    // Create QR display container
    const qrContainer = document.createElement('div');
    qrContainer.className = 'qr-container';
    
    // Add back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '← Back';
    backBtn.onclick = () => {
      this.syncController.stop();
      container.innerHTML = '';
      container.appendChild(this.createOptionsView());
    };
    
    container.innerHTML = '';
    container.appendChild(backBtn);
    container.appendChild(qrContainer);
    
    // Start sharing
    await this.syncController.shareState(qrContainer, () => {
      // Add done button
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn-primary';
      doneBtn.textContent = 'Done';
      doneBtn.onclick = () => this.close();
      qrContainer.appendChild(doneBtn);
    });
  }

  /**
   * Start scanning
   */
  private async startScanning(container: HTMLElement): Promise<void> {
    container.innerHTML = '<div class="loading">Initializing camera...</div>';
    
    // Create scanner container
    const scanContainer = document.createElement('div');
    scanContainer.className = 'scan-container';
    
    // Add back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '← Back';
    backBtn.onclick = () => {
      this.syncController.stop();
      container.innerHTML = '';
      container.appendChild(this.createOptionsView());
    };
    
    container.innerHTML = '';
    container.appendChild(backBtn);
    container.appendChild(scanContainer);
    
    // Start scanning
    await this.syncController.receiveState(scanContainer, (result) => {
      if (result.success) {
        // Add done button
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn-primary';
        doneBtn.textContent = 'Done';
        doneBtn.onclick = () => this.close();
        scanContainer.appendChild(doneBtn);
      }
    });
  }

  /**
   * Export to file (USB fallback)
   */
  private async exportToFile(): Promise<void> {
    try {
      const exporter = new USBExporter(this.syncController['blockchain']);
      await exporter.exportToZip();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err);
    }
  }

  /**
   * Import from file (USB fallback)
   */
  private async importFromFile(): Promise<void> {
    try {
      const exporter = new USBExporter(this.syncController['blockchain']);
      exporter.triggerImport();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err);
    }
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 2592000)} months ago`;
  }

  /**
   * Add modal styles
   */
  static addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .sync-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .sync-modal.open {
        opacity: 1;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
      }

      .modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        max-width: 800px;
        width: 90%;
        max-height: 90vh;
        overflow: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      }

      .sync-modal.open .modal-content {
        transform: scale(1);
      }

      .modal-header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 24px;
        color: #333;
      }

      .last-sync {
        font-size: 14px;
        color: #666;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 30px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .close-btn:hover {
        color: #333;
      }

      .modal-body {
        padding: 20px;
        min-height: 400px;
      }

      .sync-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .sync-option {
        padding: 30px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        text-align: center;
        transition: all 0.2s;
      }

      .sync-option:hover {
        border-color: #4CAF50;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
      }

      .sync-option-secondary {
        grid-column: 1 / -1;
        padding: 20px;
        background: #f5f5f5;
        border-radius: 8px;
        text-align: center;
      }

      .option-icon {
        font-size: 48px;
        margin-bottom: 15px;
      }

      .sync-option h3,
      .sync-option-secondary h3 {
        margin: 10px 0;
        color: #333;
      }

      .sync-option p,
      .sync-option-secondary p {
        color: #666;
        margin: 10px 0 20px;
        font-size: 14px;
      }

      .btn-primary {
        background: #4CAF50;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .btn-primary:hover {
        background: #45a049;
      }

      .btn-secondary {
        background: white;
        color: #333;
        border: 1px solid #ddd;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-secondary:hover {
        background: #f0f0f0;
      }

      .usb-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
      }

      .btn-back {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 8px 16px;
        margin-bottom: 20px;
        font-size: 14px;
      }

      .btn-back:hover {
        color: #333;
      }

      .loading {
        text-align: center;
        padding: 40px;
        font-size: 16px;
        color: #666;
      }

      .qr-container,
      .scan-container {
        padding: 20px;
      }

      @media (max-width: 600px) {
        .sync-options {
          grid-template-columns: 1fr;
        }
        
        .modal-content {
          width: 95%;
        }
      }
    `;
    document.head.appendChild(style);
  }
}