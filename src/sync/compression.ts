/**
 * Compression and Chunking Module
 * Compresses sync data and splits into QR-sized chunks
 */

import * as LZString from 'lz-string';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { SyncDiff, QRChunk, QRProtocol } from './types';

export class Compressor {
  private protocol: QRProtocol = {
    version: '1.0.0',
    maxChunkSize: 1500,
    cycleInterval: 2000,
    errorCorrection: 'M'
  };

  /**
   * Compress sync diff to base64 string
   */
  compress(diff: SyncDiff): string {
    const json = JSON.stringify(diff);
    return LZString.compressToBase64(json);
  }

  /**
   * Decompress base64 string back to sync diff
   */
  decompress(compressed: string): SyncDiff {
    const json = LZString.decompressFromBase64(compressed);
    if (!json) {
      throw new Error('Failed to decompress data');
    }
    return JSON.parse(json);
  }

  /**
   * Split compressed data into QR chunks
   */
  chunk(compressed: string, syncId?: string): QRChunk[] {
    const chunks: QRChunk[] = [];
    const maxSize = this.protocol.maxChunkSize;
    const totalSize = compressed.length;
    const totalChunks = Math.ceil(totalSize / maxSize);
    const checksum = this.calculateChecksum(compressed);
    const sessionId = syncId || uuidv4();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * maxSize;
      const end = Math.min(start + maxSize, totalSize);
      const data = compressed.substring(start, end);

      chunks.push({
        syncId: sessionId,
        index: i,
        total: totalChunks,
        data,
        checksum
      });
    }

    return chunks;
  }

  /**
   * Reassemble chunks into compressed data
   */
  reassemble(chunks: QRChunk[]): string {
    // Validate all chunks are from same sync session
    const syncId = chunks[0]?.syncId;
    const checksum = chunks[0]?.checksum;
    const total = chunks[0]?.total;

    if (!syncId || !checksum || !total) {
      throw new Error('Invalid chunk data');
    }

    // Verify all chunks match session
    for (const chunk of chunks) {
      if (chunk.syncId !== syncId || chunk.checksum !== checksum) {
        throw new Error('Chunk mismatch - different sync sessions');
      }
    }

    // Check we have all chunks
    if (chunks.length !== total) {
      throw new Error(`Missing chunks: have ${chunks.length}, need ${total}`);
    }

    // Sort by index and concatenate
    chunks.sort((a, b) => a.index - b.index);
    const compressed = chunks.map(c => c.data).join('');

    // Verify checksum
    const actualChecksum = this.calculateChecksum(compressed);
    if (actualChecksum !== checksum) {
      throw new Error('Checksum verification failed');
    }

    return compressed;
  }

  /**
   * Calculate SHA-256 checksum of data
   */
  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encode chunk as QR-friendly string
   */
  encodeChunk(chunk: QRChunk): string {
    // Create compact header
    const header = [
      'QRS', // Protocol identifier
      this.protocol.version,
      chunk.syncId.substring(0, 8), // First 8 chars of UUID
      chunk.index,
      chunk.total,
      chunk.checksum.substring(0, 8) // First 8 chars of checksum
    ].join('|');

    return `${header}|${chunk.data}`;
  }

  /**
   * Decode QR string back to chunk
   */
  decodeChunk(qrData: string): QRChunk {
    const parts = qrData.split('|');
    
    if (parts.length < 7 || parts[0] !== 'QRS') {
      throw new Error('Invalid QR format');
    }

    const [protocol, version, syncIdPrefix, index, total, checksumPrefix, ...dataParts] = parts;
    
    return {
      syncId: syncIdPrefix, // Note: abbreviated in QR
      index: parseInt(index, 10),
      total: parseInt(total, 10),
      data: dataParts.join('|'), // Rejoin in case data contains |
      checksum: checksumPrefix // Note: abbreviated in QR
    };
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(original: SyncDiff, compressed: string): {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    chunkCount: number;
  } {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = compressed.length;
    const ratio = 1 - (compressedSize / originalSize);
    const chunkCount = Math.ceil(compressedSize / this.protocol.maxChunkSize);

    return {
      originalSize,
      compressedSize,
      ratio,
      chunkCount
    };
  }

  /**
   * Get protocol configuration
   */
  getProtocol(): QRProtocol {
    return { ...this.protocol };
  }
}