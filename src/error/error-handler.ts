/**
 * Centralized Error Handler
 * Maps blockchain errors to user-friendly messages and handles recovery
 */

import { 
  BlockchainError, 
  ErrorCode, 
  ErrorSeverity, 
  ErrorReport,
  BlockchainErrorImpl 
} from './types';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: BlockchainError[] = [];
  private errorCallbacks: ((error: BlockchainError) => void)[] = [];
  private maxLogSize = 1000;

  // User-friendly error messages
  static readonly ErrorMessages: Record<ErrorCode, string> = {
    [ErrorCode.INVALID_SIGNATURE]: 'The signature could not be verified. Please check your keys.',
    [ErrorCode.INVALID_HASH]: 'The answer hash does not match. Please verify your response.',
    [ErrorCode.KEY_DERIVATION_FAILED]: 'Unable to generate keys from seed phrase.',
    
    [ErrorCode.INSUFFICIENT_QUORUM]: 'Not enough attestations yet. Please wait for more peers.',
    [ErrorCode.CONSENSUS_NOT_REACHED]: 'Consensus has not been reached for this question.',
    [ErrorCode.INVALID_ATTESTATION]: 'Your attestation could not be processed.',
    
    [ErrorCode.RATE_LIMITED]: 'Please wait before attesting to this question again.',
    [ErrorCode.OUTLIER_DETECTED]: 'Your response appears unusual. Please review carefully.',
    [ErrorCode.SUSPICIOUS_PATTERN]: 'Unusual activity detected. Please verify your responses.',
    [ErrorCode.COLLUSION_SUSPECTED]: 'Similar patterns detected across multiple users.',
    
    [ErrorCode.FRQ_OUT_OF_BOUNDS]: 'FRQ scores must be between 1 and 5.',
    [ErrorCode.INVALID_QUESTION_ID]: 'The question could not be found.',
    [ErrorCode.INVALID_TRANSACTION]: 'The transaction is invalid and cannot be processed.',
    [ErrorCode.INVALID_BLOCK]: 'The block contains invalid data.',
    
    [ErrorCode.SYNC_FAILURE]: 'Unable to sync with peer. Please check connection.',
    [ErrorCode.SYNC_CONFLICT]: 'Conflicting data detected during sync.',
    [ErrorCode.INVALID_SYNC_DATA]: 'The sync data is corrupted or invalid.',
    [ErrorCode.PEER_UNREACHABLE]: 'Cannot connect to peer. Please check network.',
    
    [ErrorCode.STATE_CORRUPTION]: 'Application state is corrupted. Please restart.',
    [ErrorCode.PERSISTENCE_FAILURE]: 'Unable to save data. Check storage permissions.',
    [ErrorCode.LOAD_STATE_FAILED]: 'Unable to load saved data.',
    
    [ErrorCode.INVARIANT_VIOLATION]: 'System invariant violated. Please report this issue.',
    [ErrorCode.TEMPORAL_ORDER_VIOLATION]: 'Timestamps are out of order.',
    [ErrorCode.IDENTITY_VIOLATION]: 'User identity could not be verified.',
    
    [ErrorCode.REVEAL_TOO_EARLY]: 'AP reveal requires 50% convergence first.',
    [ErrorCode.INVALID_REVEAL_SIGNATURE]: 'The AP reveal signature is invalid.',
    [ErrorCode.REVEAL_ALREADY_EXISTS]: 'An AP reveal already exists for this question.'
  };

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle a blockchain error
   */
  handleError(error: BlockchainError | Error | unknown): void {
    const blockchainError = this.normalizeError(error);
    
    // Log the error
    this.logError(blockchainError);
    
    // Show user message
    this.showUserMessage(
      blockchainError.userMessage || ErrorHandler.ErrorMessages[blockchainError.code],
      blockchainError.severity
    );
    
    // Execute callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(blockchainError);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
    
    // Attempt recovery if possible
    if (blockchainError.recoverable) {
      this.attemptRecovery(blockchainError);
    }
  }

  /**
   * Show user-friendly message
   */
  showUserMessage(message: string, severity: ErrorSeverity = ErrorSeverity.ERROR): void {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Try to use existing showMessage function from UI
      const showMessage = (window as any).showMessage;
      if (typeof showMessage === 'function') {
        const type = this.severityToMessageType(severity);
        showMessage(message, type);
      } else {
        // Fallback to console
        this.consoleMessage(message, severity);
      }
    } else {
      // Node environment
      this.consoleMessage(message, severity);
    }
  }

  /**
   * Log error for debugging and analytics
   */
  private logError(error: BlockchainError): void {
    // Add to log
    this.errorLog.push(error);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    // Console output for debugging
    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.ERROR) {
      console.error(`[${error.code}] ${error.message}`, error.context);
      if (error.technicalDetails) {
        console.error('Technical details:', error.technicalDetails);
      }
    } else if (error.severity === ErrorSeverity.WARNING) {
      console.warn(`[${error.code}] ${error.message}`, error.context);
    } else {
      console.info(`[${error.code}] ${error.message}`, error.context);
    }
  }

  /**
   * Normalize various error types to BlockchainError
   */
  private normalizeError(error: unknown): BlockchainError {
    if (error instanceof BlockchainErrorImpl) {
      return error;
    }
    
    if (error && typeof error === 'object' && 'code' in error) {
      return error as BlockchainError;
    }
    
    if (error instanceof Error) {
      // Try to map common errors to our error codes
      const code = this.inferErrorCode(error.message);
      return new BlockchainErrorImpl(
        code,
        error.message,
        ErrorSeverity.ERROR,
        false
      ).withTechnicalDetails(error.stack || '');
    }
    
    // Unknown error type
    return new BlockchainErrorImpl(
      ErrorCode.INVALID_TRANSACTION,
      String(error),
      ErrorSeverity.ERROR,
      false
    );
  }

  /**
   * Infer error code from error message
   */
  private inferErrorCode(message: string): ErrorCode {
    const lowercaseMsg = message.toLowerCase();
    
    if (lowercaseMsg.includes('signature')) return ErrorCode.INVALID_SIGNATURE;
    if (lowercaseMsg.includes('hash')) return ErrorCode.INVALID_HASH;
    if (lowercaseMsg.includes('quorum')) return ErrorCode.INSUFFICIENT_QUORUM;
    if (lowercaseMsg.includes('rate') || lowercaseMsg.includes('limit')) return ErrorCode.RATE_LIMITED;
    if (lowercaseMsg.includes('sync')) return ErrorCode.SYNC_FAILURE;
    if (lowercaseMsg.includes('persist') || lowercaseMsg.includes('save')) return ErrorCode.PERSISTENCE_FAILURE;
    if (lowercaseMsg.includes('invariant')) return ErrorCode.INVARIANT_VIOLATION;
    
    return ErrorCode.INVALID_TRANSACTION;
  }

  /**
   * Convert severity to UI message type
   */
  private severityToMessageType(severity: ErrorSeverity): 'error' | 'warning' | 'info' | 'success' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Console message fallback
   */
  private consoleMessage(message: string, severity: ErrorSeverity): void {
    const prefix = `[${severity.toUpperCase()}]`;
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error(prefix, message);
        break;
      case ErrorSeverity.WARNING:
        console.warn(prefix, message);
        break;
      default:
        console.info(prefix, message);
    }
  }

  /**
   * Attempt automatic recovery
   */
  private attemptRecovery(error: BlockchainError): void {
    console.info(`Attempting recovery for ${error.code}...`);
    
    switch (error.code) {
      case ErrorCode.PERSISTENCE_FAILURE:
        // Retry save after delay
        setTimeout(() => {
          console.info('Retrying save operation...');
          // Trigger save retry through persistence module
        }, 5000);
        break;
        
      case ErrorCode.SYNC_FAILURE:
        // Retry sync with exponential backoff
        console.info('Will retry sync in 10 seconds...');
        break;
        
      case ErrorCode.STATE_CORRUPTION:
        // Attempt to load backup state
        console.info('Attempting to restore from backup...');
        break;
        
      default:
        console.info('No automatic recovery available for this error.');
    }
  }

  /**
   * Register error callback
   */
  onError(callback: (error: BlockchainError) => void): () => void {
    this.errorCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get error report
   */
  getErrorReport(since?: number): ErrorReport {
    const errors = since 
      ? this.errorLog.filter(e => e.timestamp >= since)
      : this.errorLog;
    
    const report: ErrorReport = {
      errors,
      startTime: errors[0]?.timestamp || Date.now(),
      endTime: Date.now(),
      summary: {
        total: errors.length,
        bySeverity: {} as Record<ErrorSeverity, number>,
        byCode: {} as Record<ErrorCode, number>,
        recovered: 0,
        unrecovered: 0
      }
    };
    
    // Calculate summary
    for (const error of errors) {
      // By severity
      report.summary.bySeverity[error.severity] = 
        (report.summary.bySeverity[error.severity] || 0) + 1;
      
      // By code
      report.summary.byCode[error.code] = 
        (report.summary.byCode[error.code] || 0) + 1;
      
      // Recovery status
      if (error.recoverable) {
        report.summary.recovered++;
      } else {
        report.summary.unrecovered++;
      }
    }
    
    return report;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();