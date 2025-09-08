/**
 * Theme Management - Phase 3
 * Handles theme switching and persistence
 */

export interface Theme {
  name: 'light' | 'dark' | 'auto';
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    accent?: string;
  };
}

const LIGHT_THEME: Theme = {
  name: 'light',
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    background: '#ffffff',
    text: '#333333',
    accent: '#4CAF50'
  }
};

const DARK_THEME: Theme = {
  name: 'dark',
  colors: {
    primary: '#8b9dc3',
    secondary: '#9b6ca6',
    background: '#1a1a1a',
    text: '#e0e0e0',
    accent: '#66bb6a'
  }
};

let currentTheme: Theme = LIGHT_THEME;

/**
 * Initialize theme
 */
export async function initTheme(theme?: Theme): Promise<void> {
  // Load saved theme or use provided
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    try {
      currentTheme = JSON.parse(savedTheme);
    } catch {
      currentTheme = theme || LIGHT_THEME;
    }
  } else {
    currentTheme = theme || LIGHT_THEME;
  }

  // Apply theme
  applyTheme(currentTheme);

  // Set up auto theme if needed
  if (currentTheme.name === 'auto') {
    setupAutoTheme();
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  // Set CSS variables
  if (theme.colors) {
    root.style.setProperty('--color-primary', theme.colors.primary || '');
    root.style.setProperty('--color-secondary', theme.colors.secondary || '');
    root.style.setProperty('--color-background', theme.colors.background || '');
    root.style.setProperty('--color-text', theme.colors.text || '');
    root.style.setProperty('--color-accent', theme.colors.accent || '');
  }

  // Set theme class
  document.body.className = `theme-${theme.name}`;

  // Apply global styles
  applyGlobalStyles(theme);
}

/**
 * Apply global theme styles
 */
function applyGlobalStyles(theme: Theme): void {
  let styleEl = document.getElementById('theme-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-styles';
    document.head.appendChild(styleEl);
  }

  const isDark = theme.name === 'dark';
  
  styleEl.textContent = `
    :root {
      --header-bg: ${isDark 
        ? 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)' 
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
      --card-bg: ${isDark ? '#2d3748' : '#ffffff'};
      --card-border: ${isDark ? '#4a5568' : '#e0e0e0'};
      --text-primary: ${theme.colors?.text || (isDark ? '#e0e0e0' : '#333333')};
      --text-secondary: ${isDark ? '#a0aec0' : '#666666'};
      --hover-bg: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
      --shadow: ${isDark 
        ? '0 2px 8px rgba(0,0,0,0.3)' 
        : '0 2px 8px rgba(0,0,0,0.1)'};
    }
    
    body {
      background-color: ${theme.colors?.background || (isDark ? '#1a1a1a' : '#f5f5f5')};
      color: var(--text-primary);
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    .dashboard-section,
    .question-element,
    .attestation-container > div {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      box-shadow: var(--shadow);
    }
    
    .unit-header:hover,
    .topic-item:hover {
      background: var(--hover-bg);
    }
    
    input, textarea, select {
      background: var(--card-bg);
      color: var(--text-primary);
      border: 1px solid var(--card-border);
    }
    
    .btn-secondary {
      background: ${isDark ? '#4a5568' : '#e0e0e0'};
      color: var(--text-primary);
    }
    
    .btn-secondary:hover {
      background: ${isDark ? '#718096' : '#d0d0d0'};
    }
    
    /* Syntax highlighting for code */
    .code-block {
      background: ${isDark ? '#2d3748' : '#f7f7f7'};
      border: 1px solid var(--card-border);
    }
    
    /* Chart colors */
    .chart-container {
      filter: ${isDark ? 'brightness(0.9)' : 'none'};
    }
  `;
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme(): Theme {
  const newTheme = currentTheme.name === 'light' ? DARK_THEME : LIGHT_THEME;
  currentTheme = newTheme;
  
  // Apply and save
  applyTheme(newTheme);
  localStorage.setItem('theme', JSON.stringify(newTheme));
  
  return newTheme;
}

/**
 * Set specific theme
 */
export function setTheme(theme: Theme): void {
  currentTheme = theme;
  applyTheme(theme);
  localStorage.setItem('theme', JSON.stringify(theme));
}

/**
 * Get current theme
 */
export function getCurrentTheme(): Theme {
  return currentTheme;
}

/**
 * Setup auto theme based on system preference
 */
function setupAutoTheme(): void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Set initial theme
  const theme = mediaQuery.matches ? DARK_THEME : LIGHT_THEME;
  applyTheme(theme);
  
  // Listen for changes
  mediaQuery.addEventListener('change', (e) => {
    const theme = e.matches ? DARK_THEME : LIGHT_THEME;
    applyTheme(theme);
  });
}