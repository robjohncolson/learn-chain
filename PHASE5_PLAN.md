# Phase 5: Error Handling, Invariants, Testing & Anti-Gaming

## Overview
Phase 5 completes the system with comprehensive error handling, invariant checks, local testing capabilities, and anti-gaming mechanisms aligned with ADR-028.

## Existing Foundation Analysis

### Current Error Handling
- **UI Feedback**: `src/ui/ui.ts` has playSound() and switchView() for user feedback
- **Sync Modal**: `src/ui/sync-modal.ts` has alert tones and visual indicators
- **Basic Validation**: Enhanced blockchain has rate limiting and outlier detection

### Current Anti-Gaming Features
- **Rate Limiter**: `src/core/rate-limiter.ts` - 30-day minimum between attestations
- **Outlier Detector**: `src/core/outliers.ts` - Z-score based detection, rapid-fire patterns
- **Progressive Quorum**: In `src/core/enhanced-blockchain.ts` - 3-5 attestations based on convergence

### Current Testing
- Manual testing via `npm run dev`
- Basic test files exist but need enhancement

## Phase 5 Architecture

### 1. Error Handling System (`src/error/`)

#### `src/error/error-handler.ts`
```typescript
// Centralized error handling with user-friendly messages
export class ErrorHandler {
  // Error types aligned with blockchain operations
  static ErrorTypes = {
    INVALID_SIGNATURE: 'Invalid cryptographic signature',
    INSUFFICIENT_QUORUM: 'Not enough attestations for consensus',
    RATE_LIMITED: 'Please wait before attesting again',
    SYNC_FAILURE: 'Unable to sync with peer',
    OUTLIER_DETECTED: 'Unusual attestation pattern detected',
    INVALID_HASH: 'MCQ answer hash mismatch',
    FRQ_OUT_OF_BOUNDS: 'FRQ score must be between 1-5'
  };
  
  handleError(error: BlockchainError): void
  showUserMessage(message: string, severity: 'error' | 'warning' | 'info'): void
  logError(error: Error, context: any): void
}
```

#### `src/error/validation.ts`
```typescript
// Input validation before blockchain operations
export class InputValidator {
  validateAttestation(data: AttestationData): ValidationResult
  validateTransaction(tx: Transaction): ValidationResult
  validateSyncData(data: SyncDiff): ValidationResult
  validateAPReveal(reveal: APRevealData): ValidationResult
}
```

### 2. Invariant Checks (`src/invariants/`)

#### `src/invariants/checker.ts`
```typescript
// Runtime invariant verification aligned with FUNDAMENTAL.md
export class InvariantChecker {
  // Core invariants from spec
  checkIdentityInvariant(tx: Transaction, profiles: Profile[]): boolean
  checkProgressiveQuorum(attestations: Attestation[], convergence: number): boolean
  checkHashValidation(answer: MCQAnswer): boolean
  checkFRQBounds(score: number): boolean
  checkTemporalOrdering(timestamps: number[]): boolean
  checkPersistenceIntegrity(state: AppState): boolean
  
  // Batch verification for efficiency
  verifyAllInvariants(blockchain: EnhancedBlockchain): InvariantReport
}
```

#### `src/invariants/monitor.ts`
```typescript
// Continuous invariant monitoring
export class InvariantMonitor {
  startMonitoring(blockchain: EnhancedBlockchain): void
  onInvariantViolation: (violation: Violation) => void
  getViolationHistory(): Violation[]
}
```

### 3. Local Testing Framework (`src/test/`)

#### `src/test/simulator.ts`
```typescript
// Multi-user simulation for local testing
export class LocalSimulator {
  // Simulate multiple users with different behaviors
  createSimulatedUsers(count: number): SimUser[]
  simulateAttestations(users: SimUser[], question: Question): void
  simulateSync(user1: SimUser, user2: SimUser): SyncResult
  
  // Test consensus emergence
  testProgressiveQuorum(attestations: number): void
  testConvergence(distribution: Distribution): void
  
  // Test anti-gaming
  testRateLimiting(user: SimUser): void
  testOutlierDetection(outlierUser: SimUser): void
}
```

#### `src/test/test-runner.ts`
```typescript
// Automated test execution
export class TestRunner {
  runUnitTests(): TestResults
  runIntegrationTests(): TestResults
  runConsensusTests(): TestResults
  runAntiGamingTests(): TestResults
  
  // Specific scenario tests
  testTwoUserSync(): void
  testQuorumFormation(): void
  testAPRevealFlow(): void
}
```

### 4. Enhanced Anti-Gaming (`src/anti-gaming/`)

#### `src/anti-gaming/enhanced-limiter.ts`
```typescript
// Advanced rate limiting with persistence
export class EnhancedRateLimiter extends RateLimiter {
  // Persist limits across sessions
  saveLimits(): void
  loadLimits(): void
  
  // Grace period handling
  checkGracePeriod(userId: string, questionId: string): boolean
  
  // Bulk operations
  canAttestBatch(userId: string, questionIds: string[]): Map<string, boolean>
}
```

