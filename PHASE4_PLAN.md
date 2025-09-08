# Phase 4: QR Code Synchronization Implementation Plan

## Overview
Implement offline device synchronization via QR codes, enabling users to share blockchain state across devices without internet connectivity. This aligns with ADR-012 (Social Consensus) and ADR-028 (Emergent Attestation) by enabling distributed consensus gathering.

## Architecture

### File Structure
```
src/
├── sync/
│   ├── types.ts          # TypeScript interfaces for sync data
│   ├── diff.ts           # Diff extraction and delta calculation
│   ├── compression.ts    # LZ compression and chunking
│   ├── qr-protocol.ts    # QR chunk protocol implementation
│   ├── qr-display.ts     # QR code generation and cycling
│   ├── qr-scanner.ts     # HTML5 QR scanning and reassembly
│   ├── merger.ts         # State merging and recalculation
│   └── index.ts          # Main sync controller
├── ui/
│   └── sync-modal.ts     # Sync UI components
└── persistence/
    └── export.ts         # USB fallback export/import
```

## Data Structures (src/sync/types.ts)

```typescript
interface SyncDiff {
  fromTimestamp: number;      // Last sync point
  toTimestamp: number;        // Current sync point
  transactions: Transaction[]; // New transactions since lastSync
  blockHashes: string[];      // Block verification hashes
  version: string;            // Protocol version (1.0.0)
}

interface QRChunk {
  syncId: string;      // UUID for this sync session
  index: number;       // Chunk index (0-based)
  total: number;       // Total chunks
  data: string;        // Base64 compressed payload
  checksum: string;    // SHA-256 of complete data
}

interface QRProtocol {
  version: '1.0.0';
  maxChunkSize: 1500;  // Bytes per QR (alphanumeric mode)
  cycleInterval: 2000; // ms between QR displays
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

interface SyncSession {
  id: string;
  chunks: Map<number, string>;
  totalChunks: number;
  checksum: string;
  startTime: number;
  status: 'scanning' | 'processing' | 'complete' | 'error';
}

interface MergeResult {
  addedTransactions: number;
  updatedDistributions: string[]; // Question IDs
  reputationChanges: Map<string, number>;
  conflicts: ConflictReport[];
  success: boolean;
}

interface ConflictReport {
  type: 'duplicate' | 'invalid_signature' | 'rate_limit';
  transactionHash: string;
  resolution: 'skipped' | 'merged';
}
```

## Implementation Steps

### 1. Diff Extraction (src/sync/diff.ts)
```typescript
class DiffExtractor {
  extractDiff(blockchain: EnhancedBlockchain, lastSyncTimestamp: number): SyncDiff
  // - Filter transactions: tx.timestamp > lastSyncTimestamp
  // - Include only necessary fields (no redundant data)
  // - Sort by timestamp for deterministic ordering
  // - Calculate block hashes for verification
}
```

### 2. Compression & Chunking (src/sync/compression.ts)
```typescript
class Compressor {
  compress(diff: SyncDiff): string
  // - JSON.stringify(diff)
  // - LZ.compressToBase64() for ~60% reduction
  
  chunk(compressed: string, maxSize: number): QRChunk[]
  // - Split into 1.5KB chunks (QR alphanumeric limit)
  // - Add protocol headers (syncId, index, total)
  // - Calculate checksum for complete data
}
```

### 3. QR Display (src/sync/qr-display.ts)
```typescript
class QRDisplay {
  async displayCycle(chunks: QRChunk[], container: HTMLElement): Promise<void>
  // - Use qrcode.toCanvas() for rendering
  // - Cycle through chunks every 2 seconds
  // - Show progress: "Chunk 3/15"
  // - Add pause/resume controls
  // - Display sync ID for verification
}
```

### 4. QR Scanning (src/sync/qr-scanner.ts)
```typescript
class QRScanner {
  async startScanning(onComplete: (diff: SyncDiff) => void): Promise<void>
  // - Initialize html5-qrcode with camera
  // - Parse QR chunks, validate protocol
  // - Collect chunks in Map by index
  // - Verify checksum when complete
  // - Decompress and parse diff
  // - Handle duplicates/out-of-order chunks
}
```

### 5. State Merging (src/sync/merger.ts)
```typescript
class StateMerger {
  async merge(
    blockchain: EnhancedBlockchain,
    diff: SyncDiff
  ): Promise<MergeResult>
  // - Validate all transaction signatures
  // - Check rate limits (30-day rule)
  // - Detect and skip duplicates
  // - Add valid transactions to blockchain
  // - Recalculate distributions for affected questions
  // - Update reputation scores
  // - Return detailed merge report
}
```

