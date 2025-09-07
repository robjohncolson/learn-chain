# AP Statistics PoK Blockchain - Fundamental Architecture

## Mathematical Foundation

This system is formally specified as 58 irreducible atoms across 6 subsystems, fully aligned with ADR-012 (Social Consensus) and ADR-028 (Emergent Attestation).

### System Definition

**S** = **P** ∪ **B** ∪ **Q** ∪ **R** ∪ **P2** ∪ **U**

Where:
- **P** (Profile): Identity and key management - 11 atoms
- **B** (Blockchain): Consensus and transactions - 25 atoms (enhanced for ADR compliance)
- **Q** (Questions): Curriculum and validation - 14 atoms
- **R** (Reputation): Scoring and bonuses - 10 atoms
- **P2** (Persistence): State serialization - 7 atoms
- **U** (UI): Rendering and events - 6 atoms

Total: 58 irreducible atoms

## Core Atoms

### Profile Subsystem (P)

**Data Atoms** (8):
1. `username: String` - User identifier  
2. `pubkey: String` - Public cryptographic key
3. `privkey: String` - Private cryptographic key  
4. `reputationScore: Float` - Current reputation value
5. `archetype: Enum{emoji, description}` - User classification
6. `transactionHistory: Array<Transaction>` - User's blockchain activity
7. `seedphrase: String` - Cryptographic seed
8. `wordList: Array<String>` - Seed generation vocabulary

**Function Atoms** (3):
1. `deriveKeysFromSeed: String → (String, String)` - Crypto key generation
2. `selectRandomWords: Array<String> → String` - Seed phrase creation  
3. `calculateArchetype: Array<Transaction> → Enum` - Dynamic type assignment

### Blockchain Subsystem (B)

**Data Atoms** (19):
1. `hash: String` - Block/transaction identifier
2. `prevHash: String` - Chain linkage  
3. `timestamp: Float` - Temporal ordering
4. `nonce: Int` - Mining proof
5. `questionId: String` - Question reference
6. `answerHash: String` - MCQ answer digest (SHA-256)
7. `answerText: String` - FRQ response
8. `score: Float` - FRQ grade (1-5 scale per ADR-028)
9. `attesterPubkey: String` - Signer identity
10. `signature: String` - Cryptographic proof
11. `txType: Enum` - Transaction category (Attestation, APReveal, CreateUser)
12. `isMatch: Bool` - Attestation validation result
13. `questionDistribution: Record` - Consensus tracking per question
14. `mcqDistribution: Record` - Choice counts {A,B,C,D,E}
15. `frqScores: Array<Float>` - FRQ score collection
16. `convergence: Float` - Consensus percentage (coefficient of variation for FRQs)
17. `confidence: Float` - Attestation confidence (1-5 scale) [ADR-028]
18. `anonymousSignature: String` - One-time key for AP reveals [ADR-028]
19. `officialAnswer: String` - AP reveal answer hint [ADR-028]

**Function Atoms** (6):
1. `sha256Hash: String → String` - Cryptographic digest for MCQ hashing
2. `getCurrentTimestamp: () → Float` - Time source for rate limiting
3. `validateSignature: (String, String) → Bool` - Crypto verification
4. `calculateConsensus: Array<Attestation> → Bool` - Progressive quorum check
5. `updateDistributions: (Array<Transaction>, Dict) → Dict` - Emergent consensus aggregation
6. `detectOutliers: Array<Transaction> → Array<String>` - Anti-gaming detection [ADR-028]

## System Invariants (ADR-Aligned)

1. **Identity**: ∀ transaction t: t.attesterPubkey ∈ {p.pubkey | p ∈ profiles}

2. **Progressive Quorum [ADR-012/028]**: ∀ block b: |b.attestations| ≥ progressiveQuorum(b.convergence) where:
   ```
   progressiveQuorum(c) = {
     5, if c < 0.5    // Low convergence
     4, if 0.5 ≤ c < 0.8  // Medium convergence
     3, if c ≥ 0.8    // High convergence
   }
   ```

