/**
 * Utility functions for the Quiz Renderer module
 * Provides data validation, JSON cleaning, and message display utilities
 */

import type {
  Question,
  Curriculum,
  MessageType,
  MessageOptions,
  FeedbackType
} from '../types';

import { isQuestion, sanitizeCurriculum } from '../types/guards';

/**
 * Clean potentially malformed JSON text
 * Handles comments, trailing commas, and multiple objects
 */
export function cleanJsonText(text: string): string {
  try {
    // Step 1: Remove all comment lines and empty lines
    const lines = text.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && trimmed !== '';
    });
    
    // Step 2: Join and fix basic JSON issues
    let cleanedText = cleanedLines.join('\n');
    cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1'); // Fix trailing commas
    
    // Step 3: Try to parse as-is first (might be valid JSON already)
    try {
      JSON.parse(cleanedText);
      return cleanedText; // Already valid JSON
    } catch (e) {
      // Continue with multi-object processing
    }
    
    // Step 4: Handle multiple JSON objects
    const jsonObjects: string[] = [];
    let currentObject = '';
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i];
      currentObject += char;
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          
          // When braceCount reaches 0, we have a complete object
          if (braceCount === 0) {
            const trimmedObject = currentObject.trim();
            if (trimmedObject) {
              // Validate this individual object
              try {
                JSON.parse(trimmedObject);
                jsonObjects.push(trimmedObject);
              } catch (e) {
                console.warn('Skipping invalid JSON object:', e);
              }
            }
            currentObject = '';
          }
        }
      }
    }
    
    // Handle any remaining content
    if (currentObject.trim()) {
      try {
        JSON.parse(currentObject.trim());
        jsonObjects.push(currentObject.trim());
      } catch (e) {
        console.warn('Skipping invalid remaining JSON:', e);
      }
    }
    
    if (jsonObjects.length === 0) {
      throw new Error('No valid JSON objects found');
    }
    
    // If we have multiple objects, wrap in array
    if (jsonObjects.length > 1) {
      return '[' + jsonObjects.join(',') + ']';
    } else {
      return jsonObjects[0];
    }
    
  } catch (error) {
    throw new Error(`JSON sanitization failed: ${(error as Error).message}`);
  }
}

/**
 * Parse and validate curriculum data
 */
export function parseCurriculum(jsonText: string): Curriculum {
  const cleaned = cleanJsonText(jsonText);
  const parsed = JSON.parse(cleaned);
  
  // Handle different JSON structures
  let questions: Question[] = [];
  
  if (Array.isArray(parsed)) {
    questions = parsed;
  } else if (parsed.questions && Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  } else if (typeof parsed === 'object') {
    // Check if it's a single question object
    if (parsed.id && parsed.prompt) {
      questions = [parsed];
    } else {
      // Try to extract questions from object properties
      questions = Object.values(parsed).filter((item): item is Question => 
        typeof item === 'object' && item !== null && 'id' in item && 'prompt' in item
      ) as Question[];
    }
  }
  
  // Validate and sanitize
  const sanitized = sanitizeCurriculum(questions);
  if (!sanitized || sanitized.length === 0) {
    throw new Error('No valid questions found in the JSON data');
  }
  
  return sanitized;
}

/**
 * Display a message to the user
 */
export function showMessage(
  message: string,
  options: MessageOptions = { type: 'info' }
): HTMLElement {
  const { type, duration, dismissible, container } = options;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = getMessageClass(type || 'info');
  
  // Add icon based on type
  const icon = getMessageIcon(type || 'info');
  const title = getMessageTitle(type || 'info');
  
  messageDiv.innerHTML = `
    <strong>${icon} ${title}:</strong> ${escapeHtml(message)}
    ${dismissible ? '<button class="message-dismiss">×</button>' : ''}
  `;
  
  // Add dismiss handler
  if (dismissible) {
    const dismissBtn = messageDiv.querySelector('.message-dismiss');
    dismissBtn?.addEventListener('click', () => {
      messageDiv.remove();
    });
  }
  
  // Auto-dismiss after duration
  if (duration && duration > 0) {
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, duration);
  }
  
  // Append to container
  if (container) {
    container.appendChild(messageDiv);
  } else {
    const defaultContainer = document.getElementById('messageContainer');
    if (defaultContainer) {
      defaultContainer.appendChild(messageDiv);
    }
  }
  
  // Play audio feedback if enabled
  playMessageSound(type || 'info');
  
  return messageDiv;
}

/**
 * Get CSS class for message type
 */
function getMessageClass(type: MessageType): string {
  const classes: Record<MessageType, string> = {
    success: 'message success',
    error: 'message error',
    info: 'message info',
    warning: 'message warning'
  };
  return classes[type] || 'message';
}

/**
 * Get icon for message type
 */
function getMessageIcon(type: MessageType): string {
  const icons: Record<MessageType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  return icons[type] || 'ℹ️';
}

/**
 * Get title for message type
 */
function getMessageTitle(type: MessageType): string {
  const titles: Record<MessageType, string> = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    warning: 'Warning'
  };
  return titles[type] || 'Info';
}

/**
 * Play sound for message type (stub for audio integration)
 */
function playMessageSound(type: MessageType): void {
  // This will be implemented in the audio manager
  // For now, it's a no-op
}

/**
 * Calculate statistics for a set of questions
 */
