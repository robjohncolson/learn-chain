/**
 * Invariant Types and Definitions
 * Based on FUNDAMENTAL.md mathematical invariants
 */

export enum InvariantType {
  // Core blockchain invariants
  IDENTITY = 'IDENTITY',
  PROGRESSIVE_QUORUM = 'PROGRESSIVE_QUORUM',
  CONFIDENCE_WEIGHTED_REWARDS = 'CONFIDENCE_WEIGHTED_REWARDS',
  HASH_VALIDATION = 'HASH_VALIDATION',
  FRQ_SCORING_BOUNDS = 'FRQ_SCORING_BOUNDS',
  TEMPORAL_ORDERING = 'TEMPORAL_ORDERING',
  CONVERGENCE_CALCULATION = 'CONVERGENCE_CALCULATION',
  RATE_LIMITING = 'RATE_LIMITING',
  OUTLIER_DETECTION = 'OUTLIER_DETECTION',
  CYCLE_STABILITY = 'CYCLE_STABILITY',
  PERSISTENCE_INTEGRITY = 'PERSISTENCE_INTEGRITY',
  ATOMICITY = 'ATOMICITY',
  UI_SAFETY = 'UI_SAFETY'
}

export interface InvariantViolation {
  type: InvariantType;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context: any;
  location?: string;
  suggestion?: string;
}

export interface InvariantCheckResult {
  passed: boolean;
  violations: InvariantViolation[];
  warnings?: string[];
  metadata?: any;
}

export interface InvariantReport {
  timestamp: number;
  totalChecks: number;
  passed: number;
  failed: number;
  violations: InvariantViolation[];
  criticalViolations: InvariantViolation[];
  summary: {
    byType: Record<InvariantType, number>;
    bySeverity: Record<string, number>;
  };
  recommendations: string[];
}