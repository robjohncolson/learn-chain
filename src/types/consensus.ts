/**
 * Consensus and attestation types for the Quiz Renderer module
 * Aligned with FUNDAMENTAL.md Blockchain (B) atoms and ADR-028
 */

import { Question } from './quiz';

// ============= Attestation Types =============

/** User attestation for a question */
export interface Attestation {
  /** Question being attested to */
  questionId: string;
  
  /** SHA-256 hash of MCQ answer (B atom) */
  answerHash?: string;
  
  /** FRQ response text */
  answerText?: string;
  
  /** FRQ score (1-5 scale per ADR-028) */
  score?: number;
  
  /** Attester's public key (B atom) */
  attesterPubkey: string;
  
  /** Cryptographic signature (B atom) */
  signature: string;
  
  /** Attestation confidence (1-5 scale per ADR-028) */
  confidence: number;
  
  /** Timestamp of attestation */
  timestamp: number;
  
  /** Whether this matches consensus */
  isMatch?: boolean;
}

// ============= Distribution Types =============

/** MCQ answer distribution */
export interface MCQDistribution {
  /** Map of choice letter to count */
  choices: Record<string, number>;
  
  /** Total number of attestations */
  total: number;
  
  /** Most popular choice */
  mode: string;
  
  /** Percentage selecting mode */
  modePercentage: number;
}

/** FRQ score distribution */
export interface FRQDistribution {
  /** Score histogram */
  scores: Array<{
    score: number;
    count: number;
    percentage: number;
  }>;
  
  /** Statistical metrics */
  mean: number;
  median: number;
  stdDev: number;
  
  /** Total attestations */
  total: number;
}

// ============= Consensus Metrics =============

/** Consensus data for a question */
export interface ConsensusData {
  /** Question identifier */
  questionId: string;
  
  /** MCQ choice distribution */
  mcqDistribution?: MCQDistribution;
  
  /** FRQ score distribution */
  frqDistribution?: FRQDistribution;
  
  /** Convergence metric (0-1, higher is better) */
  convergence: number;
  
  /** Average confidence of attesters (1-5) */
  confidence: number;
  
  /** Required quorum based on convergence (3-5) */
  quorum: number;
  
  /** Total number of attestations */
  totalAttestations: number;
  
  /** Whether consensus has been reached */
  hasConsensus: boolean;
  
  /** Emergent answer (if consensus reached) */
  emergentAnswer?: string | number;
}

/** Progressive quorum requirements per ADR-028 */
export interface QuorumRequirements {
  /** Low convergence (<0.5) requires 5 attestations */
  low: 5;
  
  /** Medium convergence (0.5-0.8) requires 4 attestations */
  medium: 4;
  
  /** High convergence (≥0.8) requires 3 attestations */
  high: 3;
}

// ============= AP Reveal Types (ADR-028) =============

/** AP reveal after consensus */
export interface APReveal {
  /** Question being revealed */
  questionId: string;
  
  /** Official answer hint */
  officialAnswer: string;
  
  /** Anonymous one-time signature */
  anonymousSignature: string;
  
  /** Timestamp of reveal */
  timestamp: number;
  
  /** Convergence at time of reveal */
  convergenceAtReveal: number;
}

// ============= Reputation Types =============

/** User reputation metrics */
export interface ReputationMetrics {
  /** Current reputation score */
  score: number;
  
  /** Reputation breakdown by category */
  breakdown: {
    /** Points from correct attestations */
    correctAttestations: number;
    
    /** Minority bonus (1.5x per ADR-028) */
    minorityBonus: number;
    
    /** Confidence weighting bonus */
    confidenceBonus: number;
    
    /** Time decay factor */
    decayFactor: number;
  };
  
  /** Recent attestation history */
  recentAttestations: AttestationHistory[];
}

/** Historical attestation record */
export interface AttestationHistory {
  questionId: string;
  timestamp: number;
  wasCorrect: boolean;
  confidence: number;
  reputationGained: number;
}

// ============= Anti-Gaming Mechanisms (ADR-028) =============

/** Rate limiting information */
export interface RateLimitInfo {
  /** User's public key */
  userPubkey: string;
  
  /** Question ID */
  questionId: string;
  
  /** Last attestation timestamp */
  lastAttestation?: number;
  
  /** Whether user can attest now */
  canAttest: boolean;
  
  /** Time until next attestation allowed (ms) */
  timeUntilNextAttestation?: number;
}

/** Outlier detection result */
export interface OutlierDetection {
  /** Attestation being analyzed */
  attestation: Attestation;
  
  /** Whether this is an outlier */
  isOutlier: boolean;
  
