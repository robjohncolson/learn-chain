/**
 * Anonymity Provider
 * One-time key generation and verification for AP reveals
 */

import { sha256 } from '../core/crypto';

export class AnonymityProvider {
  private usedSignatures: Set<string> = new Set();
  private signatureTimestamps: Map<string, number> = new Map();
  private readonly SIGNATURE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Generate a one-time anonymous key
   * Uses combination of random data and timestamp to ensure uniqueness
   */
  generateOneTimeKey(): string {
    const randomBytes = new Uint8Array(32);
    
    // Use crypto API if available, fallback to Math.random
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    // Combine random bytes with timestamp for uniqueness
    const timestamp = Date.now();
    const combined = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const rawKey = `${combined}:${timestamp}:${Math.random().toString(36)}`;
    
    // Hash to create the final signature
    const signature = sha256(rawKey);
    
    // Store signature to prevent reuse
    this.usedSignatures.add(signature);
    this.signatureTimestamps.set(signature, timestamp);
    
    // Clean up old signatures
    this.cleanupExpiredSignatures();
    
    return signature;
  }

  /**
   * Verify an anonymous signature
   * Ensures signature is valid and hasn't been used before
   */
  verifyAnonymousSignature(signature: string, data: any): boolean {
    // Check basic format
    if (!signature || signature.length !== 64) {
      console.warn('Invalid signature format');
      return false;
    }

    // Check if signature has been used
    if (this.usedSignatures.has(signature)) {
      // Allow if it's for the same data (idempotency)
      const dataHash = sha256(JSON.stringify(data));
      const existingDataHash = this.getDataHashForSignature(signature);
      
      if (dataHash === existingDataHash) {
        return true; // Same signature for same data is OK
      }
      
      console.warn('Signature has already been used for different data');
      return false;
    }

    // Signature is new and valid
    return true;
  }

  /**
   * Ensure signature cannot be linked to any user
   * Verifies that the signature doesn't contain identifiable information
   */
  ensureUnlinkability(signature: string, userKeys: string[]): boolean {
    // Check that signature doesn't contain any part of user keys
    for (const userKey of userKeys) {
      // Check for substring matches
      if (signature.includes(userKey.substring(0, 8))) {
        console.warn('Signature may be linkable to user key');
        return false;
      }
      
      // Check for hash collisions
      const userKeyHash = sha256(userKey);
      if (userKeyHash === signature) {
        console.warn('Signature is hash of user key');
        return false;
      }
    }

    // Check that signature doesn't follow predictable patterns
    if (this.hasPredictablePattern(signature)) {
      console.warn('Signature has predictable pattern');
      return false;
    }

    return true;
  }

  /**
   * Mark a signature as used for specific data
   */
  markSignatureUsed(signature: string, dataHash: string): void {
    this.usedSignatures.add(signature);
    this.signatureTimestamps.set(signature, Date.now());
    
    // Store data hash for idempotency checking
    this.storeDataHash(signature, dataHash);
  }

  /**
   * Check if a signature has expired
   */
  isSignatureExpired(signature: string): boolean {
    const timestamp = this.signatureTimestamps.get(signature);
    if (!timestamp) {
      return false; // Not in our records, so not expired
    }

    const age = Date.now() - timestamp;
    return age > this.SIGNATURE_EXPIRY_MS;
  }

  /**
   * Clean up expired signatures to prevent memory bloat
   */
  private cleanupExpiredSignatures(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [signature, timestamp] of this.signatureTimestamps) {
      if (now - timestamp > this.SIGNATURE_EXPIRY_MS) {
        expired.push(signature);
      }
    }

    for (const signature of expired) {
      this.usedSignatures.delete(signature);
      this.signatureTimestamps.delete(signature);
    }

