/**
 * Audio Manager for Quiz Renderer
 * Handles synthesized audio feedback with Web Audio API
 * Extracted from quiz_renderer.html audio system
 */

import type { FeedbackType } from '../types';

/**
 * Audio Manager class
 * Singleton pattern for managing audio feedback
 */
export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioEnabled: boolean = true;
  private volume: number = 0.7; // 0-1 scale
  private lastExplicitSound: number = 0;
  private storageKey = 'quizRendererAudio';
  private volumeKey = 'quizRendererVolume';
  
  // Note pools for randomized feedback
  private successPool = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major
  private errorPool = [164.81, 196.00, 246.94, 329.63, 392.00, 493.88]; // E minor
  
  private constructor() {
    this.loadPreferences();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  /**
   * Initialize audio context (must be called after user interaction)
   */
  private initAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        // Create master gain for volume control
        if (this.audioContext) {
          this.masterGain = this.audioContext.createGain();
          this.masterGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
          this.masterGain.connect(this.audioContext.destination);
        }
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }
    return this.audioContext;
  }
  
  /**
   * Play a synthesized tone
   */
  playTone(
    frequency: number,
    duration: number = 0.3,
    type: OscillatorType = 'sine',
    volume: number = 1,
    detuneCents: number = 8
  ): void {
    if (!this.audioEnabled) return;
    
    const ctx = this.initAudioContext();
    if (!ctx || !this.masterGain) return;
    
    try {
      const now = ctx.currentTime;
      
      // Gain envelope (ADSR)
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.02); // Attack
      gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + duration * 0.6); // Decay/Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration); // Release
      
      gainNode.connect(this.masterGain);
      
      // Introduce slight random pitch offset for uniqueness
      const jitterCents = (Math.random() * 30) - 15;
      const primaryFreq = frequency * Math.pow(2, jitterCents / 1200);
      
      // Primary oscillator
      const osc1 = ctx.createOscillator();
      osc1.type = type;
      osc1.frequency.setValueAtTime(primaryFreq, now);
      
      // Secondary oscillator (slightly detuned) for richer sound
      const osc2 = ctx.createOscillator();
      osc2.type = type;
      osc2.frequency.setValueAtTime(primaryFreq * Math.pow(2, detuneCents / 1200), now);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      
      // Mark explicit sound time
      this.lastExplicitSound = Date.now();
      
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }
  
  /**
   * Play a chord (multiple tones)
   */
  playChord(
    frequencies: number[],
    duration: number = 0.3,
    type: OscillatorType = 'sine',
    volume: number = 0.08
  ): void {
    frequencies.forEach(freq => {
      this.playTone(freq, duration, type, volume);
    });
  }
  
  /**
   * Play a melodic sequence
   */
  playMelody(
    notes: number[],
    noteDuration: number = 0.2,
    gap: number = 0.05,
    type: OscillatorType = 'sine',
    volume: number = 0.12
  ): void {
    let offset = 0;
    notes.forEach(freq => {
      setTimeout(() => this.playTone(freq, noteDuration, type, volume), offset * 1000);
      offset += noteDuration + gap;
    });
  }
  
  /**
   * Play feedback sound based on type
   */
  playFeedback(type: FeedbackType): void {
    if (!this.audioEnabled) return;
    
    switch (type) {
      case 'success':
        this.playRandomSuccess();
        break;
      case 'error':
        this.playRandomError();
        break;
      case 'click':
        this.playClickSound();
        break;
      case 'load':
        this.playLoadSound();
        break;
      case 'clear':
        this.playClearSound();
        break;
      case 'theme':
        this.playThemeSound();
        break;
    }
  }
  
  /**
   * Play randomized success tone
   */
  private playRandomSuccess(): void {
    const notes = this.pickRandomDistinct(this.successPool, 2).sort((a, b) => a - b);
    this.playMelody(notes, 0.14, 0.03, 'triangle', 0.14);
  }
  
  /**
   * Play randomized error tone
   */
  private playRandomError(): void {
    const notes = this.pickRandomDistinct(this.errorPool, 2).sort((a, b) => b - a);
    this.playMelody(notes, 0.22, 0.05, 'sine', 0.08);
  }
  
  /**
   * Play click sound
   */
  private playClickSound(): void {
    const clickFreqs = [392.00, 415.30, 440.00, 466.16, 493.88];
    const waveforms: OscillatorType[] = ['square', 'triangle'];
    const freq = clickFreqs[Math.floor(Math.random() * clickFreqs.length)];
    const wave = waveforms[Math.floor(Math.random() * waveforms.length)];
    this.playTone(freq, 0.1 + Math.random() * 0.05, wave, 0.08);
  }
  
  /**
   * Play load sound
   */
  private playLoadSound(): void {
    this.playMelody([523.25, 659.25], 0.15, 0.03, 'triangle', 0.14);
  }
  
  /**
   * Play clear sound
   */
  private playClearSound(): void {
    this.playChord([392.00, 196.00], 0.35, 'square', 0.12);
  }
  
  /**
   * Play theme toggle sound
   */
  private playThemeSound(): void {
    this.playChord([261.63, 329.63, 392.00, 523.25], 0.2, 'sawtooth', 0.10);
  }
  
  /**
   * Pick random distinct elements from array
   */
  private pickRandomDistinct(pool: number[], count: number = 2): number[] {
    const copy = [...pool];
    const selected: number[] = [];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      selected.push(copy.splice(idx, 1)[0]);
    }
    return selected;
  }
  
  /**
   * Toggle audio on/off
   */
  toggleAudio(): boolean {
    this.audioEnabled = !this.audioEnabled;
    this.savePreferences();
    
    // Play test tone if enabled
    if (this.audioEnabled) {
      setTimeout(() => this.playTone(440, 0.1, 'sine', 0.08), 100);
    }
    
    return this.audioEnabled;
  }
  
  /**
   * Set volume (0-100 scale)
   */
  setVolume(value: number): void {
    // Convert from 0-100 to 0-1
    this.volume = Math.max(0, Math.min(100, value)) / 100;
    
    // Update master gain if initialized
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
    
    this.savePreferences();
    
    // Play test tone for immediate feedback
    if (this.audioEnabled && this.volume > 0) {
      setTimeout(() => this.playTone(523.25, 0.12, 'triangle', 0.15), 50);
    }
  }
  
  /**
   * Get current volume (0-100 scale)
   */
  getVolume(): number {
    return Math.round(this.volume * 100);
  }
  
  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.audioEnabled;
  }
  
  /**
   * Check if sound was recently played (for debouncing)
   */
  wasRecentlyPlayed(threshold: number = 50): boolean {
    return Date.now() - this.lastExplicitSound < threshold;
  }
  
  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    if (typeof localStorage === 'undefined') return;
    
    // Load audio enabled state
    const savedAudio = localStorage.getItem(this.storageKey);
    if (savedAudio !== null) {
      this.audioEnabled = savedAudio === 'true';
    }
    
    // Load volume
    const savedVolume = localStorage.getItem(this.volumeKey);
    if (savedVolume !== null) {
      this.volume = parseFloat(savedVolume) / 100;
    }
  }
  
  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(this.storageKey, String(this.audioEnabled));
    localStorage.setItem(this.volumeKey, String(this.getVolume()));
  }
  
  /**
   * Clean up audio context
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
    }
  }
}

/**
 * Export singleton instance
 */
export const audioManager = AudioManager.getInstance();

/**
 * Convenience exports
 */
export const playFeedback = (type: FeedbackType) => audioManager.playFeedback(type);
export const toggleAudio = () => audioManager.toggleAudio();
export const setVolume = (value: number) => audioManager.setVolume(value);
export const getVolume = () => audioManager.getVolume();
export const isAudioEnabled = () => audioManager.isEnabled();