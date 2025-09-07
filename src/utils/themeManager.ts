/**
 * Theme Manager for Quiz Renderer
 * Handles theme switching, persistence, and chart color generation
 */

import type { Theme, ThemeColors } from '../types';

/**
 * Default themes
 */
const LIGHT_THEME: Theme = {
  name: 'light',
  colors: {
    primary: '#3498db',
    secondary: '#2c3e50',
    background: '#ffffff',
    text: '#333333',
    grid: '#e9ecef',
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  }
};

const DARK_THEME: Theme = {
  name: 'dark',
  colors: {
    primary: '#5BC0EB',
    secondary: '#87ceeb',
    background: '#1a1a1a',
    text: '#e0e0e0',
    grid: '#555555',
    success: '#4a7c59',
    error: '#cc3333',
    warning: '#ffcc00',
    info: '#5BC0EB'
  }
};

/**
 * Theme Manager class
 * Singleton pattern for managing application theme
 */
export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme;
  private listeners: Set<(theme: Theme) => void>;
  private storageKey = 'quizRendererTheme';
  
  private constructor() {
    this.currentTheme = this.loadTheme();
    this.listeners = new Set();
    this.applyTheme();
    
    // Listen for system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (!this.hasUserPreference()) {
          this.setTheme(e.matches ? DARK_THEME : LIGHT_THEME);
        }
      });
    }
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }
  
  /**
   * Get current theme
   */
  getCurrentTheme(): Theme {
    return this.currentTheme;
  }
  
  /**
   * Set theme
   */
  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.saveTheme();
    this.applyTheme();
    this.notifyListeners();
  }
  
  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): Theme {
    const newTheme = this.currentTheme.name === 'light' ? DARK_THEME : LIGHT_THEME;
    this.setTheme(newTheme);
    return newTheme;
  }
  
  /**
   * Subscribe to theme changes
   */
  subscribe(listener: (theme: Theme) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Check if theme is dark
   */
  isDarkMode(): boolean {
    return this.currentTheme.name === 'dark';
  }
  
  /**
   * Get theme colors
   */
  getColors(): ThemeColors {
    return this.currentTheme.colors || (this.isDarkMode() ? DARK_THEME.colors! : LIGHT_THEME.colors!);
  }
  
  /**
   * Get chart colors for current theme
   */
  getChartColors(count: number): string[] {
    const lightColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
      '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
      '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
    ];
    
    const darkColors = [
      '#FF8FA3', '#5BC0EB', '#FFE066', '#6BE6E6', 
      '#B366FF', '#FFB366', '#FF8FA3', '#E9EBEF',
      '#6BE6E6', '#FF8FA3', '#5BC0EB', '#FFE066'
    ];
    
    const colors = this.isDarkMode() ? darkColors : lightColors;
    
    // Repeat colors if needed
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    
    return result;
  }
  
  /**
   * Get grid color for charts
   */
  getGridColor(): string {
    return this.getColors().grid;
  }
  
  /**
   * Get text color
   */
  getTextColor(): string {
    return this.getColors().text;
  }
  
  /**
   * Get scatter point color
   */
  getScatterPointColor(): string {
    return this.isDarkMode() ? '#5BC0EB' : '#36A2EB';
  }
  
  /**
   * Apply theme to DOM
   */
  private applyTheme(): void {
    if (typeof document === 'undefined') return;
    
    // Apply theme class to body
    document.body.className = this.currentTheme.name === 'dark' ? 'dark-theme' : '';
    
    // Apply CSS variables
    const colors = this.getColors();
    const root = document.documentElement;
    
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', colors.background);
    }
  }
  
  /**
   * Load theme from storage
   */
  private loadTheme(): Theme {
    if (typeof localStorage === 'undefined') {
      return this.getSystemTheme();
    }
    
    const saved = localStorage.getItem(this.storageKey);
    if (saved === 'dark') return DARK_THEME;
    if (saved === 'light') return LIGHT_THEME;
    
    // No saved preference, use system
    return this.getSystemTheme();
  }
  
  /**
   * Save theme to storage
   */
  private saveTheme(): void {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(this.storageKey, this.currentTheme.name);
  }
  
  /**
   * Check if user has saved preference
   */
  private hasUserPreference(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(this.storageKey) !== null;
  }
  
  /**
   * Get system theme preference
   */
  private getSystemTheme(): Theme {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return LIGHT_THEME;
    }
    
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? DARK_THEME : LIGHT_THEME;
  }
  
  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentTheme);
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    });
  }
  
  /**
   * Get CSS for current theme
   */
  getThemeCSS(): string {
    const colors = this.getColors();
    
    return `
      :root {
        --theme-primary: ${colors.primary};
        --theme-secondary: ${colors.secondary};
        --theme-background: ${colors.background};
        --theme-text: ${colors.text};
        --theme-grid: ${colors.grid};
        --theme-success: ${colors.success};
        --theme-error: ${colors.error};
        --theme-warning: ${colors.warning};
        --theme-info: ${colors.info};
      }
      
      body {
        background-color: var(--theme-background);
        color: var(--theme-text);
      }
      
      .quiz-container {
        background: var(--theme-background);
        border-color: var(--theme-primary);
        color: var(--theme-text);
      }
      
      .chart-container {
        background: var(--theme-background);
        border-color: var(--theme-grid);
      }
      
      .choice {
        background: ${this.isDarkMode() ? '#333333' : '#f8f9fa'};
        border-color: var(--theme-grid);
        color: var(--theme-text);
      }
      
      .choice:hover {
        background: ${this.isDarkMode() ? '#665c00' : '#fff9c4'};
        border-color: ${this.isDarkMode() ? '#ffcc00' : '#ffd54f'};
      }
      
      .choice.correct-choice {
        background: ${this.isDarkMode() ? '#2d4a2d' : '#d4edda'};
        border-color: var(--theme-success);
      }
      
      .answer-key {
        background: ${this.isDarkMode() ? '#2d4a2d' : '#d4edda'};
        border-color: var(--theme-success);
        color: ${this.isDarkMode() ? '#90ee90' : '#155724'};
      }
      
      .reasoning {
        background: ${this.isDarkMode() ? '#1e3a5f' : '#e7f3ff'};
        border-color: var(--theme-info);
        color: ${this.isDarkMode() ? '#b3d9ff' : '#004085'};
      }
      
      table th {
        background-color: ${this.isDarkMode() ? '#404040' : '#343a40'};
        color: ${this.isDarkMode() ? '#e0e0e0' : 'white'};
      }
      
      table tr:nth-child(even) {
        background-color: ${this.isDarkMode() ? '#333333' : '#f8f9fa'};
      }
    `;
  }
  
  /**
   * Inject theme CSS into document
   */
  injectThemeCSS(): void {
    if (typeof document === 'undefined') return;
    
    // Remove existing theme style
    const existing = document.getElementById('quiz-renderer-theme');
    if (existing) {
      existing.remove();
    }
    
    // Create and inject new style
    const style = document.createElement('style');
    style.id = 'quiz-renderer-theme';
    style.textContent = this.getThemeCSS();
    document.head.appendChild(style);
  }
}

/**
 * Export singleton instance
 */
export const themeManager = ThemeManager.getInstance();

/**
 * Convenience exports
 */
export const getCurrentTheme = () => themeManager.getCurrentTheme();
export const setTheme = (theme: Theme) => themeManager.setTheme(theme);
export const toggleTheme = () => themeManager.toggleTheme();
export const isDarkMode = () => themeManager.isDarkMode();
export const getChartColors = (count: number) => themeManager.getChartColors(count);
export const subscribeToTheme = (listener: (theme: Theme) => void) => themeManager.subscribe(listener);