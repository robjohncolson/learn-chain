/**
 * Audio Management - Phase 3
 * Handles sound effects and audio feedback
 */

let audioEnabled = true;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundBuffers: Map<string, AudioBuffer> = new Map();

// Sound effect definitions
const SOUNDS = {
  submit: { frequency: 523.25, duration: 0.1, type: 'sine' as OscillatorType },
  success: { frequency: 659.25, duration: 0.15, type: 'sine' as OscillatorType },
  error: { frequency: 220, duration: 0.2, type: 'sawtooth' as OscillatorType },
  transition: { frequency: 440, duration: 0.05, type: 'sine' as OscillatorType },
  consensus: { frequency: 783.99, duration: 0.3, type: 'sine' as OscillatorType },
  notification: { frequency: 880, duration: 0.2, type: 'triangle' as OscillatorType }
};

/**
 * Initialize audio system
 */
export async function initAudio(enabled: boolean = true): Promise<void> {
  audioEnabled = enabled;
  
  if (!audioEnabled) return;
  
  try {
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported');
      audioEnabled = false;
      return;
    }
    
    audioContext = new AudioContextClass();
    
    // Create master gain for volume control
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3; // Default volume
    masterGain.connect(audioContext.destination);
    
    // Pre-generate sound buffers
    await generateSoundBuffers();
    
    // Resume context on user interaction (for mobile)
    document.addEventListener('click', resumeAudioContext, { once: true });
    
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    audioEnabled = false;
  }
}

/**
 * Resume audio context (required for mobile)
 */
async function resumeAudioContext(): Promise<void> {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

/**
 * Generate sound buffers for all effects
 */
async function generateSoundBuffers(): Promise<void> {
  if (!audioContext) return;
  
  for (const [name, config] of Object.entries(SOUNDS)) {
    const buffer = createToneBuffer(
      config.frequency,
      config.duration,
      config.type
    );
    soundBuffers.set(name, buffer);
  }
}

/**
 * Create a tone buffer
 */
function createToneBuffer(
  frequency: number,
  duration: number,
  type: OscillatorType
): AudioBuffer {
  if (!audioContext) throw new Error('Audio context not initialized');
  
  const sampleRate = audioContext.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);
  
  // Generate waveform
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    switch (type) {
      case 'sine':
        sample = Math.sin(2 * Math.PI * frequency * t);
        break;
      case 'square':
        sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * ((frequency * t) % 1) - 1;
        break;
      case 'triangle':
        sample = 4 * Math.abs((frequency * t) % 1 - 0.5) - 1;
        break;
    }
    
    // Apply envelope (fade in/out)
    const envelope = Math.min(
      i / (0.01 * sampleRate), // Fade in
      1,
      (numSamples - i) / (0.01 * sampleRate) // Fade out
    );
    
    channel[i] = sample * envelope * 0.3;
  }
  
  return buffer;
}

/**
 * Play a sound effect
 */
export function playSound(soundName: string, volume: number = 1): void {
  if (!audioEnabled || !audioContext || !masterGain) return;
  
  try {
    const buffer = soundBuffers.get(soundName);
    if (!buffer) {
      // Fallback to generated tone
      const config = SOUNDS[soundName as keyof typeof SOUNDS];
      if (config) {
        playTone(config.frequency, config.duration, config.type, volume);
      }
      return;
    }
    
    // Play buffered sound
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(masterGain);
    
    source.start();
    
  } catch (error) {
    console.warn('Failed to play sound:', error);
  }
}

/**
 * Play a tone (fallback for custom sounds)
 */
export function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 1
): void {
  if (!audioEnabled || !audioContext || !masterGain) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.value = volume * 0.3;
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + duration
    );
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    
  } catch (error) {
    console.warn('Failed to play tone:', error);
  }
}

/**
 * Play a sequence of notes (for success melodies)
 */
export function playMelody(
  notes: Array<{ frequency: number; duration: number }>,
  volume: number = 1
): void {
  if (!audioEnabled) return;
  
  let delay = 0;
  notes.forEach(note => {
    setTimeout(() => {
      playTone(note.frequency, note.duration, 'sine', volume);
    }, delay * 1000);
    delay += note.duration;
  });
}

/**
 * Toggle audio on/off
 */
export function toggleAudio(): boolean {
  audioEnabled = !audioEnabled;
  
  if (audioEnabled && !audioContext) {
    initAudio(true);
  }
  
  // Save preference
  localStorage.setItem('audioEnabled', String(audioEnabled));
  
  return audioEnabled;
}

/**
 * Set master volume
 */
export function setVolume(volume: number): void {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audioVolume', String(volume));
  }
}

/**
 * Get audio enabled state
 */
export function isAudioEnabled(): boolean {
  return audioEnabled;
}

/**
 * Play success melody
 */
export function playSuccessMelody(): void {
  playMelody([
    { frequency: 523.25, duration: 0.1 }, // C5
    { frequency: 659.25, duration: 0.1 }, // E5
    { frequency: 783.99, duration: 0.2 }  // G5
  ]);
}

/**
 * Play error sound
 */
export function playErrorSound(): void {
  playSound('error', 0.5);
}

/**
 * Play notification sound
 */
export function playNotificationSound(): void {
  playSound('notification', 0.7);
}

/**
 * Initialize from localStorage
 */
export function loadAudioPreferences(): void {
  const savedEnabled = localStorage.getItem('audioEnabled');
  if (savedEnabled !== null) {
    audioEnabled = savedEnabled === 'true';
  }
  
  const savedVolume = localStorage.getItem('audioVolume');
  if (savedVolume !== null && masterGain) {
    masterGain.gain.value = parseFloat(savedVolume);
  }
}