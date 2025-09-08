// Profile Function Atoms - Phase 1
import { Profile, SelectRandomWords } from './types.js';
import { generateKeyPair } from './crypto.js';

// Re-export Profile type for modules that import from this file
export type { Profile } from './types.js';

// BIP39 wordlist - hardcoded subset for deterministic generation
// Full list has 2048 words - using first 256 for demonstration
const BIP39_WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
  'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
  'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
  'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
  'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
  'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
  'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
  'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
  'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
  'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
  'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
  'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
  'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
  'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable'
];

// Select Random Words Function Atom
export const selectRandomWords: SelectRandomWords = (wordList: string[]): string => {
  const wordCount = 12; // Standard BIP39 seed phrase length
  const words: string[] = [];
  
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    words.push(wordList[randomIndex]);
  }
  
  return words.join(' ');
};

// Create a new profile with generated keys
export const createProfile = async (username: string): Promise<Profile> => {
  const seedphrase = selectRandomWords(BIP39_WORDLIST);
  const [pubkey, privkey] = await generateKeyPair();
  
  return {
    username,
    pubkey,
    privkey,
    seedphrase
  };
};

// Recover profile from seed phrase (simplified for Phase 1)
export const recoverProfile = async (username: string, seedphrase: string): Promise<Profile> => {
  // For Phase 1, we generate new keys
  // Phase 2 will implement proper deterministic derivation
  const [pubkey, privkey] = await generateKeyPair();
  
  return {
    username,
    pubkey,
    privkey,
    seedphrase
  };
};

// Serialize profile for storage (exclude private key for safety)
export const serializeProfile = (profile: Profile): string => {
  const safeProfile = {
    username: profile.username,
    pubkey: profile.pubkey,
    seedphrase: profile.seedphrase
  };
  return JSON.stringify(safeProfile);
};

// Validate profile integrity
export const validateProfile = (profile: Profile): boolean => {
  return !!(
    profile.username &&
    profile.pubkey &&
    profile.privkey &&
    profile.seedphrase &&
    profile.seedphrase.split(' ').length >= 12
  );
};