  /** Outlier score (higher = more suspicious) */
  outlierScore: number;
  
  /** Reasons for flagging */
  reasons: string[];
  
  /** Recommended action */
  action: 'accept' | 'flag' | 'reject';
}

// ============= Visualization Types =============

/** Configuration for consensus charts */
export interface ConsensusChartConfig {
  /** Chart type for MCQ distribution */
  mcqChartType: 'bar' | 'pie';
  
  /** Chart type for FRQ distribution */
  frqChartType: 'histogram' | 'boxplot';
  
  /** Show convergence indicator */
  showConvergence: boolean;
  
  /** Show confidence bands */
  showConfidenceBands: boolean;
  
  /** Highlight emergent answer */
  highlightConsensus: boolean;
  
  /** Color scheme */
  colorScheme: 'default' | 'confidence' | 'convergence';
}

/** Data for rendering consensus visualization */
export interface ConsensusVisualization {
  /** Consensus data */
  data: ConsensusData;
  
  /** Chart configuration */
  config: ConsensusChartConfig;
  
  /** Additional annotations */
  annotations?: {
    /** Text annotations for the chart */
    labels: Array<{
      text: string;
      position: { x: number; y: number };
    }>;
    
    /** Reference lines */
    lines: Array<{
      value: number;
      label: string;
      color: string;
    }>;
  };
}

// ============= Transaction Types (B atoms) =============

/** Transaction types in the blockchain */
export type TransactionType = 
  | 'Attestation'
  | 'APReveal'
  | 'CreateUser';

/** Generic transaction interface */
export interface Transaction {
  /** Transaction hash (B atom) */
  hash: string;
  
  /** Previous transaction hash for chaining */
  prevHash: string;
  
  /** Transaction timestamp */
  timestamp: number;
  
  /** Transaction type */
  txType: TransactionType;
  
  /** Transaction-specific data */
  data: Attestation | APReveal | CreateUserData;
  
  /** Mining nonce (if applicable) */
  nonce?: number;
}

/** User creation transaction data */
export interface CreateUserData {
  username: string;
  pubkey: string;
  timestamp: number;
}

// ============= Helper Functions Types =============

/** Function to calculate progressive quorum */
export type CalculateQuorum = (convergence: number) => number;

/** Function to update distributions with new attestation */
export type UpdateDistributions = (
  attestations: Attestation[],
  currentDistribution: ConsensusData
) => ConsensusData;

/** Function to calculate convergence */
export type CalculateConvergence = (
  distribution: MCQDistribution | FRQDistribution
) => number;

/** Function to detect outliers */
export type DetectOutliers = (
  attestations: Attestation[]
) => OutlierDetection[];

/** Function to validate attestation signature */
export type ValidateSignature = (
  attestation: Attestation,
  publicKey: string
) => boolean;

/** Function to check rate limits */
export type CheckRateLimit = (
  userPubkey: string,
  questionId: string,
  lastAttestation?: number
) => RateLimitInfo;

// ============= Export Aggregation =============

/** Consensus system API */
export interface ConsensusAPI {
  /** Get consensus data for a question */
  getConsensus: (questionId: string) => ConsensusData | null;
  
  /** Submit new attestation */
  submitAttestation: (attestation: Attestation) => Promise<void>;
  
  /** Check if user can attest */
  canUserAttest: (userPubkey: string, questionId: string) => RateLimitInfo;
  
  /** Get user's reputation */
  getUserReputation: (userPubkey: string) => ReputationMetrics;
  
  /** Visualize consensus data */
  visualizeConsensus: (
    consensusData: ConsensusData,
    config?: ConsensusChartConfig
  ) => ConsensusVisualization;
}

/** Constants for consensus calculations */
export const CONSENSUS_CONSTANTS = {
  /** Rate limit duration in milliseconds (30 days) */
  RATE_LIMIT_DURATION: 30 * 24 * 60 * 60 * 1000,
  
  /** Minimum attestations for consensus */
  MIN_ATTESTATIONS: 3,
  
  /** Convergence thresholds */
  CONVERGENCE_LOW: 0.5,
  CONVERGENCE_HIGH: 0.8,
  
  /** Confidence scale */
  MIN_CONFIDENCE: 1,
  MAX_CONFIDENCE: 5,
  
  /** FRQ score scale */
  MIN_FRQ_SCORE: 1,
  MAX_FRQ_SCORE: 5,
  
  /** Minority bonus multiplier */
  MINORITY_BONUS: 1.5,
  
  /** Reputation decay factor per day */
  DAILY_DECAY: 0.99
} as const;