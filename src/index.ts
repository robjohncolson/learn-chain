// Main Entry Point - Phase 1
import { Blockchain, createTransaction } from './core/blockchain.js';
import { createProfile, validateProfile } from './core/profile.js';
import { Storage } from './persistence/storage.js';
import { Profile, CreateUserData, AttestationData } from './core/types.js';

// Global instances
let blockchain: Blockchain;
let storage: Storage;
let currentProfile: Profile | null = null;

// Initialize the application
export async function initialize(): Promise<void> {
  console.log('Initializing AP Stats Consensus App - Phase 1');
  
  // Initialize storage
  storage = new Storage();
  await storage.init();
  
  // Initialize blockchain
  blockchain = new Blockchain();
  
  // Try to load existing chain
  const savedChain = await storage.loadChain();
  if (savedChain.length > 0) {
    const loaded = await blockchain.loadChain(savedChain);
    if (loaded) {
      console.log(`Loaded blockchain with ${savedChain.length} blocks`);
    } else {
      console.log('Failed to load saved chain, starting fresh');
    }
  } else {
    console.log('Starting with genesis block');
  }
  
  // Load profiles
  const profiles = await storage.loadAllProfiles();
  console.log(`Found ${profiles.length} profiles`);
}

// Create a new user
export async function createUser(username: string): Promise<Profile | null> {
  try {
    // Check if username already exists
    const exists = await storage.profileExistsByUsername(username);
    if (exists) {
      console.error('Username already exists');
      return null;
    }
    
    // Create new profile
    const profile = await createProfile(username);
    
    // Check if pubkey already exists in blockchain
    if (blockchain.hasUserWithPubkey(profile.pubkey)) {
      console.error('Public key collision detected (extremely rare)');
      return null;
    }
    
    // Create CreateUser transaction
    const userData: CreateUserData = {
      username: profile.username,
      pubkey: profile.pubkey
    };
    
    const transaction = await createTransaction(
      'CreateUser',
      userData,
      profile.pubkey,
      profile.privkey
    );
    
    // Add transaction to blockchain
    const added = await blockchain.addTransaction(transaction);
    if (!added) {
      console.error('Failed to add CreateUser transaction');
      return null;
    }
    
    // Mine the transaction
    const block = await blockchain.minePendingTransactions();
    if (!block) {
      console.error('Failed to mine CreateUser transaction');
      return null;
    }
    
    // Save profile and updated chain
    await storage.saveProfile(profile);
    await storage.saveChain(blockchain.getChain());
    
    console.log(`User created: ${username} with pubkey ${profile.pubkey.substring(0, 20)}...`);
    currentProfile = profile;
    return profile;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

// Create an attestation
export async function createAttestation(
  questionId: string,
  answerHash?: string,
  answerText?: string
): Promise<boolean> {
  if (!currentProfile) {
    console.error('No current profile set');
    return false;
  }
  
  if (!validateProfile(currentProfile)) {
    console.error('Invalid current profile');
    return false;
  }
  
  try {
    const attestationData: AttestationData = {
      questionId,
      answerHash,
      answerText
    };
    
    const transaction = await createTransaction(
      'Attestation',
      attestationData,
      currentProfile.pubkey,
      currentProfile.privkey
    );
    
    const added = await blockchain.addTransaction(transaction);
    if (!added) {
      console.error('Failed to add attestation transaction');
      return false;
    }
    
    console.log(`Attestation created for question ${questionId}`);
    return true;
  } catch (error) {
    console.error('Error creating attestation:', error);
    return false;
  }
}

// Mine pending transactions
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

// Set current profile
export async function setCurrentProfile(pubkey: string): Promise<boolean> {
  const profile = await storage.loadProfile(pubkey);
  if (!profile) {
    console.error('Profile not found');
    return false;
  }
  
  // Note: privkey needs to be regenerated from seedphrase
  // For Phase 1, we'll need to handle this separately
  currentProfile = profile;
  console.log(`Current profile set to ${profile.username}`);
  return true;
}

// Get blockchain info
export function getBlockchainInfo(): {
  blockCount: number;
  isValid: boolean;
  latestBlockHash: string;
} {
  const chain = blockchain.getChain();
  const latestBlock = blockchain.getLatestBlock();
  
  return {
    blockCount: chain.length,
    isValid: true, // Will be validated asynchronously
    latestBlockHash: latestBlock.hash
  };
}

// Validate the entire system
export async function validateSystem(): Promise<boolean> {
  console.log('Validating system integrity...');
  
  const isChainValid = await blockchain.validateChain();
  if (!isChainValid) {
    console.error('Blockchain validation failed');
    return false;
  }
  
  console.log('System validation passed');
  return true;
}

// Export API for UI layer
export const API = {
  initialize,
  createUser,
  createAttestation,
  minePendingTransactions,
  setCurrentProfile,
  getBlockchainInfo,
  validateSystem
};

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initialize);
}