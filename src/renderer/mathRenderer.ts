/**
 * MathJax Renderer Module
 * Manages lazy loading and queued rendering of mathematical notation
 * Ensures proper DOM timing and batch processing for performance
 */

declare const MathJax: any;

interface QueuedElement {
  element: HTMLElement;
  priority: number;
  timestamp: number;
}

class MathRenderer {
  private renderQueue: Map<HTMLElement, QueuedElement> = new Map();
  private observer: IntersectionObserver | null = null;
  private renderTimer: number | null = null;
  private isProcessing = false;
  private mathJaxLoaded = false;
  private mathJaxLoadPromise: Promise<void> | null = null;

  constructor() {
    this.initializeObserver();
    this.checkMathJaxAvailability();
  }

  /**
   * Initialize intersection observer for lazy loading
   */
  private initializeObserver(): void {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            // Higher priority for visible elements
            this.queueMathRendering(element, 1);
            this.observer?.unobserve(element);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );
  }

  /**
   * Check if MathJax is available
   */
  private checkMathJaxAvailability(): void {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      this.mathJaxLoaded = true;
    }
  }

  /**
   * Load MathJax dynamically if not present
   */
  async loadMathJax(): Promise<void> {
    if (this.mathJaxLoaded) return;
    if (this.mathJaxLoadPromise) return this.mathJaxLoadPromise;

    this.mathJaxLoadPromise = new Promise((resolve, reject) => {
      // First check if already loading or loaded
      if ((window as any).MathJax) {
        this.mathJaxLoaded = true;
        resolve();
        return;
      }

      // Configure MathJax before loading
      (window as any).MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
        },
        startup: {
          pageReady: () => {
            this.mathJaxLoaded = true;
            resolve();
          }
        }
      };

      // Try local file first, fallback to CDN
      const script = document.createElement('script');
      script.id = 'MathJax-script';
      script.async = true;
      
      // Try local bundled version first
      script.src = '/assets/vendor/mathjax/tex-mml-chtml.js';
      script.onerror = () => {
        // Fallback to CDN
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
        script.onerror = () => {
          console.warn('Failed to load MathJax from both local and CDN');
          reject(new Error('Failed to load MathJax'));
        };
      };

      document.head.appendChild(script);
    });

    return this.mathJaxLoadPromise;
  }

  /**
   * Queue element for math rendering
   */
  queueMathRendering(element: HTMLElement, priority: number = 0): void {
    if (!element || !element.isConnected) return;

    // Check if element contains math notation
    const text = element.textContent || '';
    const hasMath = /\$|\\\(|\\\[|\\begin\{/.test(text);
    if (!hasMath && !element.querySelector('.math, .MathJax')) return;

    // Add to queue
    this.renderQueue.set(element, {
      element,
      priority,
      timestamp: Date.now()
    });

    // Schedule processing
    this.scheduleProcessing();
  }

  /**
   * Schedule batch processing of queued elements
   */
  private scheduleProcessing(): void {
    if (this.renderTimer) return;

    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.processQueue();
    }, 100); // 100ms debounce
  }

  /**
   * Process the render queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.renderQueue.size === 0) return;
    this.isProcessing = true;

    try {
      // Ensure MathJax is loaded
      await this.loadMathJax();
      
      if (!this.mathJaxLoaded || !(window as any).MathJax?.typesetPromise) {
        console.warn('MathJax not fully loaded');
        this.isProcessing = false;
        return;
      }

      // Sort by priority and timestamp
      const sortedElements = Array.from(this.renderQueue.values())
        .sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return a.timestamp - b.timestamp;
        })
        .map(item => item.element)
        .filter(el => el.isConnected); // Only process connected elements

      if (sortedElements.length === 0) {
        this.renderQueue.clear();
        this.isProcessing = false;
        return;
      }

      // Batch process with MathJax
      try {
        await (window as any).MathJax.typesetPromise(sortedElements);
        
        // Clear processed elements from queue
        sortedElements.forEach(el => this.renderQueue.delete(el));
      } catch (error) {
        console.warn('MathJax typesetting error:', error);
        // Clear failed elements to prevent infinite retries
        sortedElements.forEach(el => this.renderQueue.delete(el));
      }
    } finally {
      this.isProcessing = false;

      // Process remaining items if any
      if (this.renderQueue.size > 0) {
        this.scheduleProcessing();
      }
    }
  }

  /**
   * Observe element for lazy math rendering
   */
  observeMath(element: HTMLElement): void {
    if (!this.observer) return;
    
    // Check if already in viewport
    const rect = element.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (inViewport) {
      this.queueMathRendering(element, 1);
    } else {
      this.observer.observe(element);
    }
  }

  /**
   * Render math in multiple choice options
   */
  renderChoiceMath(choicesContainer: HTMLElement): void {
    if (!choicesContainer) return;

    // Find all choice elements
    const choices = choicesContainer.querySelectorAll('.choice-text, .choice-label, [data-choice]');
    
    // Queue each choice for rendering
    choices.forEach((choice) => {
      this.queueMathRendering(choice as HTMLElement, 2); // High priority for choices
    });

    // Also queue the container itself
    this.queueMathRendering(choicesContainer, 1);
  }

  /**
   * Force immediate rendering (for critical content)
   */
  async renderImmediate(element: HTMLElement): Promise<void> {
    await this.loadMathJax();
    
    if (!this.mathJaxLoaded || !(window as any).MathJax?.typesetPromise) {
      console.warn('MathJax not available for immediate render');
      return;
    }

    try {
      await (window as any).MathJax.typesetPromise([element]);
    } catch (error) {
      console.warn('Immediate MathJax render failed:', error);
    }
  }

  /**
   * Clear the render queue
   */
  clearQueue(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.renderQueue.clear();
    this.isProcessing = false;
  }

  /**
   * Destroy the renderer and clean up
   */
  destroy(): void {
    this.clearQueue();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Re-render all math in a container
   */
  async rerenderContainer(container: HTMLElement): Promise<void> {
    if (!container) return;

    // Find all math elements
    const mathElements = container.querySelectorAll(
      '.MathJax, .MathJax_Preview, [data-math], .math-content'
    );

    // Reset MathJax state for these elements
    mathElements.forEach(el => {
      const parent = el.parentElement;
      if (parent && parent.classList.contains('MathJax_Display')) {
        // Replace with original script tag if available
        const script = parent.querySelector('script[type*="math/tex"]');
        if (script) {
          parent.innerHTML = script.outerHTML;
        }
      }
    });

    // Re-render
    await this.renderImmediate(container);
  }
}

// Create singleton instance
export const mathRenderer = new MathRenderer();

// Export convenience functions
export function queueMathRendering(element: HTMLElement, priority: number = 0): void {
  mathRenderer.queueMathRendering(element, priority);
}

export function observeMath(element: HTMLElement): void {
  mathRenderer.observeMath(element);
}

export function renderChoiceMath(choicesContainer: HTMLElement): void {
  mathRenderer.renderChoiceMath(choicesContainer);
}

export async function renderMathImmediate(element: HTMLElement): Promise<void> {
  return mathRenderer.renderImmediate(element);
}

export function clearMathQueue(): void {
  mathRenderer.clearQueue();
}

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mathRenderer.loadMathJax().catch(console.warn);
    });
  } else {
    mathRenderer.loadMathJax().catch(console.warn);
  }
}