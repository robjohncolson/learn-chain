/**
 * Local Storage Manager for Quiz Renderer
 * Handles persistent storage of user data, preferences, and attestation history
 * Aligned with FUNDAMENTAL.md Persistence (P2) atoms
 */

import type { 
  Question, 
  Attestation, 
  Theme,
  RateLimitInfo 
} from '../types';

/**
 * Storage keys structure
 */
interface StorageKeys {
  theme: string;
  audio: string;
  volume: string;
  attestations: string;
  rateLimits: string;
  userProfile: string;
  quizProgress: string;
  consensusCache: string;
}

/**
 * User profile data
 */
interface UserProfile {
  username?: string;
  pubkey?: string;
  reputationScore?: number;
  createdAt: number;
  lastActive: number;
}

/**
 * Quiz progress data
 */
interface QuizProgress {
  currentQuestionId?: string;
  completedQuestions: string[];
  attestedQuestions: Record<string, AttestationRecord>;
  startedAt: number;
  lastUpdated: number;
}

/**
 * Attestation record
 */
interface AttestationRecord {
  questionId: string;
  answer: string | number;
  confidence: number;
  timestamp: number;
  signature?: string;
}

/**
 * Local Storage Manager class
 * Handles all persistent storage operations
 */
export class LocalStorageManager {
  private static instance: LocalStorageManager;
  private prefix: string;
  private keys: StorageKeys;
  
