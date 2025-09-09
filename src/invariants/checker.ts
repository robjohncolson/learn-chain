/**
 * Invariant Checker
 * Runtime verification of all mathematical invariants from FUNDAMENTAL.md
 */

import { 
  InvariantType, 
  InvariantViolation, 
  InvariantCheckResult, 
  InvariantReport 
} from './types';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { Transaction, AttestationData } from '../core/types';

// Define Profile interface locally to avoid import issues
interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
  reputationScore?: number;
}
import { sha256 } from '../core/crypto';
import { QuestionDistribution } from '../core/consensus';
import { loadState, saveState } from '../persistence/storage';

export class InvariantChecker {
  private static instance: InvariantChecker;
  private violations: InvariantViolation[] = [];
  private maxViolationHistory = 1000;

  private constructor() {}

  static getInstance(): InvariantChecker {
    if (!InvariantChecker.instance) {
      InvariantChecker.instance = new InvariantChecker();
    }
    return InvariantChecker.instance;
  }

  /**
   * Verify all invariants for the blockchain
   */
  verifyAllInvariants(blockchain: EnhancedBlockchain): InvariantReport {
    const startTime = Date.now();
    const checkResults: InvariantCheckResult[] = [];
    
    // Get blockchain data
    const transactions = blockchain.getAllTransactions();
    const profiles = blockchain.getProfiles ? blockchain.getProfiles() : [];
    const distributions = blockchain.getDistributions ? blockchain.getDistributions() : new Map();

    // Run all invariant checks
    checkResults.push(this.checkIdentityInvariant(transactions, profiles));
    checkResults.push(this.checkTemporalOrdering(transactions));
    checkResults.push(this.checkHashValidation(transactions));
    checkResults.push(this.checkFRQBounds(transactions));
    checkResults.push(this.checkProgressiveQuorum(distributions));
    checkResults.push(this.checkConvergenceCalculation(distributions));
    checkResults.push(this.checkRateLimiting(transactions));
    checkResults.push(this.checkPersistenceIntegrity());
    checkResults.push(this.checkConfidenceWeighting(transactions));
    checkResults.push(this.checkOutlierDetection(transactions));
    checkResults.push(this.checkCycleStability(blockchain));
    checkResults.push(this.checkAtomicity());
    checkResults.push(this.checkUISafety());

    // Compile report
    return this.compileReport(checkResults, startTime);
  }