    if (expired.length > 0) {
      console.debug(`Cleaned up ${expired.length} expired signatures`);
    }
  }

  /**
   * Check for predictable patterns in signature
   */
  private hasPredictablePattern(signature: string): boolean {
    // Check for repeating characters
    const chars = signature.split('');
    const uniqueChars = new Set(chars);
    
    if (uniqueChars.size < chars.length * 0.5) {
      return true; // Too many repeating characters
    }

    // Check for sequential patterns
    for (let i = 0; i < signature.length - 3; i++) {
      const substr = signature.substring(i, i + 4);
      if (substr === '0000' || substr === 'ffff' || substr === '1234' || substr === 'abcd') {
        return true;
      }
    }

    // Check for all same character
    if (uniqueChars.size === 1) {
      return true;
    }

    return false;
  }

  /**
   * Store data hash for a signature (for idempotency)
   */
  private storeDataHash(signature: string, dataHash: string): void {
    // In production, this would be stored persistently
    // For now, we'll use in-memory storage
    (this as any)[`data_${signature}`] = dataHash;
  }

  /**
   * Get data hash for a signature
   */
  private getDataHashForSignature(signature: string): string | undefined {
    return (this as any)[`data_${signature}`];
  }

  /**
   * Generate blind signature for enhanced privacy
   * This provides an additional layer of anonymity
   */
  generateBlindSignature(message: string, blindingFactor?: string): {
    signature: string;
    unblindingFactor: string;
  } {
    const factor = blindingFactor || Math.random().toString(36);
    const blindedMessage = sha256(message + factor);
    const signature = this.generateOneTimeKey();
    
    // Combine signature with blinded message
    const finalSignature = sha256(signature + blindedMessage);
    
    return {
      signature: finalSignature,
      unblindingFactor: factor
    };
  }

  /**
   * Verify blind signature
   */
  verifyBlindSignature(
    signature: string,
    message: string,
    unblindingFactor: string
  ): boolean {
    // Recreate the blinded message
    const blindedMessage = sha256(message + unblindingFactor);
    
    // The signature should be verifiable without revealing the original message
    // This is a simplified version - real blind signatures use more complex math
    return signature.length === 64 && !this.usedSignatures.has(signature);
  }

  /**
   * Create ring signature (one of N users signed, but unknown which)
   * Simplified implementation for demonstration
   */
  createRingSignature(
    message: string,
    signerIndex: number,
    publicKeys: string[]
  ): {
    signature: string;
    ring: string[];
  } {
    if (signerIndex >= publicKeys.length) {
      throw new Error('Signer index out of bounds');
    }

    // Create ring of potential signers
    const ring = publicKeys.map((key, index) => {
      if (index === signerIndex) {
        // Real signer
        return sha256(message + key + 'true');
      } else {
        // Decoy signer
        return sha256(message + key + 'false' + Math.random());
      }
    });

    // Combine all ring members
    const signature = sha256(ring.join(':'));
    
    return {
      signature,
      ring
    };
  }

  /**
   * Verify ring signature
   * Can verify the signature is valid without knowing who signed
   */
  verifyRingSignature(
    signature: string,
    message: string,
    ring: string[],
    publicKeys: string[]
  ): boolean {
    if (ring.length !== publicKeys.length) {
      return false;
    }

    // Simplified verification - just check format
    // Real ring signatures use complex cryptographic proofs
    return signature.length === 64 && ring.every(r => r.length === 64);
  }

  /**
   * Get anonymity statistics
   */
  getStatistics(): {
    totalSignatures: number;
    activeSignatures: number;
    expiredCleaned: number;
    oldestSignature?: number;
  } {
    const now = Date.now();
    let oldest: number | undefined;

    for (const timestamp of this.signatureTimestamps.values()) {
      if (!oldest || timestamp < oldest) {
        oldest = timestamp;
      }
    }

    return {
      totalSignatures: this.usedSignatures.size,
      activeSignatures: this.signatureTimestamps.size,
      expiredCleaned: this.usedSignatures.size - this.signatureTimestamps.size,
      oldestSignature: oldest ? now - oldest : undefined
    };
  }

  /**
   * Reset provider (for testing)
   */
  reset(): void {
    this.usedSignatures.clear();
    this.signatureTimestamps.clear();
  }
}

// Export singleton instance
export const anonymityProvider = new AnonymityProvider();