  private constructor(prefix: string = 'quizRenderer') {
    this.prefix = prefix;
    this.keys = {
      theme: `${prefix}_theme`,
      audio: `${prefix}_audio`,
      volume: `${prefix}_volume`,
      attestations: `${prefix}_attestations`,
      rateLimits: `${prefix}_rateLimits`,
      userProfile: `${prefix}_userProfile`,
      quizProgress: `${prefix}_quizProgress`,
      consensusCache: `${prefix}_consensusCache`
    };
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(prefix?: string): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager(prefix);
    }
    return LocalStorageManager.instance;
  }
  
  /**
   * Check if localStorage is available
   */
  private isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get item from storage
   */
  private getItem<T>(key: string): T | null {
    if (!this.isAvailable()) return null;
    
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }
  
  /**
   * Set item in storage
   */
  private setItem<T>(key: string, value: T): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }
  
  /**
   * Remove item from storage
   */
  private removeItem(key: string): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
  
  // ============= User Profile =============
  
  /**
   * Get user profile
   */
  getUserProfile(): UserProfile | null {
    return this.getItem<UserProfile>(this.keys.userProfile);
  }
  
  /**
   * Save user profile
   */
  saveUserProfile(profile: Partial<UserProfile>): boolean {
    const existing = this.getUserProfile();
    const updated: UserProfile = {
      ...existing,
      ...profile,
      lastActive: Date.now(),
      createdAt: existing?.createdAt || Date.now()
    };
    
    return this.setItem(this.keys.userProfile, updated);
  }
  
  // ============= Quiz Progress =============
  
  /**
   * Get quiz progress
   */
  getQuizProgress(): QuizProgress | null {
    return this.getItem<QuizProgress>(this.keys.quizProgress);
  }
  
  /**
   * Save quiz progress
   */
  saveQuizProgress(progress: Partial<QuizProgress>): boolean {
    const existing = this.getQuizProgress();
    const updated: QuizProgress = {
      completedQuestions: [],
      attestedQuestions: {},
      ...existing,
      ...progress,
      lastUpdated: Date.now(),
      startedAt: existing?.startedAt || Date.now()
    };
    
    return this.setItem(this.keys.quizProgress, updated);
  }
  
  /**
   * Mark question as completed
   */
  markQuestionCompleted(questionId: string): boolean {
    const progress = this.getQuizProgress() || {
      completedQuestions: [],
      attestedQuestions: {},
      startedAt: Date.now(),
      lastUpdated: Date.now()
    };
    
    if (!progress.completedQuestions.includes(questionId)) {
      progress.completedQuestions.push(questionId);
      return this.saveQuizProgress(progress);
    }
    
    return true;
  }
  
  // ============= Attestations =============
  
  /**
   * Get all attestations
   */
  getAttestations(): AttestationRecord[] {
    return this.getItem<AttestationRecord[]>(this.keys.attestations) || [];
  }
  
  /**
   * Save attestation
   */
  saveAttestation(attestation: AttestationRecord): boolean {
    const attestations = this.getAttestations();
    attestations.push(attestation);
    
    // Also update quiz progress
    const progress = this.getQuizProgress() || {
      completedQuestions: [],
      attestedQuestions: {},
      startedAt: Date.now(),
      lastUpdated: Date.now()
    };
    
    progress.attestedQuestions[attestation.questionId] = attestation;
    this.saveQuizProgress(progress);
    
    return this.setItem(this.keys.attestations, attestations);
  }
  
  /**
   * Get attestation for question
   */
  getAttestation(questionId: string): AttestationRecord | null {
    const attestations = this.getAttestations();
    return attestations.find(a => a.questionId === questionId) || null;
  }
  
  /**
   * Check if question has been attested
   */
  hasAttested(questionId: string): boolean {
    return this.getAttestation(questionId) !== null;
  }
  
  // ============= Rate Limiting (ADR-028) =============
  
  /**
   * Get rate limit info
   */
  getRateLimits(): Record<string, number> {
    return this.getItem<Record<string, number>>(this.keys.rateLimits) || {};
  }
  
  /**
   * Check rate limit for question
   */
  checkRateLimit(userPubkey: string, questionId: string): RateLimitInfo {
    const limits = this.getRateLimits();
    const key = `${userPubkey}:${questionId}`;
    const lastAttestation = limits[key];
    
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    if (!lastAttestation) {
      return {
        userPubkey,
        questionId,
        canAttest: true
      };
    }
    
    const timeSince = now - lastAttestation;
    const canAttest = timeSince >= THIRTY_DAYS_MS;
    const timeUntilNext = canAttest ? 0 : THIRTY_DAYS_MS - timeSince;
    
    return {
      userPubkey,
      questionId,
      lastAttestation,
      canAttest,
      timeUntilNextAttestation: timeUntilNext
    };
  }
  
  /**
   * Update rate limit timestamp
   */
  updateRateLimit(userPubkey: string, questionId: string): boolean {
    const limits = this.getRateLimits();
    const key = `${userPubkey}:${questionId}`;
    limits[key] = Date.now();
    
    return this.setItem(this.keys.rateLimits, limits);
  }
  
  // ============= Consensus Cache =============
  
  /**
   * Get cached consensus data
   */
  getConsensusCache(): Record<string, any> {
    return this.getItem<Record<string, any>>(this.keys.consensusCache) || {};
  }
  
  /**
   * Cache consensus data for question
   */
  cacheConsensus(questionId: string, data: any, ttl: number = 300000): boolean {
    const cache = this.getConsensusCache();
    cache[questionId] = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    };
    
    // Clean expired entries
    const now = Date.now();
    for (const key in cache) {
      if (cache[key].expires < now) {
        delete cache[key];
      }
    }
    
    return this.setItem(this.keys.consensusCache, cache);
  }
  
  /**
   * Get cached consensus for question
   */
  getCachedConsensus(questionId: string): any | null {
    const cache = this.getConsensusCache();
    const entry = cache[questionId];
    
    if (!entry) return null;
    
    // Check if expired
    if (entry.expires < Date.now()) {
      delete cache[questionId];
      this.setItem(this.keys.consensusCache, cache);
      return null;
    }
    
    return entry.data;
  }
  
  // ============= Preferences =============
  
  /**
   * Get theme preference
   */
  getTheme(): 'light' | 'dark' | null {
    return this.getItem<'light' | 'dark'>(this.keys.theme);
  }
  
  /**
   * Save theme preference
   */
  saveTheme(theme: 'light' | 'dark'): boolean {
    return this.setItem(this.keys.theme, theme);
  }
  
  /**
   * Get audio preference
   */
  getAudioEnabled(): boolean | null {
    const saved = this.getItem<boolean>(this.keys.audio);
    return saved !== null ? saved : null;
  }
  
  /**
   * Save audio preference
   */
  saveAudioEnabled(enabled: boolean): boolean {
    return this.setItem(this.keys.audio, enabled);
  }
  
  /**
   * Get volume preference
   */
  getVolume(): number | null {
    return this.getItem<number>(this.keys.volume);
  }
  
  /**
   * Save volume preference
   */
  saveVolume(volume: number): boolean {
    return this.setItem(this.keys.volume, volume);
  }
  
  // ============= Data Management =============
  
  /**
   * Export all data
   */
  exportData(): Record<string, any> {
    if (!this.isAvailable()) return {};
    
    const data: Record<string, any> = {};
    
    for (const key in this.keys) {
      const storageKey = (this.keys as any)[key];
      const value = this.getItem(storageKey);
      if (value !== null) {
        data[key] = value;
      }
    }
    
    return data;
  }
  
  /**
   * Import data
   */
  importData(data: Record<string, any>): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      for (const key in data) {
        if (key in this.keys) {
          const storageKey = (this.keys as any)[key];
          this.setItem(storageKey, data[key]);
        }
      }
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Clear all data
   */
  clearAll(): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      for (const key in this.keys) {
        const storageKey = (this.keys as any)[key];
        this.removeItem(storageKey);
      }
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get storage size (approximate)
   */
  getStorageSize(): number {
    if (!this.isAvailable()) return 0;
    
    let size = 0;
    for (const key in this.keys) {
      const storageKey = (this.keys as any)[key];
      const item = localStorage.getItem(storageKey);
      if (item) {
        size += item.length;
      }
    }
    
    return size;
  }
}

/**
 * Export singleton instance
 */
export const storageManager = LocalStorageManager.getInstance();

/**
 * Convenience exports
 */
export const getUserProfile = () => storageManager.getUserProfile();
export const saveUserProfile = (profile: Partial<UserProfile>) => storageManager.saveUserProfile(profile);
export const getQuizProgress = () => storageManager.getQuizProgress();
export const saveQuizProgress = (progress: Partial<QuizProgress>) => storageManager.saveQuizProgress(progress);
export const saveAttestation = (attestation: AttestationRecord) => storageManager.saveAttestation(attestation);
export const hasAttested = (questionId: string) => storageManager.hasAttested(questionId);
export const checkRateLimit = (userPubkey: string, questionId: string) => storageManager.checkRateLimit(userPubkey, questionId);
export const updateRateLimit = (userPubkey: string, questionId: string) => storageManager.updateRateLimit(userPubkey, questionId);