// Blockchain Function Atoms - Phase 1
import { Block, Transaction, TransactionData, MiningResult } from './types.js';
import { sha256Hash, signData, validateSignature, getCurrentTimestamp } from './crypto.js';

// Genesis block constant
const GENESIS_BLOCK: Block = {
  hash: '00genesis',
  prevHash: '0',
  timestamp: 0,
  nonce: 0,
  transactions: []
};

// Proof of Work difficulty - hash must start with '00'
const POW_PREFIX = '00';

// Calculate block hash
export const calculateBlockHash = async (
  prevHash: string,
  timestamp: number,
  transactions: Transaction[],
  nonce: number
): Promise<string> => {
  const data = `${prevHash}${timestamp}${JSON.stringify(transactions)}${nonce}`;
  return await sha256Hash(data);
};

// Mine a new block with Proof of Work
export const mineBlock = async (
  prevHash: string,
  transactions: Transaction[]
): Promise<MiningResult> => {
  const timestamp = getCurrentTimestamp();
  let nonce = 0;
  let hash = '';
  
  // Mine until we find a hash with the required prefix
  while (!hash.startsWith(POW_PREFIX)) {
    hash = await calculateBlockHash(prevHash, timestamp, transactions, nonce);
    nonce++;
  }
  
  const block: Block = {
    hash,
    prevHash,
    timestamp,
    nonce: nonce - 1,
    transactions
  };
  
  return { block, nonce: nonce - 1 };
};

// Create a transaction
export const createTransaction = async (
  txType: 'CreateUser' | 'Attestation',
  data: TransactionData,
  attesterPubkey: string,
  privkey: string
): Promise<Transaction> => {
  const timestamp = getCurrentTimestamp();
  const txData = {
    txType,
    timestamp,
    attesterPubkey,
    data
  };
  
  const dataString = JSON.stringify(txData);
  const hash = await sha256Hash(dataString);
  const signature = await signData(dataString, privkey);
  
  return {
    hash,
    txType,
    timestamp,
    attesterPubkey,
    signature,
    data
  };
};

// Validate a transaction
export const validateTransaction = async (tx: Transaction): Promise<boolean> => {
  try {
    // Verify signature
    const txData = {
      txType: tx.txType,
      timestamp: tx.timestamp,
      attesterPubkey: tx.attesterPubkey,
      data: tx.data
    };
    
    const dataString = JSON.stringify(txData);
    const isSignatureValid = await validateSignature(
      tx.signature,
      tx.attesterPubkey,
      dataString
    );
    
    if (!isSignatureValid) {
      console.error('Invalid signature for transaction:', tx.hash);
      return false;
    }
    
    // Verify hash
    const calculatedHash = await sha256Hash(dataString);
    if (calculatedHash !== tx.hash) {
      console.error('Hash mismatch for transaction:', tx.hash);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Transaction validation error:', error);
    return false;
  }
};

// Validate a block
export const validateBlock = async (
  block: Block,
  prevBlock: Block | null
): Promise<boolean> => {
  // Check genesis block
  if (!prevBlock && block.hash === GENESIS_BLOCK.hash) {
    return true;
  }
  
  // Verify previous hash linkage
  if (prevBlock && block.prevHash !== prevBlock.hash) {
    console.error('Invalid previous hash linkage');
    return false;
  }
  
  // Verify block hash
  const calculatedHash = await calculateBlockHash(
    block.prevHash,
    block.timestamp,
    block.transactions,
    block.nonce
  );
  
  if (calculatedHash !== block.hash) {
    console.error('Block hash mismatch');
    return false;
  }
  
  // Verify Proof of Work
  if (!block.hash.startsWith(POW_PREFIX)) {
    console.error('Invalid Proof of Work');
    return false;
  }
  
  // Verify timestamp ordering
  if (prevBlock && block.timestamp <= prevBlock.timestamp) {
    console.error('Invalid timestamp ordering');
    return false;
  }
  
  // Validate all transactions
  for (const tx of block.transactions) {
    const isValid = await validateTransaction(tx);
    if (!isValid) {
      return false;
    }
  }
  
  return true;
};

// Blockchain class
export class Blockchain {
  private chain: Block[] = [GENESIS_BLOCK];
  private pendingTransactions: Transaction[] = [];
  
  // Get the entire chain
  getChain(): Block[] {
    return [...this.chain];
  }
  
  // Get the latest block
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }
  
  // Add a transaction to pending pool
  async addTransaction(transaction: Transaction): Promise<boolean> {
    const isValid = await validateTransaction(transaction);
    if (!isValid) {
      return false;
    }
    
    // Check for duplicate transactions
    const exists = this.pendingTransactions.some(tx => tx.hash === transaction.hash);
    if (exists) {
      console.error('Duplicate transaction');
      return false;
    }
    
    this.pendingTransactions.push(transaction);
    return true;
  }
  
  // Mine pending transactions into a new block
  async minePendingTransactions(): Promise<Block | null> {
    if (this.pendingTransactions.length === 0) {
      console.log('No pending transactions to mine');
      return null;
    }
    
    const latestBlock = this.getLatestBlock();
    const { block } = await mineBlock(latestBlock.hash, this.pendingTransactions);
    
    // Validate the new block
    const isValid = await validateBlock(block, latestBlock);
    if (!isValid) {
      console.error('Mined block validation failed');
      return null;
    }
    
    this.chain.push(block);
    this.pendingTransactions = [];
    
    return block;
  }
  
  // Validate the entire chain
  async validateChain(): Promise<boolean> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      
      const isValid = await validateBlock(currentBlock, previousBlock);
      if (!isValid) {
        return false;
      }
    }
    
    return true;
  }
  
  // Load chain from storage
  async loadChain(blocks: Block[]): Promise<boolean> {
    // Validate the loaded chain
    for (let i = 1; i < blocks.length; i++) {
      const isValid = await validateBlock(blocks[i], blocks[i - 1]);
      if (!isValid) {
        console.error('Invalid chain loaded from storage');
        return false;
      }
    }
    
    this.chain = blocks;
    return true;
  }
  
  // Check for unique pubkeys in CreateUser transactions
  hasUserWithPubkey(pubkey: string): boolean {
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.txType === 'CreateUser' && 'pubkey' in tx.data) {
          if (tx.data.pubkey === pubkey) {
            return true;
          }
        }
      }
    }
    return false;
  }
}