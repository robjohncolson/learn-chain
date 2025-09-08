// Phase 2 Test Suite
// Tests consensus, reputation, and integration features

import { EnhancedBlockchain } from './core/enhanced-blockchain.js';
import { ConsensusCalculator } from './core/consensus.js';
import { hashMCQAnswer } from './questions/hashing.js';
import { ReputationCalculator } from './reputation/calculator.js';
import { createProfile } from './core/profile.js';

async function testPhase2() {
  console.log('=== Phase 2 Integration Test ===\n');
  
  // Initialize enhanced blockchain
  const blockchain = new EnhancedBlockchain();
  const consensusCalc = new ConsensusCalculator();
  
  // Create test users
  console.log('1. Creating test users...');
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const profile = await createProfile(`user${i}`);
    users.push(profile);
    console.log(`   Created ${profile.username} with pubkey ${profile.pubkey.substring(0, 20)}...`);
  }
  
  // Test MCQ Consensus
  console.log('\n2. Testing MCQ Consensus...');
  const mcqQuestionId = 'q1_mcq';
  
  // Simulate attestations with different choices
  const mcqChoices = ['A', 'A', 'B', 'A', 'C']; // A should win with 3/5 votes
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const choice = mcqChoices[i];
    
    const tx = await blockchain.createMCQAttestation(
      mcqQuestionId,
      choice,
      user.pubkey,
      user.privkey
    );
    
    if (tx) {
      const added = await blockchain.addTransaction(tx);
      console.log(`   ${user.username} attested choice ${choice}: ${added ? 'Success' : 'Failed'}`);
    }
  }
  
  // Check MCQ distribution
  const mcqDist = blockchain.getQuestionDistribution(mcqQuestionId);
  if (mcqDist && 'choices' in mcqDist) {
    console.log(`   MCQ Distribution: ${JSON.stringify(mcqDist.choices)}`);
    console.log(`   Convergence: ${mcqDist.convergence.toFixed(2)}`);
    console.log(`   Required Quorum: ${consensusCalc.getProgressiveQuorum(mcqDist.convergence)}`);
    console.log(`   Consensus Reached: ${consensusCalc.hasReachedConsensus(mcqDist)}`);
  }
  
  // Test FRQ Consensus
  console.log('\n3. Testing FRQ Consensus...');
  const frqQuestionId = 'q2_frq';
  
  // Simulate FRQ attestations with scores and confidence
  const frqData = [
    { score: 3, confidence: 4 },
    { score: 4, confidence: 5 },
    { score: 3, confidence: 3 },
    { score: 4, confidence: 4 },
    { score: 5, confidence: 2 } // Outlier with low confidence
  ];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const { score, confidence } = frqData[i];
    
    const tx = await blockchain.createFRQAttestation(
      frqQuestionId,
      `This is user ${i}'s response to the FRQ question.`,
      score,
      confidence,
      user.pubkey,
      user.privkey
    );
    
    if (tx) {
      const added = await blockchain.addTransaction(tx);
      console.log(`   ${user.username} scored ${score} with confidence ${confidence}: ${added ? 'Success' : 'Failed'}`);
    }
  }
  
  // Check FRQ distribution
  const frqDist = blockchain.getQuestionDistribution(frqQuestionId);
  if (frqDist && 'scores' in frqDist) {
    const frqDistTyped = frqDist as any;
    console.log(`   FRQ Scores: ${frqDistTyped.scores.join(', ')}`);
    console.log(`   Mean: ${frqDistTyped.mean.toFixed(2)}, StdDev: ${frqDistTyped.stdDev.toFixed(2)}`);
    console.log(`   Convergence: ${frqDist.convergence.toFixed(2)}`);
    console.log(`   Required Quorum: ${consensusCalc.getProgressiveQuorum(frqDist.convergence)}`);
    console.log(`   Consensus Reached: ${consensusCalc.hasReachedConsensus(frqDist)}`);
  }
  
  // Mine blocks to process transactions
  console.log('\n4. Mining blocks...');
  const block = await blockchain.minePendingTransactions();
  if (block) {
    console.log(`   Mined block ${block.hash} with ${block.transactions.length} transactions`);
  }
  
  // Check reputation scores
  console.log('\n5. Checking reputation scores...');
  for (const user of users) {
    const reputation = blockchain.getUserReputation(user.pubkey);
    console.log(`   ${user.username}: ${reputation.toFixed(2)} reputation points`);
  }
  
  // Test rate limiting
  console.log('\n6. Testing rate limiting...');
  const testUser = users[0];
  
  // Try to attest again (should be rate limited)
  const secondAttempt = await blockchain.createMCQAttestation(
    mcqQuestionId,
    'B',
    testUser.pubkey,
    testUser.privkey
  );
  
  if (secondAttempt) {
    const added = await blockchain.addTransaction(secondAttempt);
    console.log(`   Second attestation attempt: ${added ? 'Allowed (ERROR!)' : 'Blocked (correct)'}`);
  }
  
  // Get consensus statistics
  console.log('\n7. Consensus Statistics:');
  const stats = blockchain.getConsensusStats();
  console.log(`   Total Questions: ${stats.totalQuestions}`);
  console.log(`   Consensus Reached: ${stats.consensusReached}`);
  console.log(`   Average Convergence: ${stats.averageConvergence.toFixed(2)}`);
  console.log(`   Total Attestations: ${stats.totalAttestations}`);
  
  // Test hash validation
  console.log('\n8. Testing MCQ hash validation:');
  const testChoices = ['A', 'B', 'C', 'D', 'E'];
  for (const choice of testChoices) {
    const hash = hashMCQAnswer(choice);
    console.log(`   Choice ${choice}: ${hash.substring(0, 16)}...`);
  }
  
  // Export and import state
  console.log('\n9. Testing state persistence...');
  const exportedState = blockchain.exportState();
  console.log(`   Exported state with ${exportedState.chain.length} blocks`);
  console.log(`   Distributions: ${exportedState.distributions.distributions.length} questions`);
  console.log(`   Reputations: ${exportedState.reputations.length} users`);
  
  // Create new blockchain and import
  const newBlockchain = new EnhancedBlockchain();
  const imported = newBlockchain.importState(exportedState);
  console.log(`   Import successful: ${imported}`);
  
  // Verify imported state
  const importedStats = newBlockchain.getConsensusStats();
  console.log(`   Imported questions: ${importedStats.totalQuestions}`);
  console.log(`   Imported attestations: ${importedStats.totalAttestations}`);
  
  console.log('\n=== Phase 2 Test Complete ===');
}

// Run tests
testPhase2().catch(console.error);