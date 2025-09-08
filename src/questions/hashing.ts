// Phase 2: MCQ Answer Hashing
// ADR-028: SHA-256 hash validation for multiple choice answers

import { createHash } from 'crypto';

/**
 * Hashes an MCQ answer choice using SHA-256
 * Per ADR-028: All MCQ answers are hashed before attestation
 * @param choice The answer choice key ('A', 'B', 'C', 'D', or 'E')
 * @returns SHA-256 hash of the choice
 */
export function hashMCQAnswer(choice: string): string {
  if (!['A', 'B', 'C', 'D', 'E'].includes(choice.toUpperCase())) {
    throw new Error(`Invalid MCQ choice: ${choice}. Must be A, B, C, D, or E`);
  }
  
  const hash = createHash('sha256');
  hash.update(choice.toUpperCase());
  return hash.digest('hex');
}

/**
 * Verifies an MCQ answer hash matches the expected choice
 * @param answerHash The SHA-256 hash to verify
 * @param choice The choice to check against
 * @returns True if the hash matches the choice
 */
export function verifyMCQAnswerHash(answerHash: string, choice: string): boolean {
  try {
    const expectedHash = hashMCQAnswer(choice);
    return answerHash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * Pre-computed hashes for standard MCQ choices for quick lookup
 * These can be used for optimization in consensus calculations
 */
export const MCQ_CHOICE_HASHES = {
  A: hashMCQAnswer('A'),
  B: hashMCQAnswer('B'),
  C: hashMCQAnswer('C'),
  D: hashMCQAnswer('D'),
  E: hashMCQAnswer('E')
} as const;

/**
 * Reverse lookup: given a hash, return the choice (if valid)
 * @param hash The SHA-256 hash to lookup
 * @returns The choice key or null if not found
 */
export function getChoiceFromHash(hash: string): string | null {
  for (const [choice, choiceHash] of Object.entries(MCQ_CHOICE_HASHES)) {
    if (hash === choiceHash) {
      return choice;
    }
  }
  return null;
}