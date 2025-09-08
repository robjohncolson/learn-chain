// Phase 2: Main Entry Point
// Emergent Attestation System per ADR-028

import { EnhancedBlockchain } from './core/enhanced-blockchain.js';
import { Storage } from './persistence/storage.js';
import { createProfile } from './core/profile.js';
import { Profile } from './core/types.js';
import { Question, Curriculum } from './questions/types.js';

// Global instances
let blockchain: EnhancedBlockchain;
let storage: Storage;
let currentProfile: Profile | null = null;
let curriculum: Curriculum = [];

/**
 * Initialize Phase 2 system
 */
export async function initializePhase2(): Promise<void> {
  console.log('Initializing AP Stats Consensus App - Phase 2');
  console.log('ADR-028: Emergent Attestation Enabled');
  
  // Initialize storage
  storage = new Storage();
  await storage.init();
  
  // Initialize enhanced blockchain
  blockchain = new EnhancedBlockchain();
  
  // Try to load existing state
  const savedChain = await storage.loadChain();
  if (savedChain.length > 0) {
    const loaded = await blockchain.loadChain(savedChain);
    if (loaded) {
      console.log(`Loaded blockchain with ${savedChain.length} blocks`);
    }
  }
  
  // Load curriculum if available
  try {
    curriculum = await loadCurriculum();
    console.log(`Loaded ${curriculum.length} questions from curriculum`);
  } catch (error) {
    console.warn('No curriculum loaded:', error);
  }
  
  console.log('Phase 2 initialization complete');
}

/**
 * Load curriculum from file
 */
async function loadCurriculum(): Promise<Curriculum> {
  // This would load from curriculum.json
  // For now, return empty array
  return [];
}

/**
 * Create MCQ attestation
 */
export async function attestMCQ(
  questionId: string,
  choice: string
): Promise<boolean> {
  if (!currentProfile) {
    console.error('No current profile set');
    return false;
  }
  
  try {
    const tx = await blockchain.createMCQAttestation(
      questionId,
      choice,
      currentProfile.pubkey,
      currentProfile.privkey
    );
    
    if (!tx) {
      console.error('Failed to create MCQ attestation');
      return false;
    }
    
    const added = await blockchain.addTransaction(tx);
    if (!added) {
      console.error('Failed to add MCQ attestation (possible rate limit)');
      return false;
    }
    
    console.log(`MCQ attestation created for question ${questionId}, choice ${choice}`);
    return true;
  } catch (error) {
    console.error('Error creating MCQ attestation:', error);
    return false;
  }
}

/**
 * Create FRQ attestation
 */
export async function attestFRQ(
  questionId: string,
  answerText: string,
  score: number,
  confidence: number
): Promise<boolean> {
  if (!currentProfile) {
    console.error('No current profile set');
    return false;
  }
  
  try {
    const tx = await blockchain.createFRQAttestation(
      questionId,
      answerText,
      score,
      confidence,
      currentProfile.pubkey,
      currentProfile.privkey
    );
    
    if (!tx) {
      console.error('Failed to create FRQ attestation');
      return false;
    }
    
    const added = await blockchain.addTransaction(tx);
    if (!added) {
      console.error('Failed to add FRQ attestation (possible rate limit)');
      return false;
    }
    
    console.log(`FRQ attestation created for question ${questionId}, score ${score}, confidence ${confidence}`);
    return true;
  } catch (error) {
    console.error('Error creating FRQ attestation:', error);
    return false;
  }
}

/**
 * Get question consensus status
 */
