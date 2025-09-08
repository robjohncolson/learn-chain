// Phase 2: FRQ Scoring System
// ADR-028: 1-5 scale scoring for free response questions

import { RubricPart, Scoring } from './types.js';

/**
 * Scores a free response question based on rubric criteria
 * ADR-028: All FRQ scores must be between 1.0 and 5.0
 * @param response The student's response text
 * @param rubric The scoring rubric for the question
 * @returns Score between 1.0 and 5.0
 */
export function scoreFRQResponse(response: string, rubric: Scoring): number {
  if (!response || response.trim().length === 0) {
    return 1.0; // Minimum score for blank response
  }
  
  // This is a placeholder for actual scoring logic
  // In production, this would involve:
  // 1. Natural language processing
  // 2. Rubric matching
  // 3. Partial credit calculation
  
  // For Phase 2, we'll use a simple heuristic based on response length
  // and keyword matching as a demonstration
  
  const responseLength = response.trim().split(/\s+/).length;
  const maxScore = 5.0;
  const minScore = 1.0;
  
  // Simple length-based scoring (to be replaced with actual rubric evaluation)
  let score = minScore;
  
  if (responseLength > 10) score += 1.0;
  if (responseLength > 30) score += 1.0;
  if (responseLength > 50) score += 1.0;
  if (responseLength > 100) score += 1.0;
  
  // Ensure score is within bounds
  return Math.min(maxScore, Math.max(minScore, score));
}

/**
 * Validates that a score is within the valid FRQ range
 * @param score The score to validate
 * @returns True if score is between 1.0 and 5.0
 */
export function isValidFRQScore(score: number): boolean {
  return score >= 1.0 && score <= 5.0;
}

/**
 * Normalizes a confidence value to the 1-5 scale
 * @param confidence Raw confidence value
 * @returns Normalized confidence between 1 and 5
 */
export function normalizeConfidence(confidence: number): number {
  if (confidence < 1) return 1;
  if (confidence > 5) return 5;
  return Math.round(confidence);
}

/**
 * Converts a 1-5 confidence score to a weight multiplier
 * ADR-028: Confidence affects reputation rewards
 * @param confidence Confidence score (1-5)
 * @returns Weight multiplier (0.2 to 1.0)
 */
export function confidenceToWeight(confidence: number): number {
  const normalized = normalizeConfidence(confidence);
  // Linear mapping: 1->0.2, 2->0.4, 3->0.6, 4->0.8, 5->1.0
  return 0.2 * normalized;
}

/**
 * Calculates the mean score from an array of FRQ scores
 * @param scores Array of scores (1-5 scale)
 * @returns Mean score
 */
export function calculateMeanScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return sum / scores.length;
}

/**
 * Calculates the standard deviation of FRQ scores
 * @param scores Array of scores (1-5 scale)
 * @returns Standard deviation
 */
export function calculateStandardDeviation(scores: number[]): number {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return 0;
  
  const mean = calculateMeanScore(scores);
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / scores.length;
  
  return Math.sqrt(avgSquaredDiff);
}