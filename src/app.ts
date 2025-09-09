/**
 * Main Application Entry Point
 * Initializes both backend and UI components
 */

import { initialize as initBackend } from './index';
import { UIController } from './ui/ui';

// Initialize both backend and UI components properly
async function startApp() {
  console.log('Starting AP Statistics PoK Blockchain...');
  
  // Initialize backend first
  await initBackend();
  
  // Initialize proper UI controller instead of basic HTML
  const uiController = new UIController();
  await uiController.init();
  
  // Make UI controller globally accessible for debugging
  (window as any).uiController = uiController;
  
  console.log('UI Controller initialized successfully');
}


// Export for module use
export { startApp };

// Start the app when DOM is ready (if not imported as module)
if (typeof window !== 'undefined' && typeof module === 'undefined') {
  window.addEventListener('DOMContentLoaded', startApp);
}