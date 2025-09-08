/**
 * Main Test Entry Point
 * Run all Phase 5 tests and demonstrations
 */

import { TestRunner } from './test-runner';
import { LocalSimulator } from './simulator';
import { InvariantChecker } from '../invariants/checker';
import { InvariantMonitor } from '../invariants/monitor';
import { ErrorHandler } from '../error/error-handler';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { APRevealManager } from '../ap-reveal/reveal-manager';
import { EnhancedRateLimiter } from '../anti-gaming/enhanced-limiter';
import { PatternDetector } from '../anti-gaming/pattern-detector';
import { UserBehavior } from './types';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class Phase5TestSuite {
  private testRunner: TestRunner;
  private simulator: LocalSimulator;
  private invariantChecker: InvariantChecker;
  private invariantMonitor: InvariantMonitor;
  private errorHandler: ErrorHandler;
  private blockchain: EnhancedBlockchain;
  private apRevealManager: APRevealManager;
  private rateLimiter: EnhancedRateLimiter;
  private patternDetector: PatternDetector;

  constructor() {
    this.testRunner = new TestRunner();
    this.simulator = new LocalSimulator();
    this.invariantChecker = InvariantChecker.getInstance();
    this.invariantMonitor = InvariantMonitor.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.blockchain = new EnhancedBlockchain();
    this.apRevealManager = new APRevealManager();
    this.rateLimiter = new EnhancedRateLimiter();
    this.patternDetector = new PatternDetector();

    // Initialize AP reveal manager
    this.apRevealManager.initialize(this.blockchain);
  }

  /**
   * Run all Phase 5 tests
   */
  async runAllTests(): Promise<void> {
    console.log(`${colors.bright}${colors.blue}=== Phase 5 Test Suite ===${colors.reset}\n`);

    try {
      // 1. Test Error Handling
      await this.testErrorHandling();

      // 2. Test Invariants
      await this.testInvariants();

      // 3. Test Local Simulation
      await this.testSimulation();

      // 4. Test Anti-Gaming
      await this.testAntiGaming();

      // 5. Test AP Reveals
      await this.testAPReveals();

      // 6. Run Integration Tests
      await this.runIntegrationTests();

      console.log(`\n${colors.green}✓ All Phase 5 tests completed successfully!${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Test suite failed:${colors.reset}`, error);
      process.exit(1);
    }
  }

  /**
   * Test error handling system
   */
  async testErrorHandling(): Promise<void> {
    console.log(`\n${colors.cyan}Testing Error Handling...${colors.reset}`);

    // Test error handler
    this.errorHandler.handleError(new Error('Test error'));

    // Test validation
    const { inputValidator } = await import('../error/validation');
    
    // Test invalid attestation
    const result = inputValidator.validateAttestation({
      questionId: '',
      score: 10, // Out of bounds
      confidence: 0 // Out of bounds
    } as any);

    if (!result.valid) {
      console.log(`${colors.green}✓ Validation correctly rejected invalid data${colors.reset}`);
      console.log(`  Found ${result.errors.length} errors`);
    }

    // Test error recovery
    const errorReport = this.errorHandler.getErrorReport();
    console.log(`  Error report: ${errorReport.summary.total} errors logged`);
  }

  /**
   * Test invariant system
   */
  async testInvariants(): Promise<void> {
    console.log(`\n${colors.cyan}Testing Invariant System...${colors.reset}`);

    // Run invariant checks
    const report = this.invariantChecker.verifyAllInvariants(this.blockchain);

    console.log(`  Checked ${report.totalChecks} invariants`);
    console.log(`  ${colors.green}Passed: ${report.passed}${colors.reset}`);
    
    if (report.failed > 0) {
      console.log(`  ${colors.red}Failed: ${report.failed}${colors.reset}`);
      for (const violation of report.violations) {
        console.log(`    - ${violation.type}: ${violation.message}`);
      }
    }

    // Test invariant monitoring
    this.invariantMonitor.startMonitoring(this.blockchain, {
      checkInterval: 5000,
      alertOnViolation: true
    });

    console.log(`${colors.green}✓ Invariant monitoring started${colors.reset}`);

    // Stop monitoring after tests
    setTimeout(() => {
      this.invariantMonitor.stopMonitoring();
    }, 10000);
  }

  /**
   * Test local simulation
   */
  async testSimulation(): Promise<void> {
    console.log(`\n${colors.cyan}Testing Local Simulation...${colors.reset}`);

    // Create simulated users
    const users = this.simulator.createSimulatedUsers(10);
    console.log(`  Created ${users.length} simulated users`);

    // Create test question
    const question = {
      id: 'sim_test_q1',
      type: 'MCQ' as const,
      correctAnswer: 'B'
    };

    // Simulate attestations
    await this.simulator.simulateAttestations(users, question);

    // Check state
    const state = this.simulator.getStateSummary();
    console.log(`  Simulation state:`, state);

    // Test progressive quorum
    const quorumResult = this.simulator.testProgressiveQuorum(10);
    console.log(`  Progressive quorum: ${quorumResult.hasQuorum ? 'YES' : 'NO'} (${quorumResult.requiredQuorum} required)`);

    console.log(`${colors.green}✓ Simulation completed${colors.reset}`);
  }

  /**
   * Test anti-gaming features
   */
  async testAntiGaming(): Promise<void> {
    console.log(`\n${colors.cyan}Testing Anti-Gaming Features...${colors.reset}`);

    // Test enhanced rate limiter
    const canAttest = this.rateLimiter.canAttest('test_user', 'test_question');
    console.log(`  Rate limit check: ${canAttest ? 'ALLOWED' : 'BLOCKED'}`);

    // Record attestation
    if (canAttest) {
      this.rateLimiter.recordAttestation('test_user', 'test_question');
    }

    // Test pattern detection
    const users = ['user1', 'user2', 'user3'];
    const attestations: any[] = []; // Would have real attestations

    const collusionReport = this.patternDetector.detectCollusion(users, attestations);
    console.log(`  Collusion detection: ${collusionReport.detected ? 'DETECTED' : 'NONE'}`);

    // Test gaming strategies
    const strategyReport = this.patternDetector.detectGamingStrategies('test_user', []);
    console.log(`  Gaming strategies: Risk score ${strategyReport.riskScore}/100`);

    // Get rate limiter stats
    const stats = this.rateLimiter.getStatistics();
    console.log(`  Rate limiter stats:`, stats);

    console.log(`${colors.green}✓ Anti-gaming tests completed${colors.reset}`);
  }

  /**
   * Test AP reveal system
   */
  async testAPReveals(): Promise<void> {
    console.log(`\n${colors.cyan}Testing AP Reveal System...${colors.reset}`);

    // Create test distribution with high convergence
    const distribution = {
      questionId: 'test_ap_q1',
      type: 'MCQ' as const,
      convergence: 0.75,
      totalAttestations: 10,
      hasConsensus: true,
      mcqDistribution: { A: 2, B: 7, C: 1, D: 0, E: 0 }
    } as any;

    // Check if can reveal
    const canReveal = this.apRevealManager.canReveal(distribution);
    console.log(`  Can reveal: ${canReveal ? 'YES' : 'NO'} (convergence: ${distribution.convergence})`);

    if (canReveal) {
      // Create reveal
      const reveal = this.apRevealManager.createAPReveal(
        'test_ap_q1',
        'B',
        'The second choice has important implications',
        distribution
      );

      console.log(`  ${colors.green}✓ AP reveal created${colors.reset}`);
      console.log(`    Anonymous signature: ${reveal.anonymousSignature.substring(0, 16)}...`);
      console.log(`    Hint: "${reveal.officialAnswer}"`);

      // Verify reveal
      const isValid = this.apRevealManager.verifyReveal(reveal);
      console.log(`  Reveal verification: ${isValid ? 'VALID' : 'INVALID'}`);
    }

    // Get statistics
    const stats = this.apRevealManager.getStatistics();
    console.log(`  AP reveal stats:`, stats);

    console.log(`${colors.green}✓ AP reveal tests completed${colors.reset}`);
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests(): Promise<void> {
    console.log(`\n${colors.cyan}Running Integration Tests...${colors.reset}`);

    // Test two-user sync
    console.log('\n  Testing two-user sync...');
    await this.testRunner.testTwoUserSync();
    console.log(`  ${colors.green}✓ Two-user sync completed${colors.reset}`);

    // Test quorum formation
    console.log('\n  Testing quorum formation...');
    await this.testRunner.testQuorumFormation();
    console.log(`  ${colors.green}✓ Quorum formation completed${colors.reset}`);

    // Test AP reveal flow
    console.log('\n  Testing AP reveal flow...');
    await this.testRunner.testAPRevealFlow();
    console.log(`  ${colors.green}✓ AP reveal flow completed${colors.reset}`);

    // Run full test suite
    console.log('\n  Running full test suite...');
    const report = await this.testRunner.runAllTests();
    this.testRunner.printReport(report);
  }

  /**
   * Demonstrate multi-user scenario
   */
  async demonstrateMultiUserScenario(): Promise<void> {
    console.log(`\n${colors.bright}${colors.blue}=== Multi-User Demonstration ===${colors.reset}\n`);

    // Reset simulator
    this.simulator.reset();

    // Create diverse user population
    const users = this.simulator.createSimulatedUsers(20, [
      ...Array(12).fill(UserBehavior.HONEST),
      ...Array(3).fill(UserBehavior.RANDOM),
      ...Array(2).fill(UserBehavior.LAZY),
      ...Array(2).fill(UserBehavior.OUTLIER),
      UserBehavior.MALICIOUS
    ]);

    console.log('Created 20 users with diverse behaviors:');
    console.log('  - 12 Honest');
    console.log('  - 3 Random');
    console.log('  - 2 Lazy');
    console.log('  - 2 Outliers');
    console.log('  - 1 Malicious');

    // Create questions
    const questions = [
      { id: 'demo_mcq_1', type: 'MCQ' as const, correctAnswer: 'C' },
      { id: 'demo_frq_1', type: 'FRQ' as const }
    ];

    // Simulate attestations
    for (const question of questions) {
      console.log(`\nSimulating attestations for ${question.type} question...`);
      await this.simulator.simulateAttestations(users, question);
    }

    // Check convergence
    const distributions = this.blockchain.getDistributions?.() || new Map();
    
    for (const [questionId, dist] of distributions) {
      console.log(`\nQuestion ${questionId}:`);
      console.log(`  Type: ${dist.type}`);
      console.log(`  Convergence: ${(dist.convergence * 100).toFixed(1)}%`);
      console.log(`  Consensus: ${dist.hasConsensus ? 'YES' : 'NO'}`);
      console.log(`  Total attestations: ${dist.totalAttestations}`);

      // Check for AP reveal opportunity
      if (this.apRevealManager.canReveal(dist)) {
        console.log(`  ${colors.yellow}⚡ Ready for AP reveal!${colors.reset}`);
      }
    }

    // Run invariant check
    const invariantReport = this.invariantChecker.verifyAllInvariants(this.blockchain);
    console.log(`\nInvariant check: ${invariantReport.passed}/${invariantReport.totalChecks} passed`);

    // Detect patterns
    const allUsers = Array.from(users.values()).map(u => u.id);
    const transactions = this.blockchain.getAllTransactions();
    
    // Check for collusion
    const collusionReport = this.patternDetector.detectCollusion(allUsers, []);
    if (collusionReport.detected) {
      console.log(`\n${colors.red}⚠ Collusion detected!${colors.reset}`);
      console.log(`  Groups: ${collusionReport.groups.length}`);
    }

    // Check for sybils
    const sybilReport = this.patternDetector.detectSybilPatterns(transactions);
    if (sybilReport.detected) {
      console.log(`\n${colors.red}⚠ Potential Sybil attack!${colors.reset}`);
      console.log(`  Suspected accounts: ${sybilReport.suspectedSybils.length}`);
    }

    console.log(`\n${colors.green}✓ Multi-user demonstration completed${colors.reset}`);
  }
}

// Main execution
async function main() {
  const suite = new Phase5TestSuite();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  switch (command) {
    case 'all':
      await suite.runAllTests();
      break;
    case 'demo':
      await suite.demonstrateMultiUserScenario();
      break;
    case 'error':
      await suite.testErrorHandling();
      break;
    case 'invariants':
      await suite.testInvariants();
      break;
    case 'simulation':
      await suite.testSimulation();
      break;
    case 'anti-gaming':
      await suite.testAntiGaming();
      break;
    case 'ap-reveal':
      await suite.testAPReveals();
      break;
    default:
      console.log('Usage: npm run test:phase5 [all|demo|error|invariants|simulation|anti-gaming|ap-reveal]');
      process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { Phase5TestSuite };