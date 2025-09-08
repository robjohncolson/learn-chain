// Phase 2: Question Types from curriculum.json schema
// Aligned with ADR-028 Emergent Attestation

// --- Core Question & Curriculum Types ---

export interface Question {
  id: string;
  type: 'multiple-choice' | 'free-response';
  prompt: string;
  answerKey?: string;
  reasoning?: string;
  attachments?: Attachments;
  solution?: Solution; // For free-response questions
}

export type Curriculum = Question[];

// --- Attachment Types ---

export interface Attachments {
  choices?: Choice[];
  table?: TableData;
  charts?: ChartData[];
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  chartType?: ChartType;
  [key: string]: any;
}

export interface Choice {
  key: string; // 'A', 'B', 'C', 'D', 'E'
  value: string;
}

export type TableData = string[][];

// --- Chart Data Types ---

export type ChartType = 
  | 'bar' 
  | 'histogram' 
  | 'pie' 
  | 'scatter' 
  | 'dotplot' 
  | 'boxplot' 
  | 'normal'
  | 'chisquare'
  | 'numberline';

export interface ChartData {
  chartType: ChartType;
  title?: string;
  description?: string;
  chartConfig?: any;
  [key: string]: any;
}

// --- Solution & Scoring Types (for Free-Response Questions) ---

export interface Solution {
  parts: SolutionPart[];
  scoring?: Scoring;
}

export interface SolutionPart {
  partId: string;
  description: string;
  response: string;
  calculations?: string[];
  attachments?: Attachments;
}

export interface Scoring {
  totalPoints: number;
  rubric: RubricPart[];
}

export interface RubricPart {
  part: string;
  maxPoints: number;
  criteria: string[];
  scoringNotes?: string;
}

// --- ADR-028 Attestation Types ---

export interface MCQAttestation {
  questionId: string;
  answerHash: string; // SHA-256 of choice key
  timestamp: number;
  attesterPubkey: string;
  signature: string;
}

export interface FRQAttestation {
  questionId: string;
  answerText: string;
  score: number; // 1-5 scale per ADR-028
  confidence: number; // 1-5 scale per ADR-028
  timestamp: number;
  attesterPubkey: string;
  signature: string;
}

export type QuestionAttestation = MCQAttestation | FRQAttestation;

// Type guards
export function isMCQAttestation(attestation: QuestionAttestation): attestation is MCQAttestation {
  return 'answerHash' in attestation;
}

export function isFRQAttestation(attestation: QuestionAttestation): attestation is FRQAttestation {
  return 'score' in attestation && 'answerText' in attestation;
}