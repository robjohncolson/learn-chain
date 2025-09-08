// Phase 2: Questions Module Index
// Central export point for all question-related functionality

// Core types
export * from './types.js';

// Hashing utilities for MCQ
export { 
  hashMCQAnswer, 
  verifyMCQAnswerHash, 
  MCQ_CHOICE_HASHES, 
  getChoiceFromHash 
} from './hashing.js';

// FRQ scoring utilities
export {
  scoreFRQResponse,
  isValidFRQScore,
  normalizeConfidence,
  confidenceToWeight,
  calculateMeanScore,
  calculateStandardDeviation
} from './scoring.js';