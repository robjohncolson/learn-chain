/**
 * Test Types and Definitions
 * Support for local testing and simulation
 */

export interface SimulatedUser {
  id: string;
  username: string;
  pubkey: string;
  privkey: string;
  reputationScore: number;
  behavior: UserBehavior;
  attestationHistory: SimulatedAttestation[];
}

export enum UserBehavior {
  HONEST = 'HONEST',           // Always provides accurate attestations
  RANDOM = 'RANDOM',           // Random responses
  MALICIOUS = 'MALICIOUS',     // Tries to game the system
  LAZY = 'LAZY',               // Copies others' answers
  OUTLIER = 'OUTLIER',         // Consistently provides extreme scores
  COLLUDER = 'COLLUDER'        // Coordinates with other colluders
}

export interface SimulatedAttestation {
  questionId: string;
  answer: string | number;
  timestamp: number;
  confidence: number;
}

export interface TestScenario {
  name: string;
  description: string;
  users: SimulatedUser[];
  questions: TestQuestion[];
  expectedOutcome: ExpectedOutcome;
  duration?: number; // milliseconds
}

export interface TestQuestion {
  id: string;
  type: 'MCQ' | 'FRQ';
  correctAnswer?: string | number;
  rubric?: FRQRubric;
}

export interface FRQRubric {
  excellent: string[];  // Keywords for 5 score
  good: string[];      // Keywords for 4 score
  average: string[];   // Keywords for 3 score
  poor: string[];      // Keywords for 2 score
  failing: string[];   // Keywords for 1 score
}

export interface ExpectedOutcome {
  consensus: boolean;
  convergenceThreshold: number;
  outlierCount: number;
  quorumSize: number;
}

export interface TestResult {
  scenario: string;
  passed: boolean;
  actualOutcome: {
    consensus: boolean;
    convergence: number;
    outliers: string[];
    quorum: number;
  };
  errors: string[];
  warnings: string[];
  duration: number;
  timestamp: number;
}

export interface TestSuite {
  name: string;
  scenarios: TestScenario[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestReport {
  suites: TestSuiteResult[];
  summary: {
    totalScenarios: number;
    passed: number;
    failed: number;
    duration: number;
    timestamp: number;
  };
  recommendations: string[];
}

export interface TestSuiteResult {
  name: string;
  results: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

export interface SyncTestConfig {
  user1: SimulatedUser;
  user2: SimulatedUser;
  conflictingTransactions?: number;
  expectedMergeSuccess: boolean;
}