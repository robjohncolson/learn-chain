/**
 * AP Reveal Types
 * Types for AP reveal system (post-50% convergence)
 */

export interface APRevealData {
  questionId: string;
  anonymousSignature: string;
  officialAnswer: string; // Hint or gentle correction
  convergenceAtReveal: number;
  timestamp: number;
  revealType: 'MCQ' | 'FRQ';
  metadata?: {
    explanation?: string;
    rubricPoints?: string[];
    commonMistakes?: string[];
  };
}

export interface APRevealTransaction {
  hash: string;
  txType: 'APReveal';
  data: APRevealData;
  timestamp: number;
  signature: string; // Anonymous one-time signature
}

export interface RevealConditions {
  minConvergence: number; // Default 0.5 (50%)
  minAttestations: number; // Minimum attestations required
  cooldownPeriod: number; // Time between reveals for same question
}

export interface RevealImpact {
  beforeConvergence: number;
  afterConvergence: number;
  usersAffected: string[];
  consensusShift?: {
    from: string | number;
    to: string | number;
  };
}