export function getQuestionConsensus(questionId: string): {
  hasConsensus: boolean;
  convergence: number;
  attestationCount: number;
  consensusAnswer?: string | number;
} {
  const distribution = blockchain.getQuestionDistribution(questionId);
  
  if (!distribution) {
    return {
      hasConsensus: false,
      convergence: 0,
      attestationCount: 0
    };
  }
  
  const consensus = {
    hasConsensus: distribution.convergence >= 0.5 && distribution.totalAttestations >= 3,
    convergence: distribution.convergence,
    attestationCount: distribution.totalAttestations,
    consensusAnswer: undefined as string | number | undefined
  };
  
  if (consensus.hasConsensus) {
    if ('choices' in distribution) {
      // MCQ - find most popular choice
      let maxChoice = '';
      let maxCount = 0;
      const mcqDist = distribution as any;
      for (const [choice, count] of Object.entries(mcqDist.choices as Record<string, number>)) {
        if (count > maxCount) {
          maxCount = count;
          maxChoice = choice;
        }
      }
      consensus.consensusAnswer = maxChoice;
    } else if ('mean' in (distribution as any)) {
      // FRQ - use mean score
      const frqDist = distribution as any;
      consensus.consensusAnswer = frqDist.mean;
    }
  }
  
  return consensus;
}

/**
 * Get user's current reputation
 */
export function getUserReputation(userId?: string): number {
  const id = userId || currentProfile?.pubkey;
  if (!id) return 0;
  
  return blockchain.getUserReputation(id);
}

/**
 * Get consensus statistics
 */
export function getConsensusStatistics() {
  return blockchain.getConsensusStats();
}

/**
 * Mine pending transactions
 */
export async function minePendingTransactions(): Promise<boolean> {
  try {
    const block = await blockchain.minePendingTransactions();
    if (!block) {
      console.log('No blocks mined');
      return false;
    }
    
    // Save updated chain
    await storage.saveChain(blockchain.getChain());
    
    console.log(`Mined block ${block.hash} with ${block.transactions.length} transactions`);
    return true;
  } catch (error) {
    console.error('Error mining transactions:', error);
    return false;
  }
}

/**
 * Set current user profile
 */
export async function setCurrentProfile(pubkey: string): Promise<boolean> {
  const profile = await storage.loadProfile(pubkey);
  if (!profile) {
    console.error('Profile not found');
    return false;
  }
  
  currentProfile = profile;
  console.log(`Current profile set to ${profile.username}`);
  return true;
}

/**
 * Create a new user
 */
export async function createUser(username: string): Promise<Profile | null> {
  try {
    const profile = await createProfile(username);
    
    // Save profile
    await storage.saveProfile(profile);
    
    console.log(`User created: ${username}`);
    currentProfile = profile;
    return profile;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Get all question distributions
 */
export function getAllDistributions() {
  const distributions = blockchain.getAllDistributions();
  const result: any[] = [];
  
  for (const [questionId, dist] of distributions) {
    result.push({
      questionId,
      type: dist.type,
      convergence: dist.convergence,
      attestationCount: dist.totalAttestations,
      distribution: 'choices' in dist ? (dist as any).choices : { mean: (dist as any).mean, stdDev: (dist as any).stdDev }
    });
  }
  
  return result;
}

/**
 * Export Phase 2 system state
 */
export async function exportSystemState() {
  const state = blockchain.exportState();
  
  // Add profile data
  const profiles = await storage.loadAllProfiles();
  
  return {
    ...state,
    profiles,
    currentProfile: currentProfile?.pubkey || null
  };
}

/**
 * Import Phase 2 system state
 */
export async function importSystemState(state: any): Promise<boolean> {
  try {
    // Import blockchain state
    blockchain.importState(state);
    
    // Import profiles
    if (state.profiles) {
      for (const profile of state.profiles) {
        await storage.saveProfile(profile);
      }
    }
    
    // Set current profile
    if (state.currentProfile) {
      await setCurrentProfile(state.currentProfile);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to import state:', error);
    return false;
  }
}

// Export Phase 2 API
export const Phase2API = {
  initialize: initializePhase2,
  createUser,
  setCurrentProfile,
  attestMCQ,
  attestFRQ,
  getQuestionConsensus,
  getUserReputation,
  getConsensusStatistics,
  getAllDistributions,
  minePendingTransactions,
  exportSystemState,
  importSystemState
};

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initializePhase2);
}