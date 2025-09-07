/**
 * Type guards for runtime validation of quiz data structures
 * These functions help ensure data integrity when parsing JSON
 */

import {
  Question,
  Curriculum,
  Choice,
  ChartData,
  ConsensusData,
  Attestation,
  MCQDistribution,
  FRQDistribution
} from './index';

/**
 * Check if a value is a valid Question object
 */
export function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false;
  
  const q = value as any;
  
  // Required fields
  if (typeof q.id !== 'string' || !q.id) return false;
  if (typeof q.prompt !== 'string' || !q.prompt) return false;
  if (q.type !== 'multiple-choice' && q.type !== 'free-response') return false;
  
  // Optional fields with type checking
  if (q.answerKey !== undefined && typeof q.answerKey !== 'string') return false;
  if (q.answerHash !== undefined && typeof q.answerHash !== 'string') return false;
  if (q.reasoning !== undefined && typeof q.reasoning !== 'string') return false;
  
  // Validate attachments if present
  if (q.attachments !== undefined) {
    if (typeof q.attachments !== 'object') return false;
    
    // Validate choices if present
    if (q.attachments.choices !== undefined) {
      if (!Array.isArray(q.attachments.choices)) return false;
      if (!q.attachments.choices.every(isChoice)) return false;
    }
    
    // Validate table if present
    if (q.attachments.table !== undefined) {
      if (!isTableData(q.attachments.table)) return false;
    }
  }
  
  // Validate solution if present
  if (q.solution !== undefined) {
    if (typeof q.solution !== 'object') return false;
    if (!Array.isArray(q.solution.parts)) return false;
  }
  
  return true;
}

/**
 * Check if a value is a valid Curriculum (array of Questions)
 */
export function isCurriculum(value: unknown): value is Curriculum {
  if (!Array.isArray(value)) return false;
  return value.every(isQuestion);
}

/**
 * Check if a value is a valid Choice object
 */
export function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== 'object') return false;
  
  const c = value as any;
  return (
    typeof c.key === 'string' &&
    typeof c.value === 'string'
  );
}

/**
 * Check if a value is valid TableData (2D string array)
 */
export function isTableData(value: unknown): value is string[][] {
  if (!Array.isArray(value)) return false;
  
  return value.every(row => 
    Array.isArray(row) && 
    row.every(cell => typeof cell === 'string')
  );
}

/**
 * Check if a value is a valid ChartData object
 */
export function isChartData(value: unknown): value is ChartData {
  if (!value || typeof value !== 'object') return false;
  
  const c = value as any;
  
  // chartType is required
  const validTypes = [
    'bar', 'histogram', 'pie', 'scatter', 
    'dotplot', 'boxplot', 'normal', 'chisquare', 'numberline'
  ];
  
  if (!validTypes.includes(c.chartType)) return false;
  
  // Other fields are optional but should have correct types if present
  if (c.title !== undefined && typeof c.title !== 'string') return false;
  if (c.description !== undefined && typeof c.description !== 'string') return false;
  
  return true;
}

/**
 * Check if a value is valid ConsensusData
 */
export function isConsensusData(value: unknown): value is ConsensusData {
  if (!value || typeof value !== 'object') return false;
  
  const c = value as any;
  
  // Required fields
  if (typeof c.questionId !== 'string') return false;
  if (typeof c.convergence !== 'number' || c.convergence < 0 || c.convergence > 1) return false;
  if (typeof c.confidence !== 'number' || c.confidence < 1 || c.confidence > 5) return false;
  if (typeof c.quorum !== 'number' || c.quorum < 3 || c.quorum > 5) return false;
  if (typeof c.totalAttestations !== 'number' || c.totalAttestations < 0) return false;
  if (typeof c.hasConsensus !== 'boolean') return false;
  
  // Optional fields with validation
  if (c.mcqDistribution !== undefined && !isMCQDistribution(c.mcqDistribution)) return false;
  if (c.frqDistribution !== undefined && !isFRQDistribution(c.frqDistribution)) return false;
  
  return true;
}

/**
 * Check if a value is a valid MCQDistribution
 */
export function isMCQDistribution(value: unknown): value is MCQDistribution {
  if (!value || typeof value !== 'object') return false;
  
  const d = value as any;
  
  if (typeof d.choices !== 'object') return false;
  if (typeof d.total !== 'number' || d.total < 0) return false;
  if (typeof d.mode !== 'string') return false;
  if (typeof d.modePercentage !== 'number' || d.modePercentage < 0 || d.modePercentage > 100) return false;
  
  // Validate choices object
  for (const key in d.choices) {
    if (typeof d.choices[key] !== 'number' || d.choices[key] < 0) return false;
  }
  
  return true;
}

/**
 * Check if a value is a valid FRQDistribution
 */
export function isFRQDistribution(value: unknown): value is FRQDistribution {
  if (!value || typeof value !== 'object') return false;
  
  const d = value as any;
  
  if (!Array.isArray(d.scores)) return false;
  if (typeof d.mean !== 'number') return false;
  if (typeof d.median !== 'number') return false;
  if (typeof d.stdDev !== 'number' || d.stdDev < 0) return false;
  if (typeof d.total !== 'number' || d.total < 0) return false;
  
  // Validate scores array
  for (const score of d.scores) {
    if (typeof score.score !== 'number' || score.score < 1 || score.score > 5) return false;
    if (typeof score.count !== 'number' || score.count < 0) return false;
    if (typeof score.percentage !== 'number' || score.percentage < 0 || score.percentage > 100) return false;
  }
  
  return true;
}

/**
 * Check if a value is a valid Attestation
 */
export function isAttestation(value: unknown): value is Attestation {
  if (!value || typeof value !== 'object') return false;
  
  const a = value as any;
  
  // Required fields
  if (typeof a.questionId !== 'string') return false;
  if (typeof a.attesterPubkey !== 'string') return false;
  if (typeof a.signature !== 'string') return false;
  if (typeof a.confidence !== 'number' || a.confidence < 1 || a.confidence > 5) return false;
  if (typeof a.timestamp !== 'number' || a.timestamp < 0) return false;
  
  // Must have either answerHash (MCQ) or answerText + score (FRQ)
  const hasMCQ = typeof a.answerHash === 'string';
  const hasFRQ = typeof a.answerText === 'string' && 
                 typeof a.score === 'number' && 
                 a.score >= 1 && 
                 a.score <= 5;
  
  if (!hasMCQ && !hasFRQ) return false;
  
  return true;
}

/**
 * Sanitize and validate question data from untrusted sources
 */
export function sanitizeQuestion(data: unknown): Question | null {
  if (!isQuestion(data)) return null;
  
  // Create a clean copy with only expected fields
  const clean: Question = {
    id: data.id,
    type: data.type,
    prompt: data.prompt
  };
  
  // Add optional fields if valid
  if (data.answerKey) clean.answerKey = data.answerKey;
  if (data.answerHash) clean.answerHash = data.answerHash;
  if (data.reasoning) clean.reasoning = data.reasoning;
  if (data.attachments) clean.attachments = data.attachments;
  if (data.solution) clean.solution = data.solution;
  if (data.rubric) clean.rubric = data.rubric;
  
  return clean;
}

/**
 * Sanitize and validate curriculum data from untrusted sources
 */
export function sanitizeCurriculum(data: unknown): Curriculum | null {
  if (!Array.isArray(data)) return null;
  
  const cleaned: Question[] = [];
  
  for (const item of data) {
    const clean = sanitizeQuestion(item);
    if (clean) cleaned.push(clean);
  }
  
  return cleaned.length > 0 ? cleaned : null;
}