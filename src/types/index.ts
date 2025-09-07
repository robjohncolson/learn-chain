/**
 * Central export point for all Quiz Renderer types
 * Re-exports all types from individual modules for convenience
 */

// Core quiz types
export * from './quiz';

// Consensus and attestation types (excluding ConsensusData which is in quiz.ts)
export {
  Attestation,
  MCQDistribution,
  FRQDistribution,
  QuorumRequirements,
  APReveal,
  ReputationMetrics,
  AttestationHistory,
  RateLimitInfo,
  OutlierDetection,
  ConsensusChartConfig,
  ConsensusVisualization,
  TransactionType,
  Transaction,
  CreateUserData,
  CalculateQuorum,
  UpdateDistributions,
  CalculateConvergence,
  DetectOutliers,
  ValidateSignature,
  CheckRateLimit,
  ConsensusAPI,
  CONSENSUS_CONSTANTS
} from './consensus';

// Type guards for runtime validation
export { isQuestion, isCurriculum, isConsensusData } from './guards';

// Utility types
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type DeepReadonly<T> = T extends object ? {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;

/** Helper type for async functions */
export type AsyncFunction<T = void> = () => Promise<T>;

/** Helper type for event handlers */
export type EventHandler<T = void> = (event: T) => void;

/** Helper type for cleanup functions */
export type CleanupFunction = () => void;