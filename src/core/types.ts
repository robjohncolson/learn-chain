// Phase 1 Core Types - 20 Atoms from FUNDAMENTAL.md

// Profile Subsystem Data Atoms (4 for Phase 1)
export interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
}

// Blockchain Subsystem Data Atoms (8 for Phase 1)
export interface Block {
  hash: string;
  prevHash: string;
  timestamp: number;
  nonce: number;
  transactions: Transaction[];
}

export interface Transaction {
  hash: string;
  txType: TransactionType;
  timestamp: number;
  attesterPubkey: string;
  signature: string;
  data: TransactionData;
}

export type TransactionType = 'CreateUser' | 'Attestation';

export type TransactionData = CreateUserData | AttestationData;

export interface CreateUserData {
  username: string;
  pubkey: string;
}

export interface AttestationData {
  questionId: string;
  answerHash?: string;  // MCQ - SHA-256 hash
  answerText?: string;  // FRQ - plain text
}

// Function Type Aliases (5 for Phase 1)
export type DeriveKeysFromSeed = (seed: string) => Promise<[string, string]>; // [pubkey, privkey]
export type SelectRandomWords = (wordList: string[]) => string;
export type Sha256Hash = (input: string) => Promise<string>;
export type ValidateSignature = (signature: string, pubkey: string, data: string) => Promise<boolean>;
export type GetCurrentTimestamp = () => number;

// Blockchain Operation Types
export interface MiningResult {
  block: Block;
  nonce: number;
}

// Storage Interface
export interface ChainStorage {
  blocks: Block[];
  profiles: Profile[];
}