3. **Confidence-Weighted Rewards [ADR-028]**: ∀ profile p: 
   ```
   p.reputationScore = Σ(
     applyBonuses(consensus(a), confidence(a)) × 
     minorityBonus(a) × 
     decayScores(time)
   )
   ```

4. **Hash Validation [ADR-028]**: ∀ MCQ answer a: sha256Hash(a.choice) = a.answerHash

5. **FRQ Scoring Bounds**: ∀ FRQ response r: 1.0 ≤ scoreFRQ(r, rubric) ≤ 5.0

6. **Temporal Ordering**: ∀ timestamp t: t.current > t.previous

7. **Convergence Calculation [ADR-028]**: 
   - MCQ: convergence = max_count / total_attestations
   - FRQ: convergence = max(0, 1 - (stdDev/mean))

8. **Rate Limiting [ADR-028]**: ∀ user u, question q: 
   ```
   timeSinceLastAttestation(u, q) > 30 days
   ```

9. **Outlier Detection [ADR-028]**: ∀ attestation a: 
   ```
   detectOutliers([a]) = [] ∨ flagForReview(a)
   ```

10. **Cycle Stability**: System graph is DAG except reputation feedback loop

11. **Persistence Integrity**: ∀ state s: loadState(saveState(s)) = s

12. **Atomicity**: ∀ atom a ∈ S: independent(a) ⇒ testable(a)

13. **UI Safety**: ∀ state s: renderState(s) ≠ null ∧ validView(s.currentView)

## Dependency Graph (ADR-Enhanced)

```
[QUESTIONS] --hashes(MCQ)--> [BLOCKCHAIN] <--attests-- [PROFILE]
    ↓ rubric(FRQ)                ↓                        ↓
    ↓                     emergent_consensus          confidence
    ↓                            ↓                        ↓
[UI] --renders--> distributions  ↓                   [REPUTATION]
    ↑                            ↓                        ↓
events                    progressive_quorum         bonuses(1.5x minority)
    ↑                            ↓                        ↓
[PERSISTENCE] <--saves-- validated_blocks <--rewards------+
                                 ↓
                          AP_reveals(optional)
                                 ↓
                          outlier_detection
```

Key ADR-028 flows:
- MCQ: Question → SHA-256 hash → Attestation → Distribution → Convergence
- FRQ: Question → Rubric scoring (1-5) → Peer attestations → Statistical convergence
- AP Reveal: After 50% convergence → Anonymous one-time signature → Gentle correction

## Implementation Strategy (ADR-Aligned)

### Phase 1: Core Social Consensus [ADR-012] (20 atoms)
- Profile: username, pubkey, privkey, seedphrase
- Blockchain: hash, transactions, signature, attestations
- Functions: deriveKeysFromSeed, sha256Hash, validateSignature
- **Milestone**: Can create users and sign attestations

### Phase 2: Emergent Attestation [ADR-028] (35 atoms)
- Questions: MCQ hashing, FRQ rubrics (1-5 scale)
- Distributions: mcqDistribution, frqScores, convergence calculation
- Progressive quorum: 3-5 based on convergence
- Functions: updateDistributions, calculateConsensus
- **Milestone**: Emergent consensus without answer keys

### Phase 3: Complete System (58 atoms)
- Reputation: confidence weighting, minority bonus (1.5x)
- AP Reveals: anonymous signatures, gentle corrections
- Anti-gaming: rate limiting (30 days), outlier detection
- UI + Persistence: full state management
- **Milestone**: Production-ready with all ADR features

## Verification Approach

Each atom must:
1. Be independently testable
2. Satisfy its invariants
3. Compose correctly with dependencies

## Migration from Existing Codebase

Map existing code to atoms:
- `State.res` → Profile, Blockchain atoms
- `Types.res` → Data atom definitions
- `Utils.res` → Function atoms
- ADRs → Invariants and consensus rules