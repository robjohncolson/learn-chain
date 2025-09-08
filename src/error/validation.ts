/**
 * Input Validation Layer
 * Validates all user inputs before blockchain operations
 */

import { 
  ValidationResult, 
  ValidationError, 
  ErrorCode,
  BlockchainErrorImpl,
  ErrorSeverity
} from './types';
import { Transaction, AttestationData } from '../core/types';
import { SyncDiff } from '../sync/types';
import { sha256 } from '../core/crypto';

export class InputValidator {
  private static instance: InputValidator;

  private constructor() {}

  static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }

  /**
   * Validate attestation data
   */
  validateAttestation(data: AttestationData): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required fields
    if (!data.questionId) {
      errors.push({
        field: 'questionId',
        value: data.questionId,
        message: 'Question ID is required',
        code: ErrorCode.INVALID_QUESTION_ID
      });
    }

    // Validate MCQ answer
    if (data.answerHash) {
      if (!this.isValidHash(data.answerHash)) {
        errors.push({
          field: 'answerHash',
          value: data.answerHash,
          message: 'Invalid answer hash format',
          code: ErrorCode.INVALID_HASH
        });
      }

      // Check if answer is provided for hash verification
      if (data.answer && !this.verifyAnswerHash(data.answer, data.answerHash)) {
        errors.push({
          field: 'answerHash',
          value: data.answerHash,
          message: 'Answer hash does not match provided answer',
          code: ErrorCode.INVALID_HASH
        });
      }
    }

    // Validate FRQ score
    if (data.score !== undefined) {
      if (data.score < 1 || data.score > 5) {
        errors.push({
          field: 'score',
          value: data.score,
          message: 'FRQ score must be between 1 and 5',
          code: ErrorCode.FRQ_OUT_OF_BOUNDS
        });
      }

      // Check if score is integer or half-point
      if (data.score % 0.5 !== 0) {
        errors.push({
          field: 'score',
          value: data.score,
          message: 'FRQ score must be whole number or half-point (e.g., 3.5)',
          code: ErrorCode.FRQ_OUT_OF_BOUNDS
        });
      }
    }

    // Validate confidence level
    if (data.confidence !== undefined) {
      if (data.confidence < 1 || data.confidence > 5) {
        errors.push({
          field: 'confidence',
          value: data.confidence,
          message: 'Confidence level must be between 1 and 5',
          code: ErrorCode.INVALID_ATTESTATION
        });
      }
    }

    // Validate FRQ text
    if (data.answerText !== undefined) {
      if (data.answerText.length < 10) {
        errors.push({
          field: 'answerText',
          value: data.answerText,
          message: 'FRQ response must be at least 10 characters',
          code: ErrorCode.INVALID_ATTESTATION
        });
      }

      if (data.answerText.length > 5000) {
        errors.push({
          field: 'answerText',
          value: data.answerText,
          message: 'FRQ response must not exceed 5000 characters',
          code: ErrorCode.INVALID_ATTESTATION
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.getAttestationWarnings(data)
    };
  }

  /**
   * Validate transaction
   */
  validateTransaction(tx: Transaction): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required fields
    if (!tx.hash) {
      errors.push({
        field: 'hash',
        value: tx.hash,
        message: 'Transaction hash is required',
        code: ErrorCode.INVALID_TRANSACTION
      });
    }

    if (!tx.signature) {
      errors.push({
        field: 'signature',
        value: tx.signature,
        message: 'Transaction signature is required',
        code: ErrorCode.INVALID_SIGNATURE
      });
    }

    if (!tx.attesterPubkey) {
      errors.push({
        field: 'attesterPubkey',
        value: tx.attesterPubkey,
        message: 'Attester public key is required',
        code: ErrorCode.IDENTITY_VIOLATION
      });
    }

    if (!tx.timestamp || tx.timestamp <= 0) {
      errors.push({
        field: 'timestamp',
        value: tx.timestamp,
        message: 'Valid timestamp is required',
        code: ErrorCode.TEMPORAL_ORDER_VIOLATION
      });
    }

    // Check timestamp is not in future (allow 5 minute tolerance for clock skew)
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    if (tx.timestamp > fiveMinutesFromNow) {
      errors.push({
        field: 'timestamp',
        value: tx.timestamp,
        message: 'Transaction timestamp cannot be in the future',
        code: ErrorCode.TEMPORAL_ORDER_VIOLATION
      });
    }

    // Validate transaction type
    const validTypes = ['Attestation', 'APReveal', 'CreateUser'];
    if (!validTypes.includes(tx.txType)) {
      errors.push({
        field: 'txType',
        value: tx.txType,
        message: `Transaction type must be one of: ${validTypes.join(', ')}`,
        code: ErrorCode.INVALID_TRANSACTION
      });
    }

    // Type-specific validation
    if (tx.txType === 'Attestation' && tx.data) {
      const attestationResult = this.validateAttestation(tx.data as AttestationData);
      errors.push(...attestationResult.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.getTransactionWarnings(tx)
    };
  }

  /**
   * Validate sync data
   */
  validateSyncData(data: SyncDiff): ValidationResult {
    const errors: ValidationError[] = [];

    // Check version
    if (!data.version || data.version !== '1.0.0') {
      errors.push({
        field: 'version',
        value: data.version,
        message: 'Sync version must be 1.0.0',
        code: ErrorCode.INVALID_SYNC_DATA
      });
    }

    // Check peer info
    if (!data.peerId) {
      errors.push({
        field: 'peerId',
        value: data.peerId,
        message: 'Peer ID is required',
        code: ErrorCode.INVALID_SYNC_DATA
      });
    }

    // Validate transactions array
    if (!Array.isArray(data.transactions)) {
      errors.push({
        field: 'transactions',
        value: data.transactions,
        message: 'Transactions must be an array',
        code: ErrorCode.INVALID_SYNC_DATA
      });
    } else {
      // Validate each transaction
      data.transactions.forEach((tx, index) => {
        const txResult = this.validateTransaction(tx);
        txResult.errors.forEach(error => {
          errors.push({
            ...error,
            field: `transactions[${index}].${error.field}`
          });
        });
      });
    }

    // Check for temporal ordering
    if (Array.isArray(data.transactions) && data.transactions.length > 1) {
      for (let i = 1; i < data.transactions.length; i++) {
        if (data.transactions[i].timestamp < data.transactions[i - 1].timestamp) {
          errors.push({
            field: 'transactions',
            value: data.transactions,
            message: 'Transactions must be in temporal order',
            code: ErrorCode.TEMPORAL_ORDER_VIOLATION
          });
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.getSyncWarnings(data)
    };
  }

  /**
   * Validate AP reveal data
   */
  validateAPReveal(reveal: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!reveal.anonymousSignature) {
      errors.push({
        field: 'anonymousSignature',
        value: reveal.anonymousSignature,
        message: 'Anonymous signature is required for AP reveal',
        code: ErrorCode.INVALID_REVEAL_SIGNATURE
      });
    }

    if (!reveal.officialAnswer) {
      errors.push({
        field: 'officialAnswer',
        value: reveal.officialAnswer,
        message: 'Official answer hint is required',
        code: ErrorCode.INVALID_TRANSACTION
      });
    }

    if (!reveal.convergenceAtReveal || reveal.convergenceAtReveal < 0.5) {
      errors.push({
        field: 'convergenceAtReveal',
        value: reveal.convergenceAtReveal,
        message: 'AP reveal requires at least 50% convergence',
        code: ErrorCode.REVEAL_TOO_EARLY
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Check if string is valid hash
   */
  private isValidHash(hash: string): boolean {
    // SHA-256 hash should be 64 hex characters
    return /^[a-f0-9]{64}$/i.test(hash);
  }

  /**
   * Verify answer hash matches answer
   */
  private verifyAnswerHash(answer: string, hash: string): boolean {
    const computedHash = sha256(answer);
    return computedHash === hash.toLowerCase();
  }

  /**
   * Get attestation warnings
   */
  private getAttestationWarnings(data: AttestationData): string[] {
    const warnings: string[] = [];

    // Warn about low confidence
    if (data.confidence && data.confidence <= 2) {
      warnings.push('Low confidence score may affect reputation rewards');
    }

    // Warn about extreme FRQ scores
    if (data.score === 1 || data.score === 5) {
      warnings.push('Extreme scores (1 or 5) are more likely to be flagged as outliers');
    }

    return warnings;
  }

  /**
   * Get transaction warnings
   */
  private getTransactionWarnings(tx: Transaction): string[] {
    const warnings: string[] = [];

    // Warn about old transactions
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (tx.timestamp < oneHourAgo) {
      warnings.push('Transaction is more than 1 hour old');
    }

    return warnings;
  }

  /**
   * Get sync warnings
   */
  private getSyncWarnings(data: SyncDiff): string[] {
    const warnings: string[] = [];

    // Warn about large sync
    if (data.transactions.length > 100) {
      warnings.push(`Large sync with ${data.transactions.length} transactions may take time`);
    }

    // Warn about old sync data
    if (data.timestamp) {
      const hoursSinceSync = (Date.now() - data.timestamp) / (60 * 60 * 1000);
      if (hoursSinceSync > 24) {
        warnings.push('Sync data is more than 24 hours old');
      }
    }

    return warnings;
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(validationFn: () => ValidationResult, errorMessage: string): void {
    const result = validationFn();
    if (!result.valid) {
      const error = new BlockchainErrorImpl(
        result.errors[0].code,
        errorMessage,
        ErrorSeverity.ERROR,
        false
      );
      error.withContext({ validationErrors: result.errors });
      throw error;
    }
  }
}

// Export singleton instance
export const inputValidator = InputValidator.getInstance();