export function calculateStats(questions: Curriculum): QuizStats {
  const totalQuestions = questions.length;
  const mcQuestions = questions.filter(q => q.type === 'multiple-choice').length;
  const frQuestions = questions.filter(q => q.type === 'free-response').length;
  const hasAnswers = questions.filter(q => q.answerKey).length;
  const hasReasoning = questions.filter(q => q.reasoning).length;
  const hasSolutions = questions.filter(q => q.solution).length;
  const hasScoring = questions.filter(q => q.solution?.scoring).length;
  
  // Count attachments
  const hasCharts = questions.filter(q => 
    q.attachments?.chartType || q.attachments?.charts
  ).length;
  
  const hasTables = questions.filter(q => 
    q.attachments?.table
  ).length;
  
  const hasImages = questions.filter(q => 
    q.attachments?.image || q.attachments?.images
  ).length;
  
  // Count solution charts
  const hasSolutionCharts = questions.filter(q => 
    q.solution?.parts?.some(part => 
      part.attachments?.chartType || part.attachments?.charts
    )
  ).length;
  
  // Chart type breakdown
  const chartTypes: Record<string, number> = {};
  questions.forEach(q => {
    if (q.attachments?.chartType) {
      chartTypes[q.attachments.chartType] = (chartTypes[q.attachments.chartType] || 0) + 1;
    }
    q.attachments?.charts?.forEach(chart => {
      chartTypes[chart.chartType] = (chartTypes[chart.chartType] || 0) + 1;
    });
  });
  
  return {
    totalQuestions,
    mcQuestions,
    frQuestions,
    hasAnswers,
    hasReasoning,
    hasSolutions,
    hasScoring,
    hasCharts,
    hasTables,
    hasImages,
    hasSolutionCharts,
    chartTypes
  };
}

/**
 * Quiz statistics interface
 */
export interface QuizStats {
  totalQuestions: number;
  mcQuestions: number;
  frQuestions: number;
  hasAnswers: number;
  hasReasoning: number;
  hasSolutions: number;
  hasScoring: number;
  hasCharts: number;
  hasTables: number;
  hasImages: number;
  hasSolutionCharts: number;
  chartTypes: Record<string, number>;
}

/**
 * Format statistics for display
 */
export function formatStats(stats: QuizStats): string {
  let output = `Total Questions: ${stats.totalQuestions} | `;
  output += `Multiple Choice: ${stats.mcQuestions} | `;
  output += `Free Response: ${stats.frQuestions}\n`;
  
  output += `With Answer Keys: ${stats.hasAnswers} | `;
  output += `With Reasoning: ${stats.hasReasoning} | `;
  output += `With Solutions: ${stats.hasSolutions} | `;
  output += `With Scoring: ${stats.hasScoring}\n`;
  
  output += `📈 Question Charts: ${stats.hasCharts}`;
  
  if (Object.keys(stats.chartTypes).length > 0) {
    const chartBreakdown: string[] = [];
    for (const [type, count] of Object.entries(stats.chartTypes)) {
      const icon = getChartIcon(type);
      chartBreakdown.push(`${icon} ${capitalize(type)}: ${count}`);
    }
    output += ` (${chartBreakdown.join(', ')})`;
  }
  
  output += ` | 📋 Tables: ${stats.hasTables}`;
  output += ` | 🖼️ Images: ${stats.hasImages}`;
  output += ` | 🎯 Solution Charts: ${stats.hasSolutionCharts}`;
  
  return output;
}

/**
 * Get icon for chart type
 */
function getChartIcon(type: string): string {
  const icons: Record<string, string> = {
    bar: '📊',
    histogram: '📈',
    pie: '🥧',
    scatter: '📈',
    dotplot: '🔘',
    boxplot: '📦',
    normal: '🔔',
    chisquare: 'χ²',
    numberline: '➡️'
  };
  return icons[type] || '📊';
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * HTML escape utility
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if we're in dark mode
 */
export function isDarkMode(): boolean {
  if (!isBrowser()) return false;
  
  // Check for saved preference
  const saved = localStorage.getItem('quizRendererTheme');
  if (saved) return saved === 'dark';
  
  // Check system preference
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  return false;
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      (cloned as any)[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Load external script dynamically
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('Not in browser environment'));
      return;
    }
    
    // Check if already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    
    document.head.appendChild(script);
  });
}

/**
 * Load external stylesheet dynamically
 */
export function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('Not in browser environment'));
      return;
    }
    
    // Check if already loaded
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    
    document.head.appendChild(link);
  });
}

/**
 * Wait for DOM to be ready
 */
export function domReady(): Promise<void> {
  return new Promise(resolve => {
    if (!isBrowser()) {
      resolve();
      return;
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * Request animation frame with fallback
 */
export function raf(callback: FrameRequestCallback): number {
  if (!isBrowser()) return 0;
  
  const requestAnimationFrame = 
    window.requestAnimationFrame ||
    (window as any).webkitRequestAnimationFrame ||
    (window as any).mozRequestAnimationFrame ||
    ((cb: FrameRequestCallback) => window.setTimeout(cb, 1000 / 60));
  
  return requestAnimationFrame(callback);
}

/**
 * Cancel animation frame with fallback
 */
export function cancelRaf(id: number): void {
  if (!isBrowser()) return;
  
  const cancelAnimationFrame = 
    window.cancelAnimationFrame ||
    (window as any).webkitCancelAnimationFrame ||
    (window as any).mozCancelAnimationFrame ||
    window.clearTimeout;
  
  cancelAnimationFrame(id);
}