/**
 * Quiz Renderer Module - Main Export
 * Complete TypeScript module for rendering AP Statistics questions
 * Aligned with FUNDAMENTAL.md UI subsystem
 */

import type {
  RendererAPI,
  RendererConfig,
  Curriculum,
  Question,
  RenderOptions,
  Theme,
  ConsensusData,
  MessageOptions
} from './types';

import {
  renderQuiz,
  renderQuestion,
  renderChart,
  renderTable,
  renderChoices,
  renderSolution,
  renderConsensusDisplay,
  showStats,
  clearAll
} from './quiz_renderer';

import {
  cleanJsonText,
  parseCurriculum,
  showMessage,
  calculateStats,
  formatStats,
  loadScript,
  loadStylesheet,
  domReady
} from './utils/quizUtils';

import {
  themeManager,
  toggleTheme as toggleThemeUtil
} from './utils/themeManager';

// Re-export all types
export * from './types';

// Re-export utilities
export {
  cleanJsonText,
  parseCurriculum,
  showMessage,
  calculateStats,
  formatStats
} from './utils/quizUtils';

/**
 * Initialize the Quiz Renderer
 * Returns a complete API for rendering quizzes
 */
export function initializeRenderer(config: RendererConfig = {}): RendererAPI {
  // Apply initial configuration
  if (config.theme) {
    themeManager.setTheme(config.theme);
  }
  
  // Inject theme CSS
  themeManager.injectThemeCSS();
  
  // Set up audio if enabled
  const audioEnabled = config.audioEnabled !== false;
  
  // Set initial volume
  const volume = config.volume ?? 70;
  
  // Storage prefix for persistence
  const storagePrefix = config.storagePrefix || 'quizRenderer';
  
  // Lazy loading configuration
  const lazyLoadCharts = config.lazyLoadCharts !== false;
  const lazyLoadMath = config.lazyLoadMath !== false;
  
  // Create API object
  const api: RendererAPI = {
    /**
     * Render complete quiz
     */
    renderQuiz: (data: Curriculum, options?: RenderOptions) => {
      const mergedOptions = {
        mode: config.defaultMode || 'blind',
        ...options
      };
      
      // Handle both DOM and string return
      const container = mergedOptions.container || document.createElement('div');
      renderQuiz(data, mergedOptions);
      
      // Load MathJax if needed
      if (lazyLoadMath) {
        loadMathJaxIfNeeded(data);
      }
    },
    
    /**
     * Render single question
     */
    renderQuestion: (question: Question, index: number = 0, options?: RenderOptions) => {
      const mergedOptions = {
        mode: config.defaultMode || 'blind',
        ...options
      };
      
      const html = renderQuestion(question, index, mergedOptions);
      
      // If container provided, render as element
      if (mergedOptions.container) {
        mergedOptions.container.innerHTML = html;
        
        // Load MathJax for this question
        if (lazyLoadMath) {
          loadMathJaxForElement(mergedOptions.container);
        }
        
        return mergedOptions.container;
      }
      
      return html;
    },
    
    /**
     * Render chart
     */
    renderChart: (chartData, questionId) => {
      if (lazyLoadCharts) {
        ensureChartJSLoaded();
      }
      return renderChart(chartData, questionId);
    },
    
    /**
     * Render table
     */
    renderTable,
    
    /**
     * Render choices
     */
    renderChoices: (choices, answerKey, callbacks) => {
      return renderChoices(choices, answerKey, callbacks);
    },
    
    /**
     * Render solution
     */
    renderSolution,
    
    /**
     * Render consensus display
     */
    renderConsensusDisplay,
    
    /**
     * Clean JSON text
     */
    cleanJsonText,
    
    /**
     * Show message
     */
    showMessage: (message: string, options?: MessageOptions) => {
      showMessage(message, options);
    },
    
    /**
     * Show statistics
     */
    showStats,
    
    /**
     * Clear all rendered content
     */
    clearAll,
    
    /**
     * Toggle theme
     */
    toggleTheme: () => {
      return toggleThemeUtil();
    },
    
    /**
     * Clean up and destroy
     */
    destroy: () => {
      clearAll();
      // Remove theme CSS
      const themeStyle = document.getElementById('quiz-renderer-theme');
      if (themeStyle) {
        themeStyle.remove();
      }
    }
  };
  
  return api;
}

/**
 * Load MathJax if questions contain LaTeX
 */
async function loadMathJaxIfNeeded(questions: Curriculum): Promise<void> {
  // Check if any question contains LaTeX patterns
  const hasLatex = questions.some(q => 
    containsLatex(q.prompt) ||
    (q.reasoning && containsLatex(q.reasoning)) ||
    (q.attachments?.choices?.some(c => containsLatex(c.value)))
  );
  
  if (!hasLatex) return;
  
  // Load MathJax
  if (typeof window !== 'undefined' && !(window as any).MathJax) {
    await loadScript('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js');
  }
}

/**
 * Load MathJax for specific element
 */
async function loadMathJaxForElement(element: HTMLElement): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const MathJax = (window as any).MathJax;
  if (MathJax && MathJax.typesetPromise) {
    await MathJax.typesetPromise([element]);
  }
}

/**
 * Check if text contains LaTeX
 */
function containsLatex(text: string): boolean {
  // Check for common LaTeX patterns
  return /\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}/.test(text);
}

/**
 * Ensure Chart.js is loaded
 */
async function ensureChartJSLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && !(window as any).Chart) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js');
    
    // Also load datalabels plugin if needed
    if (!(window as any).ChartDataLabels) {
      await loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2');
    }
  }
}

/**
 * Default export - initialize with default config
 */
export default initializeRenderer;

/**
 * Browser-specific initialization
 * Auto-initializes when DOM is ready
 */
if (typeof window !== 'undefined') {
  (window as any).QuizRenderer = {
    initialize: initializeRenderer,
    renderQuiz,
    renderQuestion,
    cleanJsonText,
    parseCurriculum,
    showMessage,
    toggleTheme: toggleThemeUtil
  };
  
  // Auto-initialize on DOM ready with default config
  domReady().then(() => {
    const autoInit = document.querySelector('[data-quiz-renderer-auto]');
    if (autoInit) {
      const config: RendererConfig = {};
      
      // Parse config from data attributes
      if (autoInit.hasAttribute('data-theme')) {
        config.theme = { name: autoInit.getAttribute('data-theme') as 'light' | 'dark' };
      }
      
      if (autoInit.hasAttribute('data-mode')) {
        config.defaultMode = autoInit.getAttribute('data-mode') as any;
      }
      
      // Initialize
      const api = initializeRenderer(config);
      (window as any).quizRendererAPI = api;
    }
  });
}