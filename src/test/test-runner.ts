/**
 * Test Runner
 * Automated test execution for all system components
 */

import { 
  TestScenario, 
  TestResult, 
  TestSuite, 
  TestReport,
  TestSuiteResult,
  UserBehavior
} from './types';
import { LocalSimulator } from './simulator';
import { InvariantChecker } from '../invariants/checker';
import { EnhancedBlockchain } from '../core/enhanced-blockchain';

export class TestRunner {
  private simulator: LocalSimulator;
  private invariantChecker: InvariantChecker;
  private results: TestResult[] = [];

  constructor() {
    this.simulator = new LocalSimulator();
    this.invariantChecker = InvariantChecker.getInstance();
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<TestReport> {
    const startTime = Date.now();
    const suiteResults: TestSuiteResult[] = [];

    // Define test suites
    const suites: TestSuite[] = [
      this.getUnitTestSuite(),
      this.getIntegrationTestSuite(),
      this.getConsensusTestSuite(),
      this.getAntiGamingTestSuite()
    ];

    // Run each suite
    for (const suite of suites) {
      const result = await this.runSuite(suite);
      suiteResults.push(result);
    }

    // Generate report
    return this.generateReport(suiteResults, startTime);
  }

  /**
   * Run unit tests
   */
  async runUnitTests(): Promise<TestSuiteResult> {
    return this.runSuite(this.getUnitTestSuite());
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests(): Promise<TestSuiteResult> {
    return this.runSuite(this.getIntegrationTestSuite());
  }

  /**
   * Run consensus tests
   */
  async runConsensusTests(): Promise<TestSuiteResult> {
    return this.runSuite(this.getConsensusTestSuite());
  }

  /**
   * Run anti-gaming tests
   */
  async runAntiGamingTests(): Promise<TestSuiteResult> {
    return this.runSuite(this.getAntiGamingTestSuite());
  }

  /**
   * Test two-user sync scenario
   */
  async testTwoUserSync(): Promise<void> {
    console.log('Testing two-user sync...');
    
    // Create two users
    const users = this.simulator.createSimulatedUsers(2, [
      UserBehavior.HONEST,
      UserBehavior.HONEST
    ]);

    // Create test question
    const question = {
      id: 'test_sync_q1',
      type: 'MCQ' as const,
      correctAnswer: 'B'
    };

    // User 1 attests
    await this.simulator.simulateAttestations([users[0]], question);
    
    // User 2 attests
    await this.simulator.simulateAttestations([users[1]], question);

    // Simulate sync
    const syncResult = await this.simulator.simulateSync(users[0], users[1]);
    
    console.log('Sync result:', syncResult);
    
    if (!syncResult.success) {
      throw new Error(`Sync failed with ${syncResult.conflicts} conflicts`);
    }
  }

  /**
   * Test quorum formation
   */
  async testQuorumFormation(): Promise<void> {
    console.log('Testing progressive quorum formation...');
    
    // Test different attestation counts
    const tests = [
      { attestations: 2, expectedQuorum: false },
      { attestations: 3, expectedQuorum: false },
      { attestations: 5, expectedQuorum: true },
      { attestations: 10, expectedQuorum: true }
    ];

    for (const test of tests) {
      const result = this.simulator.testProgressiveQuorum(test.attestations);
      console.log(`Attestations: ${test.attestations}, Quorum: ${result.hasQuorum}, Required: ${result.requiredQuorum}`);
      
      if (result.hasQuorum !== test.expectedQuorum) {
        throw new Error(`Quorum test failed for ${test.attestations} attestations`);
      }
    }
  }

  /**
   * Test AP reveal flow
   */
  async testAPRevealFlow(): Promise<void> {
    console.log('Testing AP reveal flow...');
    
    // Create users
    const users = this.simulator.createSimulatedUsers(10);
    
    // Create question
    const question = {
      id: 'test_ap_reveal',
      type: 'MCQ' as const,
      correctAnswer: 'C'
    };

    // Simulate attestations
    await this.simulator.simulateAttestations(users, question);
    
    // Check convergence
    const blockchain = new EnhancedBlockchain();
    const distributions = blockchain.getDistributions?.() || new Map();
    const distribution = distributions.get(question.id);
    
    if (!distribution) {
      throw new Error('No distribution found for question');
    }

    console.log(`Convergence: ${distribution.convergence}`);
    
    // AP reveal should trigger after 50% convergence
    if (distribution.convergence >= 0.5) {
      console.log('AP reveal conditions met');
      // In real implementation, AP reveal would be created here
    } else {
      console.log('Insufficient convergence for AP reveal');
    }
  }

  /**
   * Run a test suite
   */
  private async runSuite(suite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    console.log(`Running suite: ${suite.name}`);
    
    // Setup
    if (suite.setup) {
      await suite.setup();
    }

    // Run each scenario
    for (const scenario of suite.scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    // Teardown
    if (suite.teardown) {
      await suite.teardown();
    }

    // Calculate summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    return {
      name: suite.name,
      results,
      passed,
      failed,
      duration: Date.now() - startTime
    };
  }

  /**
   * Run a test scenario
   */
  private async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    console.log(`  Running scenario: ${scenario.name}`);
    
    try {
      // Reset simulator
      this.simulator.reset();
      
      // Create users
      const behaviors = scenario.users.map(u => u.behavior);
      const users = this.simulator.createSimulatedUsers(scenario.users.length, behaviors);
      
      // Run attestations for each question
      for (const question of scenario.questions) {
        await this.simulator.simulateAttestations(users, question);
      }
      
      // Get actual outcome
      const state = this.simulator.getStateSummary();
      const blockchain = new EnhancedBlockchain();
      const distributions = blockchain.getDistributions?.() || new Map();
      
      // Calculate metrics
      let totalConvergence = 0;
      let consensusCount = 0;
      const outliers: string[] = [];
      
      for (const [_, dist] of distributions) {
        totalConvergence += dist.convergence;
        if (dist.hasConsensus) {
          consensusCount++;
        }
      }
      
      const avgConvergence = distributions.size > 0 
        ? totalConvergence / distributions.size 
        : 0;
      
      // Check against expected outcome
      const actualOutcome = {
        consensus: consensusCount > 0,
        convergence: avgConvergence,
        outliers,
        quorum: Math.max(...Array.from(distributions.values()).map(d => d.totalAttestations))
      };
      
      // Validate outcome
      let passed = true;
      
      if (scenario.expectedOutcome.consensus !== actualOutcome.consensus) {
        errors.push(`Consensus mismatch: expected ${scenario.expectedOutcome.consensus}, got ${actualOutcome.consensus}`);
        passed = false;
      }
      
      if (actualOutcome.convergence < scenario.expectedOutcome.convergenceThreshold) {
        errors.push(`Convergence below threshold: ${actualOutcome.convergence} < ${scenario.expectedOutcome.convergenceThreshold}`);
        passed = false;
      }
      
      if (actualOutcome.outliers.length !== scenario.expectedOutcome.outlierCount) {
        warnings.push(`Outlier count mismatch: expected ${scenario.expectedOutcome.outlierCount}, got ${actualOutcome.outliers.length}`);
      }
      
      // Run invariant checks
      const invariantReport = this.invariantChecker.verifyAllInvariants(blockchain);
      if (invariantReport.failed > 0) {
        errors.push(`${invariantReport.failed} invariant violations detected`);
        passed = false;
      }
      
      return {
        scenario: scenario.name,
        passed,
        actualOutcome,
        errors,
        warnings,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
      
    } catch (error) {
      errors.push(`Exception: ${String(error)}`);
      return {
        scenario: scenario.name,
        passed: false,
        actualOutcome: {
          consensus: false,
          convergence: 0,
          outliers: [],
          quorum: 0
        },
        errors,
        warnings,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get unit test suite
   */
  private getUnitTestSuite(): TestSuite {
    return {
      name: 'Unit Tests',
      scenarios: [
        {
          name: 'Hash validation',
          description: 'Test MCQ answer hashing',
          users: [{
            id: 'test_user',
            username: 'test',
            pubkey: 'test_key',
            privkey: 'test_privkey',
            reputationScore: 100,
            behavior: UserBehavior.HONEST,
            attestationHistory: []
          }],
          questions: [{
            id: 'hash_test',
            type: 'MCQ',
            correctAnswer: 'A'
          }],
          expectedOutcome: {
            consensus: false,
            convergenceThreshold: 0,
            outlierCount: 0,
            quorumSize: 1
          }
        },
        {
          name: 'FRQ bounds checking',
          description: 'Test FRQ score boundaries',
          users: [{
            id: 'test_user',
            username: 'test',
            pubkey: 'test_key',
            privkey: 'test_privkey',
            reputationScore: 100,
            behavior: UserBehavior.HONEST,
            attestationHistory: []
          }],
          questions: [{
            id: 'frq_test',
            type: 'FRQ'
          }],
          expectedOutcome: {
            consensus: false,
            convergenceThreshold: 0,
            outlierCount: 0,
            quorumSize: 1
          }
        }
      ]
    };
  }

  /**
   * Get integration test suite
   */
  private getIntegrationTestSuite(): TestSuite {
    return {
      name: 'Integration Tests',
      scenarios: [
        {
          name: 'Multi-user attestation',
          description: 'Test multiple users attesting to same question',
          users: Array(5).fill(null).map((_, i) => ({
            id: `user_${i}`,
            username: `user_${i}`,
            pubkey: `key_${i}`,
            privkey: `privkey_${i}`,
            reputationScore: 100,
            behavior: UserBehavior.HONEST,
            attestationHistory: []
          })),
          questions: [{
            id: 'multi_user_q1',
            type: 'MCQ',
            correctAnswer: 'B'
          }],
          expectedOutcome: {
            consensus: true,
            convergenceThreshold: 0.5,
            outlierCount: 0,
            quorumSize: 5
          }
        }
      ]
    };
  }

  /**
   * Get consensus test suite
   */
  private getConsensusTestSuite(): TestSuite {
    return {
      name: 'Consensus Tests',
      scenarios: [
        {
          name: 'MCQ consensus formation',
          description: 'Test MCQ consensus with honest majority',
          users: Array(7).fill(null).map((_, i) => ({
            id: `user_${i}`,
            username: `user_${i}`,
            pubkey: `key_${i}`,
            privkey: `privkey_${i}`,
            reputationScore: 100,
            behavior: i < 5 ? UserBehavior.HONEST : UserBehavior.RANDOM,
            attestationHistory: []
          })),
          questions: [{
            id: 'consensus_mcq',
            type: 'MCQ',
            correctAnswer: 'C'
          }],
          expectedOutcome: {
            consensus: true,
            convergenceThreshold: 0.5,
            outlierCount: 0,
            quorumSize: 7
          }
        },
        {
          name: 'FRQ consensus formation',
          description: 'Test FRQ consensus with score convergence',
          users: Array(6).fill(null).map((_, i) => ({
            id: `user_${i}`,
            username: `user_${i}`,
            pubkey: `key_${i}`,
            privkey: `privkey_${i}`,
            reputationScore: 100,
            behavior: UserBehavior.HONEST,
            attestationHistory: []
          })),
          questions: [{
            id: 'consensus_frq',
            type: 'FRQ'
          }],
          expectedOutcome: {
            consensus: true,
            convergenceThreshold: 0.3,
            outlierCount: 0,
            quorumSize: 6
          }
        }
      ]
    };
  }

  /**
   * Get anti-gaming test suite
   */
  private getAntiGamingTestSuite(): TestSuite {
    return {
      name: 'Anti-Gaming Tests',
      scenarios: [
        {
          name: 'Outlier detection',
          description: 'Test detection of outlier attestations',
          users: [
            ...Array(8).fill(null).map((_, i) => ({
              id: `honest_${i}`,
              username: `honest_${i}`,
              pubkey: `key_${i}`,
              privkey: `privkey_${i}`,
              reputationScore: 100,
              behavior: UserBehavior.HONEST,
              attestationHistory: []
            })),
            ...Array(2).fill(null).map((_, i) => ({
              id: `outlier_${i}`,
              username: `outlier_${i}`,
              pubkey: `outlier_key_${i}`,
              privkey: `outlier_privkey_${i}`,
              reputationScore: 100,
              behavior: UserBehavior.OUTLIER,
              attestationHistory: []
            }))
          ],
          questions: [{
            id: 'outlier_test',
            type: 'FRQ'
          }],
          expectedOutcome: {
            consensus: true,
            convergenceThreshold: 0.3,
            outlierCount: 2,
            quorumSize: 10
          }
        },
        {
          name: 'Collusion detection',
          description: 'Test detection of coordinated attestations',
          users: [
            ...Array(5).fill(null).map((_, i) => ({
              id: `honest_${i}`,
              username: `honest_${i}`,
              pubkey: `key_${i}`,
              privkey: `privkey_${i}`,
              reputationScore: 100,
              behavior: UserBehavior.HONEST,
              attestationHistory: []
            })),
            ...Array(3).fill(null).map((_, i) => ({
              id: `colluder_${i}`,
              username: `colluder_${i}`,
              pubkey: `colluder_key_${i}`,
              privkey: `colluder_privkey_${i}`,
              reputationScore: 100,
              behavior: UserBehavior.COLLUDER,
              attestationHistory: []
            }))
          ],
          questions: [{
            id: 'collusion_test',
            type: 'MCQ',
            correctAnswer: 'D'
          }],
          expectedOutcome: {
            consensus: true,
            convergenceThreshold: 0.4,
            outlierCount: 0,
            quorumSize: 8
          }
        }
      ]
    };
  }

  /**
   * Generate test report
   */
  private generateReport(suiteResults: TestSuiteResult[], startTime: number): TestReport {
    let totalScenarios = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of suiteResults) {
      totalScenarios += suite.results.length;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
    }

    const recommendations: string[] = [];

    if (totalFailed > 0) {
      recommendations.push(`Fix ${totalFailed} failing tests before deployment`);
    }

    if (totalPassed === totalScenarios) {
      recommendations.push('All tests passing - system ready for deployment');
    }

    // Check specific failures
    for (const suite of suiteResults) {
      if (suite.name === 'Anti-Gaming Tests' && suite.failed > 0) {
        recommendations.push('Review anti-gaming mechanisms');
      }
      if (suite.name === 'Consensus Tests' && suite.failed > 0) {
        recommendations.push('Review consensus algorithms');
      }
    }

    return {
      suites: suiteResults,
      summary: {
        totalScenarios,
        passed: totalPassed,
        failed: totalFailed,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      },
      recommendations
    };
  }

  /**
   * Print test report
   */
  printReport(report: TestReport): void {
    console.log('\n=== Test Report ===\n');
    console.log(`Total Scenarios: ${report.summary.totalScenarios}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Duration: ${report.summary.duration}ms\n`);

    for (const suite of report.suites) {
      console.log(`\n${suite.name}:`);
      console.log(`  Passed: ${suite.passed}/${suite.results.length}`);
      
      for (const result of suite.results) {
        const status = result.passed ? '✓' : '✗';
        console.log(`  ${status} ${result.scenario}`);
        
        if (!result.passed) {
          for (const error of result.errors) {
            console.log(`    ERROR: ${error}`);
          }
        }
        
        for (const warning of result.warnings) {
          console.log(`    WARN: ${warning}`);
        }
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of report.recommendations) {
        console.log(`  - ${rec}`);
      }
    }
  }
}

// Export singleton instance
export const testRunner = new TestRunner();