#### `src/anti-gaming/pattern-detector.ts`
```typescript
// Advanced pattern detection beyond outliers
export class PatternDetector {
  // Collusion detection
  detectCollusion(users: string[], attestations: Attestation[]): CollusionReport
  
  // Sybil attack detection
  detectSybilPatterns(transactions: Transaction[]): SybilReport
  
  // Gaming strategy detection
  detectGamingStrategies(user: string, history: Transaction[]): StrategyReport
}
```

### 5. AP Reveal System (`src/ap-reveal/`)

#### `src/ap-reveal/reveal-manager.ts`
```typescript
// AP reveal orchestration (post-50% convergence)
export class APRevealManager {
  // Check if reveal conditions are met
  canReveal(distribution: Distribution): boolean
  
  // Create anonymous reveal
  createAPReveal(answer: string, hint: string): APRevealData {
    return {
      anonymousSignature: generateOneTimeKey(),
      officialAnswer: hint, // Gentle correction
      timestamp: Date.now(),
      convergenceAtReveal: distribution.convergence
    };
  }
  
  // Process reveal impact
  processRevealImpact(reveal: APRevealData, distribution: Distribution): void
}
```

#### `src/ap-reveal/anonymity.ts`
```typescript
// One-time key generation for AP reveals
export class AnonymityProvider {
  generateOneTimeKey(): string
  verifyAnonymousSignature(signature: string, data: any): boolean
  ensureUnlinkability(signature: string, userKeys: string[]): boolean
}
```

## Implementation Steps

### Step 1: Error Infrastructure
1. Create `src/error/` directory structure
2. Implement ErrorHandler with showMessage integration
3. Add validation layer for all user inputs
4. Wire error handling into existing blockchain operations

### Step 2: Invariant System
1. Create `src/invariants/` directory
2. Implement all 13 invariants from FUNDAMENTAL.md
3. Add invariant checks to critical paths:
   - Transaction addition
   - State persistence
   - Sync operations
4. Create monitoring dashboard

### Step 3: Testing Framework
1. Create `src/test/` directory
2. Build simulator for multi-user scenarios
3. Add test commands to package.json:
   ```json
   "test:local": "ts-node src/test/test-runner.ts",
   "test:consensus": "ts-node src/test/consensus-tests.ts",
   "test:sync": "ts-node src/test/sync-tests.ts"
   ```
4. Create test data fixtures

### Step 4: Anti-Gaming Enhancement
1. Extend existing rate limiter with persistence
2. Add pattern detection algorithms
3. Implement collusion detection
4. Add gaming strategy identification

### Step 5: AP Reveal Implementation
1. Create reveal manager
2. Implement anonymity provider
3. Add reveal UI components
4. Test with simulated AP responses

## Testing Strategy

### Local Development Testing
```bash
# Terminal 1: Start first instance
npm run dev

# Terminal 2: Start second instance on different port
PORT=3001 npm run dev

# Simulate sync between instances using QR codes
```

### Automated Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:consensus
npm run test:anti-gaming
npm run test:invariants
```

### Test Scenarios
1. **Happy Path**: Normal attestation flow with consensus
2. **Rate Limit**: User attempts rapid attestations
3. **Outlier**: User provides extreme FRQ scores
4. **Sync Conflict**: Different consensus on same question
5. **AP Reveal**: Trigger after 50% convergence
6. **Invariant Violation**: Corrupt data to test detection

## Success Metrics

1. **Error Handling**
   - All errors show user-friendly messages
   - No unhandled exceptions reach UI
   - Clear guidance for resolution

2. **Invariants**
   - 100% invariant compliance
   - Immediate detection of violations
   - Automatic recovery where possible

3. **Testing**
   - >80% code coverage
   - All critical paths tested
   - Multi-user scenarios validated

4. **Anti-Gaming**
   - Rate limits enforced consistently
   - Outliers detected within 2 std dev
   - Collusion patterns identified

5. **AP Reveals**
   - Triggers at exactly 50% convergence
   - Maintains anonymity
   - Gentle correction without punishment

## File Structure Summary
```
src/
├── error/
│   ├── error-handler.ts
│   ├── validation.ts
│   └── types.ts
├── invariants/
│   ├── checker.ts
│   ├── monitor.ts
│   └── reports.ts
├── test/
│   ├── simulator.ts
│   ├── test-runner.ts
│   ├── consensus-tests.ts
│   ├── sync-tests.ts
│   └── fixtures/
├── anti-gaming/
│   ├── enhanced-limiter.ts
│   ├── pattern-detector.ts
│   └── reports.ts
└── ap-reveal/
    ├── reveal-manager.ts
    ├── anonymity.ts
    └── types.ts
```

## Notes for Implementation

1. **Preserve Existing Code**: Enhance, don't replace
2. **Incremental Rollout**: Test each component separately
3. **User Experience**: Errors should guide, not frustrate
4. **Performance**: Invariant checks should be efficient
5. **Security**: AP reveals must maintain anonymity