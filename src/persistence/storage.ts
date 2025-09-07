// Persistence Layer using IndexedDB - Phase 1
import { Block, Profile } from '../core/types.js';

const DB_NAME = 'APStatsConsensus';
const DB_VERSION = 1;
const BLOCKS_STORE = 'blocks';
const PROFILES_STORE = 'profiles';

// IndexedDB wrapper class
export class Storage {
  private db: IDBDatabase | null = null;
  
  // Initialize IndexedDB
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create blocks store
        if (!db.objectStoreNames.contains(BLOCKS_STORE)) {
          const blocksStore = db.createObjectStore(BLOCKS_STORE, { keyPath: 'hash' });
          blocksStore.createIndex('timestamp', 'timestamp', { unique: false });
          blocksStore.createIndex('prevHash', 'prevHash', { unique: false });
        }
        
        // Create profiles store
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          const profilesStore = db.createObjectStore(PROFILES_STORE, { keyPath: 'pubkey' });
          profilesStore.createIndex('username', 'username', { unique: true });
        }
      };
    });
  }
  
  // Save the entire blockchain
  async saveChain(blocks: Block[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.db.transaction([BLOCKS_STORE], 'readwrite');
    const store = transaction.objectStore(BLOCKS_STORE);
    
    // Clear existing blocks
    await this.clearStore(BLOCKS_STORE);
    
    // Save all blocks
    for (const block of blocks) {
      store.add(block);
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to save blockchain'));
    });
  }
  
  // Load the entire blockchain
  async loadChain(): Promise<Block[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([BLOCKS_STORE], 'readonly');
      const store = transaction.objectStore(BLOCKS_STORE);
      const index = store.index('timestamp');
      const request = index.getAll();
      
      request.onsuccess = () => {
        const blocks = request.result as Block[];
        // Sort by timestamp to ensure correct order
        blocks.sort((a, b) => a.timestamp - b.timestamp);
        resolve(blocks);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to load blockchain'));
      };
    });
  }
  
  // Save a profile
  async saveProfile(profile: Profile): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROFILES_STORE], 'readwrite');
      const store = transaction.objectStore(PROFILES_STORE);
      
      // Store profile without private key for security
      const safeProfile = {
        username: profile.username,
        pubkey: profile.pubkey,
        seedphrase: profile.seedphrase
      };
      
      const request = store.put(safeProfile);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save profile'));
    });
  }
  
  // Load a profile by public key
  async loadProfile(pubkey: string): Promise<Profile | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROFILES_STORE], 'readonly');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.get(pubkey);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Note: privkey needs to be regenerated from seedphrase
          // For Phase 1, we return a partial profile
          resolve({
            username: result.username,
            pubkey: result.pubkey,
            privkey: '', // Will be regenerated from seedphrase
            seedphrase: result.seedphrase
          } as Profile);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to load profile'));
      };
    });
  }
  
  // Load all profiles
  async loadAllProfiles(): Promise<Profile[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROFILES_STORE], 'readonly');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result;
        const profiles = results.map((result: any) => ({
          username: result.username,
          pubkey: result.pubkey,
          privkey: '', // Will be regenerated from seedphrase
          seedphrase: result.seedphrase
        } as Profile));
        resolve(profiles);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to load profiles'));
      };
    });
  }
  
  // Check if a profile exists by username
  async profileExistsByUsername(username: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROFILES_STORE], 'readonly');
      const store = transaction.objectStore(PROFILES_STORE);
      const index = store.index('username');
      const request = index.get(username);
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to check profile existence'));
      };
    });
  }
  
  // Clear a store
  private async clearStore(storeName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }
  
  // Clear all data
  async clearAll(): Promise<void> {
    await this.clearStore(BLOCKS_STORE);
    await this.clearStore(PROFILES_STORE);
  }
  
  // Close the database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}