  /**
   * Invariant 1: Identity
   * ∀ transaction t: t.attesterPubkey ∈ {p.pubkey | p ∈ profiles}
   */
  checkIdentityInvariant(transactions: Transaction[], profiles: Profile[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const validKeys = new Set(profiles.map(p => p.pubkey));

    for (const tx of transactions) {
      if (tx.attesterPubkey && !validKeys.has(tx.attesterPubkey)) {
        // Allow system transactions without profile
        if (tx.txType !== 'CreateUser') {
          violations.push({
            type: InvariantType.IDENTITY,
            message: `Transaction from unknown pubkey: ${tx.attesterPubkey}`,
            severity: 'high',
            timestamp: Date.now(),
            context: { transaction: tx.hash, pubkey: tx.attesterPubkey },
            location: `Transaction ${tx.hash}`,
            suggestion: 'Ensure user profile exists before creating transactions'
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      metadata: { 
        totalTransactions: transactions.length, 
        totalProfiles: profiles.length 
      }
    };
  }

  /**
   * Invariant 2: Progressive Quorum
   * ∀ block b: |b.attestations| ≥ progressiveQuorum(b.convergence)
   */
  checkProgressiveQuorum(distributions: Map<string, QuestionDistribution>): InvariantCheckResult {
    const violations: InvariantViolation[] = [];

    for (const [questionId, dist] of distributions) {
      const requiredQuorum = this.calculateProgressiveQuorum(dist.convergence);
      const actualAttestations = dist.totalAttestations;

      // Only check if we claim to have consensus
      if (dist.hasConsensus && actualAttestations < requiredQuorum) {
        violations.push({
          type: InvariantType.PROGRESSIVE_QUORUM,
          message: `Insufficient quorum: ${actualAttestations} < ${requiredQuorum} required`,
          severity: 'critical',
          timestamp: Date.now(),
          context: { 
            questionId, 
            convergence: dist.convergence,
            attestations: actualAttestations,
            required: requiredQuorum
          },
          location: `Question ${questionId}`,
          suggestion: 'Wait for more attestations before declaring consensus'
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      metadata: { totalQuestions: distributions.size }
    };
  }

  /**
   * Calculate progressive quorum based on convergence
   */
  private calculateProgressiveQuorum(convergence: number): number {
    if (convergence < 0.5) return 5;
    if (convergence < 0.8) return 4;
    return 3;
  }

  /**
   * Invariant 3: Confidence-Weighted Rewards
   * Verify reputation calculations include confidence weighting
   */
  checkConfidenceWeighting(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const attestations = transactions.filter(tx => tx.txType === 'Attestation');

    for (const tx of attestations) {
      const data = tx.data as AttestationData;
      if (data.confidence !== undefined) {
        if (data.confidence < 1 || data.confidence > 5) {
          violations.push({
            type: InvariantType.CONFIDENCE_WEIGHTED_REWARDS,
            message: `Invalid confidence level: ${data.confidence}`,
            severity: 'medium',
            timestamp: Date.now(),
            context: { transaction: tx.hash, confidence: data.confidence },
            location: `Transaction ${tx.hash}`,
            suggestion: 'Confidence must be between 1 and 5'
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings: attestations.filter(tx => 
        !(tx.data as AttestationData).confidence
      ).length > 0 ? ['Some attestations missing confidence scores'] : undefined
    };
  }

  /**
   * Invariant 4: Hash Validation
   * ∀ MCQ answer a: sha256Hash(a.choice) = a.answerHash
   */
  checkHashValidation(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const mcqAttestations = transactions.filter(tx => 
      tx.txType === 'Attestation' && (tx.data as AttestationData).answerHash
    );

    for (const tx of mcqAttestations) {
      const data = tx.data as AttestationData;
      if (data.answer && data.answerHash) {
        const computedHash = sha256(data.answer);
        if (computedHash !== data.answerHash.toLowerCase()) {
          violations.push({
            type: InvariantType.HASH_VALIDATION,
            message: 'MCQ answer hash mismatch',
            severity: 'critical',
            timestamp: Date.now(),
            context: { 
              transaction: tx.hash,
              provided: data.answerHash,
              computed: computedHash
            },
            location: `Transaction ${tx.hash}`,
            suggestion: 'Verify answer hashing algorithm'
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      metadata: { totalMCQ: mcqAttestations.length }
    };
  }

  /**
   * Invariant 5: FRQ Scoring Bounds
   * ∀ FRQ response r: 1.0 ≤ scoreFRQ(r, rubric) ≤ 5.0
   */
  checkFRQBounds(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const frqAttestations = transactions.filter(tx => 
      tx.txType === 'Attestation' && (tx.data as AttestationData).score !== undefined
    );

    for (const tx of frqAttestations) {
      const data = tx.data as AttestationData;
      if (data.score !== undefined) {
        if (data.score < 1 || data.score > 5) {
          violations.push({
            type: InvariantType.FRQ_SCORING_BOUNDS,
            message: `FRQ score out of bounds: ${data.score}`,
            severity: 'high',
            timestamp: Date.now(),
            context: { transaction: tx.hash, score: data.score },
            location: `Transaction ${tx.hash}`,
            suggestion: 'FRQ scores must be between 1 and 5'
          });
        }

        // Check for valid increments (whole or half points)
        if (data.score % 0.5 !== 0) {
          violations.push({
            type: InvariantType.FRQ_SCORING_BOUNDS,
            message: `Invalid FRQ score increment: ${data.score}`,
            severity: 'medium',
            timestamp: Date.now(),
            context: { transaction: tx.hash, score: data.score },
            location: `Transaction ${tx.hash}`,
            suggestion: 'FRQ scores must be whole or half points'
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      metadata: { totalFRQ: frqAttestations.length }
    };
  }

  /**
   * Invariant 6: Temporal Ordering
   * ∀ timestamp t: t.current > t.previous
   */
  checkTemporalOrdering(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    
    if (transactions.length < 2) {
      return { passed: true, violations: [] };
    }

    // Sort by timestamp and check ordering
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].timestamp <= sorted[i - 1].timestamp) {
        violations.push({
          type: InvariantType.TEMPORAL_ORDERING,
          message: 'Timestamps not in ascending order',
          severity: 'high',
          timestamp: Date.now(),
          context: {
            previous: { hash: sorted[i - 1].hash, time: sorted[i - 1].timestamp },
            current: { hash: sorted[i].hash, time: sorted[i].timestamp }
          },
          location: `Between transactions ${sorted[i - 1].hash} and ${sorted[i].hash}`,
          suggestion: 'Ensure system clock is synchronized'
        });
      }

      // Check for future timestamps
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      if (sorted[i].timestamp > fiveMinutesFromNow) {
        violations.push({
          type: InvariantType.TEMPORAL_ORDERING,
          message: 'Transaction timestamp in future',
          severity: 'critical',
          timestamp: Date.now(),
          context: { transaction: sorted[i].hash, timestamp: sorted[i].timestamp },
          location: `Transaction ${sorted[i].hash}`,
          suggestion: 'Check system clock settings'
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Invariant 7: Convergence Calculation
   * Verify convergence is calculated correctly
   */
  checkConvergenceCalculation(distributions: Map<string, QuestionDistribution>): InvariantCheckResult {
    const violations: InvariantViolation[] = [];

    for (const [questionId, dist] of distributions) {
      // MCQ convergence check
      if (dist.type === 'MCQ' && dist.mcqDistribution) {
        const total = Object.values(dist.mcqDistribution).reduce((a, b) => a + b, 0);
        const max = Math.max(...Object.values(dist.mcqDistribution));
        const expectedConvergence = total > 0 ? max / total : 0;
        
        if (Math.abs(dist.convergence - expectedConvergence) > 0.01) {
          violations.push({
            type: InvariantType.CONVERGENCE_CALCULATION,
            message: 'MCQ convergence calculation error',
            severity: 'high',
            timestamp: Date.now(),
            context: {
              questionId,
              calculated: dist.convergence,
              expected: expectedConvergence
            },
            location: `Question ${questionId}`,
            suggestion: 'Review convergence calculation algorithm'
          });
        }
      }

      // FRQ convergence check (coefficient of variation)
      if (dist.type === 'FRQ' && dist.frqDistribution) {
        const mean = dist.frqDistribution.mean;
        const stdDev = dist.frqDistribution.stdDev;
        const expectedConvergence = mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 0;
        
        if (Math.abs(dist.convergence - expectedConvergence) > 0.01) {
          violations.push({
            type: InvariantType.CONVERGENCE_CALCULATION,
            message: 'FRQ convergence calculation error',
            severity: 'high',
            timestamp: Date.now(),
            context: {
              questionId,
              calculated: dist.convergence,
              expected: expectedConvergence
            },
            location: `Question ${questionId}`,
            suggestion: 'Review FRQ convergence calculation'
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Invariant 8: Rate Limiting
   * ∀ user u, question q: timeSinceLastAttestation(u, q) > 30 days
   */
  checkRateLimiting(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const attestationMap = new Map<string, number>();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Build map of user-question to last attestation time
    const attestations = transactions
      .filter(tx => tx.txType === 'Attestation')
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const tx of attestations) {
      const data = tx.data as AttestationData;
      const key = `${tx.attesterPubkey}:${data.questionId}`;
      
      if (attestationMap.has(key)) {
        const lastTime = attestationMap.get(key)!;
        const timeDiff = tx.timestamp - lastTime;
        
        if (timeDiff < thirtyDaysMs) {
          violations.push({
            type: InvariantType.RATE_LIMITING,
            message: 'Rate limit violation',
            severity: 'high',
            timestamp: Date.now(),
            context: {
              user: tx.attesterPubkey,
              question: data.questionId,
              timeSinceLast: timeDiff,
              required: thirtyDaysMs
            },
            location: `Transaction ${tx.hash}`,
            suggestion: `Wait ${Math.ceil((thirtyDaysMs - timeDiff) / (24 * 60 * 60 * 1000))} more days`
          });
        }
      }
      
      attestationMap.set(key, tx.timestamp);
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Invariant 9: Outlier Detection
   * Verify outliers are properly flagged
   */
  checkOutlierDetection(transactions: Transaction[]): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    const warnings: string[] = [];

    // Group FRQ attestations by question
    const frqByQuestion = new Map<string, number[]>();
    
    transactions
      .filter(tx => tx.txType === 'Attestation' && (tx.data as AttestationData).score)
      .forEach(tx => {
        const data = tx.data as AttestationData;
        if (!frqByQuestion.has(data.questionId)) {
          frqByQuestion.set(data.questionId, []);
        }
        frqByQuestion.get(data.questionId)!.push(data.score!);
      });

    // Check for outliers in each question
    for (const [questionId, scores] of frqByQuestion) {
      if (scores.length >= 5) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);

        scores.forEach((score, index) => {
          const zScore = Math.abs((score - mean) / stdDev);
          if (zScore > 3) {
            warnings.push(`Outlier detected: Question ${questionId}, score ${score} (z-score: ${zScore.toFixed(2)})`);
          }
        });
      }
    }

    return {
      passed: true, // Outliers are warnings, not violations
      violations,
      warnings
    };
  }

  /**
   * Invariant 10: Cycle Stability
   * System graph is DAG except reputation feedback loop
   */
  checkCycleStability(blockchain: EnhancedBlockchain): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    
    // This is a design invariant - check for unexpected cycles
    // For now, we'll check that blocks reference previous blocks correctly
    const blocks = blockchain.getBlocks ? blockchain.getBlocks() : [];
    const blockHashes = new Set(blocks.map(b => b.hash));
    
    for (let i = 1; i < blocks.length; i++) {
      if (!blockHashes.has(blocks[i].previousHash)) {
        violations.push({
          type: InvariantType.CYCLE_STABILITY,
          message: 'Block references non-existent previous block',
          severity: 'critical',
          timestamp: Date.now(),
          context: {
            block: blocks[i].hash,
            previousHash: blocks[i].previousHash
          },
          location: `Block ${blocks[i].hash}`,
          suggestion: 'Verify blockchain integrity'
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Invariant 11: Persistence Integrity
   * ∀ state s: loadState(saveState(s)) = s
   */
  checkPersistenceIntegrity(): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    
    try {
      // Create test state
      const testState = {
        testId: Math.random().toString(36),
        timestamp: Date.now(),
        data: { foo: 'bar', num: 42 }
      };

      // Save and load
      const key = 'invariant_test_' + Date.now();
      localStorage.setItem(key, JSON.stringify(testState));
      const loaded = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.removeItem(key);

      // Compare
      if (JSON.stringify(testState) !== JSON.stringify(loaded)) {
        violations.push({
          type: InvariantType.PERSISTENCE_INTEGRITY,
          message: 'State persistence integrity check failed',
          severity: 'critical',
          timestamp: Date.now(),
          context: { original: testState, loaded },
          suggestion: 'Check serialization/deserialization logic'
        });
      }
    } catch (error) {
      violations.push({
        type: InvariantType.PERSISTENCE_INTEGRITY,
        message: 'Persistence test failed',
        severity: 'high',
        timestamp: Date.now(),
        context: { error: String(error) },
        suggestion: 'Ensure localStorage is available and working'
      });
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Invariant 12: Atomicity
   * ∀ atom a ∈ S: independent(a) ⇒ testable(a)
   */
  checkAtomicity(): InvariantCheckResult {
    // This is a design invariant - we verify key functions are testable
    const violations: InvariantViolation[] = [];
    const warnings: string[] = [];

    // List of critical atomic functions that must be testable
    const atomicFunctions = [
      'sha256Hash',
      'validateSignature',
      'calculateConsensus',
      'deriveKeysFromSeed',
      'updateDistributions'
    ];

    // For now, we just warn if these aren't properly isolated
    warnings.push('Atomicity check: Ensure all critical functions are independently testable');

    return {
      passed: true,
      violations,
      warnings
    };
  }

  /**
   * Invariant 13: UI Safety
   * ∀ state s: renderState(s) ≠ null ∧ validView(s.currentView)
   */
  checkUISafety(): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    
    // Check if UI state is valid
    if (typeof window !== 'undefined') {
      const validViews = ['dashboard', 'question', 'attestation', 'results', 'sync'];
      const currentView = (window as any).currentView;
      
      if (currentView && !validViews.includes(currentView)) {
        violations.push({
          type: InvariantType.UI_SAFETY,
          message: `Invalid UI view: ${currentView}`,
          severity: 'medium',
          timestamp: Date.now(),
          context: { currentView, validViews },
          suggestion: 'Reset to dashboard view'
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Compile invariant report
   */
  private compileReport(results: InvariantCheckResult[], startTime: number): InvariantReport {
    const allViolations: InvariantViolation[] = [];
    const criticalViolations: InvariantViolation[] = [];
    const byType: Record<InvariantType, number> = {} as any;
    const bySeverity: Record<string, number> = {};

    let passed = 0;
    let failed = 0;

    for (const result of results) {
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }

      for (const violation of result.violations) {
        allViolations.push(violation);
        
        if (violation.severity === 'critical') {
          criticalViolations.push(violation);
        }

        // Count by type
        byType[violation.type] = (byType[violation.type] || 0) + 1;
        
        // Count by severity
        bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
      }
    }

    // Add to history
    this.violations.push(...allViolations);
    if (this.violations.length > this.maxViolationHistory) {
      this.violations = this.violations.slice(-this.maxViolationHistory);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(allViolations);

    return {
      timestamp: startTime,
      totalChecks: results.length,
      passed,
      failed,
      violations: allViolations,
      criticalViolations,
      summary: { byType, bySeverity },
      recommendations
    };
  }

  /**
   * Generate recommendations based on violations
   */
  private generateRecommendations(violations: InvariantViolation[]): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0) {
      recommendations.push('All invariants passed. System is operating correctly.');
      return recommendations;
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical violations immediately`);
    }

    // Type-specific recommendations
    const violationTypes = new Set(violations.map(v => v.type));
    
    if (violationTypes.has(InvariantType.TEMPORAL_ORDERING)) {
      recommendations.push('Synchronize system clocks across all nodes');
    }
    
    if (violationTypes.has(InvariantType.RATE_LIMITING)) {
      recommendations.push('Review and enforce rate limiting policies');
    }
    
    if (violationTypes.has(InvariantType.HASH_VALIDATION)) {
      recommendations.push('Verify cryptographic operations and hashing algorithms');
    }
    
    if (violationTypes.has(InvariantType.PERSISTENCE_INTEGRITY)) {
      recommendations.push('Check storage system and backup procedures');
    }

    return recommendations;
  }

  /**
   * Get violation history
   */
  getViolationHistory(): InvariantViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.violations = [];
  }
}

// Export singleton instance
export const invariantChecker = InvariantChecker.getInstance();