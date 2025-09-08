/**
 * Main UI Controller - Phase 3
 * Manages view switching, state, and core UI components
 * Aligned with FUNDAMENTAL.md UI subsystem
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { Profile } from '../core/profile';
import { loadState, saveState } from '../persistence/storage';
import { renderHeader } from './header';
import { renderDashboard } from './dashboard';
import { QuestionController } from '../question/question';
import { Theme, initTheme, toggleTheme } from './theme';
import { initAudio, playSound } from './audio';

export type ViewMode = 'dashboard' | 'question' | 'attestation' | 'results';

export interface UIState {
  currentView: ViewMode;
  currentUnit?: string;
  currentTopic?: string;
  currentQuestion?: string;
  profile: Profile;
  blockchain: EnhancedBlockchain;
  theme: Theme;
  audioEnabled: boolean;
  examDate: Date;
}

class UIController {
  private state: UIState;
  private container: HTMLElement;
  private headerEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private questionController: QuestionController | null = null;

  constructor() {
    // Load persisted state or create new
    const savedState = loadState();
    
    this.state = {
      currentView: 'dashboard',
      profile: savedState?.profile || new Profile(),
      blockchain: savedState?.blockchain || new EnhancedBlockchain(),
      theme: { name: 'light', colors: {} },
      audioEnabled: true,
      examDate: new Date('2025-05-05') // AP exam date
    };

    // Initialize container
    this.container = document.getElementById('app') || document.body;
    this.container.className = 'ui-container';
  }

  /**
   * Initialize the UI
   */
  async init(): Promise<void> {
    // Clear container
    this.container.innerHTML = '';

    // Initialize theme and audio
    await initTheme(this.state.theme);
    await initAudio(this.state.audioEnabled);

    // Create main layout
    this.createLayout();

    // Render initial view
    await this.switchView('dashboard');

    // Set up auto-save
    this.setupAutoSave();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Create the main layout structure
   */
  private createLayout(): void {
    // Create header
    this.headerEl = document.createElement('div');
    this.headerEl.id = 'header';
    this.headerEl.className = 'ui-header';
    this.container.appendChild(this.headerEl);

    // Create content area
    this.contentEl = document.createElement('div');
    this.contentEl.id = 'content';
    this.contentEl.className = 'ui-content';
    this.container.appendChild(this.contentEl);

    // Render header
    this.updateHeader();
  }

  /**
   * Update header with current state
   */
  private updateHeader(): void {
    if (!this.headerEl) return;

    const headerContent = renderHeader({
      username: this.state.profile.username,
      reputationScore: this.state.profile.reputationScore,
      currentUnit: this.state.currentUnit,
      examDate: this.state.examDate,
      onUnitChange: (unitId) => this.handleUnitChange(unitId),
      onThemeToggle: () => this.handleThemeToggle(),
      onAudioToggle: () => this.handleAudioToggle()
    });

    this.headerEl.innerHTML = '';
    this.headerEl.appendChild(headerContent);
  }

  /**
   * Switch between views
   */
  async switchView(view: ViewMode, params?: any): Promise<void> {
    if (!this.contentEl) return;

    // Update state
    this.state.currentView = view;

    // Clear content
    this.contentEl.innerHTML = '';
    this.contentEl.className = `ui-content view-${view}`;

    // Render view
    switch (view) {
      case 'dashboard':
        await this.renderDashboardView();
        break;
      case 'question':
        await this.renderQuestionView(params);
        break;
      case 'attestation':
        await this.renderAttestationView(params);
        break;
      case 'results':
        await this.renderResultsView(params);
        break;
    }

    // Play transition sound
    if (this.state.audioEnabled) {
      playSound('transition');
    }

    // Update header
    this.updateHeader();
  }

  /**
   * Render dashboard view
   */
  private async renderDashboardView(): Promise<void> {
    if (!this.contentEl) return;

    const dashboard = await renderDashboard({
      profile: this.state.profile,
      blockchain: this.state.blockchain,
      onTopicSelect: (unitId, topicId) => this.handleTopicSelect(unitId, topicId),
      onQuestionSelect: (questionId) => this.handleQuestionSelect(questionId)
    });

    this.contentEl.appendChild(dashboard);
  }

  /**
   * Render question view
   */
  private async renderQuestionView(params?: any): Promise<void> {
    if (!this.contentEl) return;

    // Create question controller if needed
    if (!this.questionController) {
      this.questionController = new QuestionController(
        this.state.blockchain,
        this.state.profile
      );
    }

    // Render question
    const questionEl = await this.questionController.renderQuestion(
      params?.questionId || this.state.currentQuestion,
      {
        mode: 'blind',
        onSubmit: (answer) => this.handleAnswerSubmit(answer),
        onSkip: () => this.handleQuestionSkip()
      }
    );

    this.contentEl.appendChild(questionEl);
  }

  /**
   * Render attestation view
   */
  private async renderAttestationView(params?: any): Promise<void> {
    if (!this.contentEl || !this.questionController) return;

    const attestationEl = await this.questionController.renderAttestation(
      params?.questionId,
      params?.mode || 'blind',
      {
        onReveal: () => this.handleAttestationReveal(),
        onNext: () => this.handleNextQuestion()
      }
    );

    this.contentEl.appendChild(attestationEl);
  }

  /**
   * Render results view
   */
  private async renderResultsView(params?: any): Promise<void> {
    if (!this.contentEl) return;

    // TODO: Implement results view
    const resultsEl = document.createElement('div');
    resultsEl.className = 'results-view';
    resultsEl.innerHTML = '<h2>Results</h2><p>Coming soon...</p>';
    this.contentEl.appendChild(resultsEl);
  }

  /**
   * Handle unit change from header
   */
  private handleUnitChange(unitId: string): void {
    this.state.currentUnit = unitId;
    this.switchView('dashboard');
  }

  /**
   * Handle topic selection
   */
  private handleTopicSelect(unitId: string, topicId: string): void {
    this.state.currentUnit = unitId;
    this.state.currentTopic = topicId;
    // Load first question of topic
    this.switchView('question', { topicId });
  }

  /**
   * Handle question selection
   */
  private handleQuestionSelect(questionId: string): void {
    this.state.currentQuestion = questionId;
    this.switchView('question', { questionId });
  }

  /**
   * Handle answer submission
   */
  private async handleAnswerSubmit(answer: any): Promise<void> {
    if (!this.questionController) return;

    // Create attestation transaction
    const success = await this.questionController.submitAttestation(
      this.state.currentQuestion!,
      answer
    );

    if (success) {
      // Switch to attestation view
      await this.switchView('attestation', {
        questionId: this.state.currentQuestion,
        mode: 'blind'
      });

      // Play success sound
      if (this.state.audioEnabled) {
        playSound('submit');
      }
    }
  }

  /**
   * Handle question skip
   */
  private handleQuestionSkip(): void {
    this.handleNextQuestion();
  }

  /**
   * Handle attestation reveal
   */
  private async handleAttestationReveal(): Promise<void> {
    await this.switchView('attestation', {
      questionId: this.state.currentQuestion,
      mode: 'reveal'
    });
  }

  /**
   * Handle next question
   */
  private handleNextQuestion(): void {
    // TODO: Get next question from curriculum
    this.switchView('dashboard');
  }

  /**
   * Handle theme toggle
   */
  private handleThemeToggle(): void {
    this.state.theme = toggleTheme();
    this.updateHeader();
  }

  /**
   * Handle audio toggle
   */
  private handleAudioToggle(): void {
    this.state.audioEnabled = !this.state.audioEnabled;
    this.updateHeader();
  }

  /**
   * Set up auto-save
   */
  private setupAutoSave(): void {
    setInterval(() => {
      saveState({
        profile: this.state.profile,
        blockchain: this.state.blockchain
      });
    }, 30000); // Save every 30 seconds
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K: Quick navigation
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // TODO: Show command palette
      }

      // Escape: Go back to dashboard
      if (e.key === 'Escape' && this.state.currentView !== 'dashboard') {
        e.preventDefault();
        this.switchView('dashboard');
      }

      // T: Toggle theme
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        this.handleThemeToggle();
      }
    });
  }
}

// Export singleton instance
export const uiController = new UIController();

// Initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => uiController.init());
  } else {
    uiController.init();
  }
}