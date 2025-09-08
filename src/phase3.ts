/**
 * Phase 3 Entry Point
 * Initializes the complete AP Statistics PoK Blockchain UI
 */

import { uiController } from './ui/ui';
import { Profile } from './core/profile';
import { EnhancedBlockchain } from './core/enhanced-blockchain';

// Export for debugging
(window as any).phase3 = {
  uiController,
  Profile,
  EnhancedBlockchain
};

// Initialize on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Phase 3: AP Statistics PoK Blockchain');
    console.log('📚 Loading curriculum data...');
    console.log('🔗 Initializing blockchain...');
    console.log('🎨 Setting up UI...');
    
    try {
      // Initialize UI controller (handles everything)
      await uiController.init();
      
      console.log('✅ Phase 3 initialized successfully!');
      console.log('Available debug commands:');
      console.log('  window.phase3.uiController - UI controller instance');
      console.log('  window.phase3.Profile - Profile class');
      console.log('  window.phase3.EnhancedBlockchain - Blockchain class');
      
    } catch (error) {
      console.error('❌ Failed to initialize Phase 3:', error);
    }
  });
}

export { uiController };