### 6. UI Integration (src/ui/sync-modal.ts)
```typescript
class SyncModal {
  render(): HTMLElement
  // Modal with two main actions:
  // - "Share" button: Generate QR codes from current state
  // - "Scan" button: Start camera for scanning
  
  // Share flow:
  // 1. Calculate diff since last sync
  // 2. Compress and chunk
  // 3. Display cycling QR codes
  // 4. Show "Done" when cycle completes
  
  // Scan flow:
  // 1. Request camera permission
  // 2. Show camera preview
  // 3. Display chunk collection progress
  // 4. Show merge results
  // 5. Play success tone
}
```

### 7. Controller (src/sync/index.ts)
```typescript
class SyncController {
  constructor(
    blockchain: EnhancedBlockchain,
    profile: Profile
  )
  
  async shareState(): Promise<void>
  // Orchestrate: extract → compress → chunk → display
  
  async receiveState(): Promise<MergeResult>
  // Orchestrate: scan → decompress → merge → recalc
  
  private updateLastSync(timestamp: number): void
  // Store in localStorage for next diff
}
```

### 8. USB Fallback (src/persistence/export.ts)
```typescript
class USBExporter {
  async exportToZip(): Promise<Blob>
  // - Package complete state as JSON
  // - Compress to ZIP
  // - Trigger download
  
  async importFromZip(file: File): Promise<MergeResult>
  // - Unzip and parse
  // - Validate structure
  // - Merge via StateMerger
}
```

## UI Integration Points

### Modify src/ui/ui.ts
- Add 'sync' to ViewMode type
- Add sync button to header
- Handle sync modal display

### Modify src/ui/header.ts
- Add sync icon button (two phones with arrow)
- Position: right side near theme toggle
- Badge showing "last synced X days ago"

### Sync Modal Styling
```css
.sync-modal {
  /* Centered overlay */
  /* Two-column layout: Share | Scan */
  /* Progress indicators */
  /* Success animation (checkmark) */
}

.qr-display {
  /* 300x300px canvas */
  /* Chunk counter below */
  /* Pause/resume controls */
}

.qr-scanner {
  /* Camera preview */
  /* Scanning animation */
  /* Chunk collection progress */
}
```

## Testing Strategy

### Unit Tests
- Diff extraction with various state sizes
- Compression ratios and chunking boundaries
- QR protocol encoding/decoding
- Merge conflict resolution
- Rate limit enforcement

### Integration Tests
- Full sync cycle (share → scan → merge)
- Network of 3+ devices syncing
- Convergence after multiple syncs
- USB fallback import/export

### Edge Cases
- Empty diff (no new transactions)
- Large diff requiring 50+ QR codes
- Interrupted scanning (partial chunks)
- Conflicting transactions from multiple devices
- Clock skew between devices

## Dependencies

```json
{
  "lz-string": "^1.5.0",        // Compression
  "qrcode": "^1.5.3",           // QR generation
  "html5-qrcode": "^2.3.8",     // QR scanning
  "uuid": "^9.0.0"              // Sync session IDs
}
```

## Success Metrics
- Sync completes in <30 seconds for typical state
- Compression achieves >50% reduction
- QR scanning success rate >95%
- Zero data loss during sync
- Consensus convergence maintained post-merge

## Implementation Notes

1. **Progressive Enhancement**: Start with basic sync, add optimizations
2. **Error Recovery**: Each chunk can be rescanned if missed
3. **Security**: All transactions validated cryptographically
4. **Offline-First**: No network requests during sync
5. **User Feedback**: Clear progress indicators and success tones
6. **Accessibility**: USB fallback for devices without cameras

## ADR Alignment

- **ADR-012 (Social Consensus)**: Enables offline consensus gathering
- **ADR-028 (Emergent Attestation)**: Preserves all attestation properties during sync
- **Rate Limiting**: 30-day rule enforced during merge
- **Convergence**: Distributions recalculated after merge
- **Reputation**: Scores updated based on merged attestations

## Next Steps for Implementation

1. Install dependencies: `npm install lz-string qrcode html5-qrcode uuid`
2. Create sync/ directory structure
3. Implement types.ts with all interfaces
4. Build diff.ts for transaction extraction
5. Implement compression.ts with LZ-string
6. Create QR display component
7. Implement scanner with html5-qrcode
8. Build merger with conflict resolution
9. Create UI modal
10. Add sync button to header
11. Test with multiple devices
12. Add USB fallback option