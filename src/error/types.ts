/**
 * Error Types and Definitions
 * Comprehensive error handling for blockchain operations
 */

export enum ErrorCode {
  // Signature & Crypto Errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_HASH = 'INVALID_HASH',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  
  // Consensus Errors
  INSUFFICIENT_QUORUM = 'INSUFFICIENT_QUORUM',
  CONSENSUS_NOT_REACHED = 'CONSENSUS_NOT_REACHED',
  INVALID_ATTESTATION = 'INVALID_ATTESTATION',
  
  // Rate Limiting & Anti-Gaming
  RATE_LIMITED = 'RATE_LIMITED',
  OUTLIER_DETECTED = 'OUTLIER_DETECTED',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  COLLUSION_SUSPECTED = 'COLLUSION_SUSPECTED',
  
  // Validation Errors
  FRQ_OUT_OF_BOUNDS = 'FRQ_OUT_OF_BOUNDS',
  INVALID_QUESTION_ID = 'INVALID_QUESTION_ID',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  INVALID_BLOCK = 'INVALID_BLOCK',
  
  // Sync Errors
  SYNC_FAILURE = 'SYNC_FAILURE',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  INVALID_SYNC_DATA = 'INVALID_SYNC_DATA',
  PEER_UNREACHABLE = 'PEER_UNREACHABLE',
  
  // State & Persistence Errors
  STATE_CORRUPTION = 'STATE_CORRUPTION',
  PERSISTENCE_FAILURE = 'PERSISTENCE_FAILURE',
  LOAD_STATE_FAILED = 'LOAD_STATE_FAILED',
  
  // Invariant Violations
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
  TEMPORAL_ORDER_VIOLATION = 'TEMPORAL_ORDER_VIOLATION',
  IDENTITY_VIOLATION = 'IDENTITY_VIOLATION',
  
  // AP Reveal Errors
  REVEAL_TOO_EARLY = 'REVEAL_TOO_EARLY',
  INVALID_REVEAL_SIGNATURE = 'INVALID_REVEAL_SIGNATURE',
  REVEAL_ALREADY_EXISTS = 'REVEAL_ALREADY_EXISTS'
}

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface BlockchainError extends Error {
  code: ErrorCode;
  severity: ErrorSeverity;
  context?: any;
  timestamp: number;
  recoverable: boolean;
  userMessage?: string;
  technicalDetails?: string;
  suggestions?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: ErrorCode;
}

export interface ErrorReport {
  errors: BlockchainError[];
  startTime: number;
  endTime: number;
  summary: {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCode: Record<ErrorCode, number>;
    recovered: number;
    unrecovered: number;
  };
}

export class BlockchainErrorImpl extends Error implements BlockchainError {
  code: ErrorCode;
  severity: ErrorSeverity;
  context?: any;
  timestamp: number;
  recoverable: boolean;
  userMessage?: string;
  technicalDetails?: string;
  suggestions?: string[];

  constructor(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.severity = severity;
    this.timestamp = Date.now();
    this.recoverable = recoverable;
  }

  withContext(context: any): this {
    this.context = context;
    return this;
  }

  withUserMessage(message: string): this {
    this.userMessage = message;
    return this;
  }

  withSuggestions(...suggestions: string[]): this {
    this.suggestions = suggestions;
    return this;
  }

  withTechnicalDetails(details: string): this {
    this.technicalDetails = details;
    return this;
  }
}