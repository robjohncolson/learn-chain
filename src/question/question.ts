/**
 * Question Controller - Phase 3
 * Manages question display, attestation submission, and consensus viewing
 * Wraps quiz_renderer functions with blockchain integration
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';
import { createTransaction } from '../core/blockchain';
import { hashMCQAnswer } from '../questions/hashing';
import { renderQuestion as renderQuizQuestion, renderChart } from '../quiz_renderer';
import { queueMathRendering, renderChoiceMath } from '../renderer/mathRenderer';
import { observeChart, renderConsensusDotplot } from '../ui/charts';
import { questionLoader } from '../questions/loader';
import type { Question, ConsensusData, RenderOptions, RenderCallbacks } from '../types';

export interface QuestionOptions {
  mode: 'blind' | 'reveal';
  onSubmit?: (answer: any) => void;
  onSkip?: () => void;
  onReveal?: () => void;
  onNext?: () => void;
}

export interface AttestationState {
  questionId: string;
  userAnswer?: string | string[];
  answerHash?: string;
  submitted: boolean;
  consensusData?: ConsensusData;
  revealMode: boolean;
}

// Define Profile interface locally to avoid import issues
interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
  reputationScore?: number;
}

export class QuestionController {
  private blockchain: EnhancedBlockchain;
  private profile: Profile;
  private currentState: AttestationState | null = null;
  private consensusSubscription: any = null;

  constructor(blockchain: EnhancedBlockchain, profile: Profile) {
    this.blockchain = blockchain;
    this.profile = profile;
  }

  /**
   * Render a question with attestation controls
   */
  async renderQuestion(
    questionId: string,
    options: QuestionOptions
  ): Promise<HTMLElement> {
    // Load question data
    const question = await this.loadQuestion(questionId);
    if (!question) {
      return this.renderError('Question not found');
    }

    // Initialize state
    this.currentState = {
      questionId,
      submitted: false,
      revealMode: options.mode === 'reveal'
    };

    // Create container
    const container = document.createElement('div');
    container.className = 'question-container';

    // Add video if present
    if (question.attachments?.video) {
      const videoEl = this.renderVideo(question.attachments.video);
      container.appendChild(videoEl);
    }

    // Render question using quiz_renderer
    const questionEl = this.renderQuestionElement(question, options);
    container.appendChild(questionEl);

    // Add attestation controls
    const controlsEl = this.renderControls(options);
    container.appendChild(controlsEl);

    // Check for existing consensus
    await this.checkExistingConsensus(questionId);

    // Subscribe to consensus updates
    this.subscribeToConsensus(questionId);

    // Initialize MathJax with proper queue
    if (question.text?.includes('$') || question.text?.includes('\\(')) {
      // Use proper math rendering queue
      queueMathRendering(container, 2);
      
      // Also queue math for any choices
      const choicesEl = container.querySelector('.choices');
      if (choicesEl) {
        renderChoiceMath(choicesEl as HTMLElement);
      }
    }

    // Add styles
    this.addStyles(container);

    return container;
  }

  /**
   * Render attestation view (blind or reveal mode)
   */
  async renderAttestation(
    questionId: string,
    mode: 'blind' | 'reveal',
    options: {
      onReveal?: () => void;
      onNext?: () => void;
    }
  ): Promise<HTMLElement> {
    if (!this.currentState || this.currentState.questionId !== questionId) {
      return this.renderError('No attestation state found');
    }

    const container = document.createElement('div');
    container.className = `attestation-container mode-${mode}`;

    if (mode === 'blind') {
      container.appendChild(this.renderBlindAttestation(options));
    } else {
      container.appendChild(await this.renderRevealAttestation(options));
    }

    this.addAttestationStyles(container);
    return container;
  }

  /**
   * Submit attestation to blockchain
   */
  async submitAttestation(questionId: string, answer: any): Promise<boolean> {
    try {
      // Validate answer
      if (!answer || (Array.isArray(answer) && answer.length === 0)) {
        throw new Error('No answer provided');
      }

      // Get question to determine type
      const question = await this.loadQuestion(questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      // Prepare attestation data
      const isMCQ = question.type === 'multiple-choice';
      const attestationData: any = {
        questionId,
        timestamp: Date.now(),
        confidence: this.getConfidenceLevel(answer)
      };

      if (isMCQ) {
        // Hash MCQ answer
        attestationData.answerHash = hashMCQAnswer(answer);
        attestationData.answerText = null;
      } else {
        // Store FRQ answer directly
        attestationData.answerText = answer;
        attestationData.score = null; // Will be set by peer review
      }

      // Create transaction
      const transaction = createTransaction(
        'Attestation',
        attestationData,
        this.profile.pubkey,
        this.profile.privkey
      );

      // Submit to blockchain
      const success = await this.blockchain.addTransaction(transaction);

      if (success) {
        // Update state
        if (this.currentState) {
          this.currentState.submitted = true;
          this.currentState.userAnswer = answer;
          if (isMCQ) {
            this.currentState.answerHash = attestationData.answerHash;
          }
        }

        // Update reputation
        await this.updateReputation();
      }

      return success;
    } catch (error) {
      console.error('Failed to submit attestation:', error);
      return false;
    }
  }

  /**
   * Load question data
   */
  private async loadQuestion(questionId: string): Promise<Question | null> {
    return await questionLoader.getQuestion(questionId);
  }

  /**
   * Render video attachment
   */
  private renderVideo(videoUrl: string): HTMLElement {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    
    // Check if it's a YouTube/AP Classroom URL
    if (videoUrl.includes('youtube.com') || videoUrl.includes('apclassroom.collegeboard.org')) {
      const iframe = document.createElement('iframe');
      iframe.src = videoUrl;
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      videoContainer.appendChild(iframe);
    } else {
      // Regular video element
      const video = document.createElement('video');
      video.src = videoUrl;
      video.controls = true;
      video.width = '100%';
      videoContainer.appendChild(video);
    }

    return videoContainer;
  }

  /**
   * Render question element using quiz_renderer
   */
  private renderQuestionElement(question: Question, options: QuestionOptions): HTMLElement {
    const questionEl = document.createElement('div');
    questionEl.className = 'question-element';

    // Use quiz_renderer with custom callbacks
    const renderOptions: RenderOptions = {
      mode: options.mode,
      singleQuestion: true,
      callbacks: {
        onSubmit: (answer: any) => {
          if (options.onSubmit) {
            options.onSubmit(answer);
          }
        },
        onSkip: options.onSkip
      } as RenderCallbacks
    };

    // Render using quiz_renderer
    const rendered = renderQuizQuestion(question, 0, renderOptions);
    if (typeof rendered === 'string') {
      questionEl.innerHTML = rendered;
    } else {
      questionEl.appendChild(rendered);
    }

    return questionEl;
  }

  /**
   * Render control buttons
   */
  private renderControls(options: QuestionOptions): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'question-controls';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Submit Attestation';
    submitBtn.onclick = () => {
      const answer = this.collectAnswer();
      if (answer && options.onSubmit) {
        options.onSubmit(answer);
      }
    };

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-secondary';
    skipBtn.textContent = 'Skip';
    skipBtn.onclick = () => {
      if (options.onSkip) {
        options.onSkip();
      }
    };

    controls.appendChild(submitBtn);
    controls.appendChild(skipBtn);

    return controls;
  }

  /**
   * Collect answer from form inputs
   */
  private collectAnswer(): any {
    const container = document.querySelector('.question-container');
    if (!container) return null;

    // Check for MCQ
    const checkedRadio = container.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    if (checkedRadio) {
      return checkedRadio.value;
    }

    // Check for FRQ
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      return textarea.value.trim();
    }

    return null;
  }

  /**
   * Render blind attestation view
   */
  private renderBlindAttestation(options: any): HTMLElement {
    const blindView = document.createElement('div');
    blindView.className = 'blind-attestation';

    blindView.innerHTML = `
      <div class="attestation-status">
        <div class="status-icon">⏳</div>
        <h2>Attestation Submitted</h2>
        <p>Your answer has been recorded on the blockchain.</p>
        <p class="waiting-text">Waiting for consensus to form...</p>
      </div>
      
      <div class="your-answer">
        <h3>Your Answer:</h3>
        <div class="answer-display">
          ${this.formatAnswer(this.currentState?.userAnswer)}
        </div>
      </div>
      
      <div class="consensus-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.getConsensusProgress()}%"></div>
        </div>
        <p class="progress-text">${this.getConsensusProgress()}% consensus</p>
      </div>
    `;

    // Add reveal button if consensus reached
    if (this.getConsensusProgress() >= 50) {
      const revealBtn = document.createElement('button');
      revealBtn.className = 'btn btn-reveal';
      revealBtn.textContent = 'Reveal Consensus';
      revealBtn.onclick = options.onReveal;
      blindView.appendChild(revealBtn);
    }

    return blindView;
  }

  /**
   * Render reveal attestation view
   */
  private async renderRevealAttestation(options: any): Promise<HTMLElement> {
    const revealView = document.createElement('div');
    revealView.className = 'reveal-attestation';

    const consensusData = this.currentState?.consensusData;
    if (!consensusData) {
      revealView.innerHTML = '<p>Loading consensus data...</p>';
      return revealView;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'reveal-header';
    header.innerHTML = `
      <h2>Consensus Reached!</h2>
      <p>Convergence: ${Math.round(consensusData.convergence * 100)}%</p>
    `;
    revealView.appendChild(header);

    // Distribution chart
    const chartContainer = document.createElement('div');
    chartContainer.className = 'distribution-chart';
    chartContainer.innerHTML = '<canvas id="consensus-chart"></canvas>';
    revealView.appendChild(chartContainer);

    // Render chart after DOM update
    setTimeout(() => {
      this.renderDistributionChart(consensusData);
    }, 100);

    // Your answer vs consensus
    const comparison = document.createElement('div');
    comparison.className = 'answer-comparison';
    comparison.innerHTML = `
      <div class="comparison-item your-answer">
        <h3>Your Answer</h3>
        <div>${this.formatAnswer(this.currentState?.userAnswer)}</div>
        ${this.isConsensusMatch() ? '<span class="match-badge">✓ Matches Consensus</span>' : ''}
      </div>
      <div class="comparison-item consensus-answer">
        <h3>Consensus Answer</h3>
        <div>${this.formatConsensusAnswer(consensusData)}</div>
      </div>
    `;
    revealView.appendChild(comparison);

    // FRQ peer answers (if applicable)
    if (consensusData.type === 'frq' && consensusData.frq?.peerAnswers) {
      const peersSection = document.createElement('div');
      peersSection.className = 'peer-answers';
      peersSection.innerHTML = '<h3>Peer Responses</h3>';
      
      consensusData.frq.peerAnswers.slice(0, 3).forEach((peer: any) => {
        const peerEl = document.createElement('div');
        peerEl.className = 'peer-answer';
        peerEl.innerHTML = `
          <div class="peer-score">Score: ${peer.score}/5</div>
          <div class="peer-text">${peer.text}</div>
        `;
        peersSection.appendChild(peerEl);
      });
      
      revealView.appendChild(peersSection);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-next';
    nextBtn.textContent = 'Next Question';
    nextBtn.onclick = options.onNext;
    revealView.appendChild(nextBtn);

    return revealView;
  }

  /**
   * Render distribution chart
   */
  private renderDistributionChart(consensusData: ConsensusData): void {
    const canvasId = 'consensus-chart';
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    // Use new consensus dotplot renderer for better visualization
    renderConsensusDotplot(consensusData, canvasId);
  }

  /**
   * Calculate score histogram for FRQ
   */
  private calculateScoreHistogram(scores: number[]): number[] {
    const histogram = [0, 0, 0, 0, 0];
    scores.forEach(score => {
      const index = Math.min(Math.max(Math.floor(score) - 1, 0), 4);
      histogram[index]++;
    });
    return histogram;
  }

  /**
   * Check existing consensus
   */
  private async checkExistingConsensus(questionId: string): Promise<void> {
    const consensus = this.blockchain.getConsensusForQuestion(questionId);
    if (consensus && this.currentState) {
      this.currentState.consensusData = consensus;
    }
  }

  /**
   * Subscribe to consensus updates
   */
  private subscribeToConsensus(questionId: string): void {
    // Set up polling for consensus updates
    this.consensusSubscription = setInterval(() => {
      const consensus = this.blockchain.getConsensusForQuestion(questionId);
      if (consensus && this.currentState) {
        const prevConvergence = this.currentState.consensusData?.convergence || 0;
        this.currentState.consensusData = consensus;
        
        // Notify if consensus reached threshold
        if (prevConvergence < 0.5 && consensus.convergence >= 0.5) {
          this.onConsensusReached();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Handle consensus reached
   */
  private onConsensusReached(): void {
    // Play notification sound
    const audio = new Audio('/assets/sounds/consensus.mp3');
    audio.play().catch(() => {});
    
    // Update UI
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
      progressText.textContent = 'Consensus reached! You can now reveal the results.';
    }
  }

  /**
   * Get confidence level for answer
   */
  private getConfidenceLevel(answer: any): number {
    // TODO: Add UI for confidence selection
    return 3; // Default medium confidence
  }

  /**
   * Update user reputation
   */
  private async updateReputation(): Promise<void> {
    // Reputation update will be handled by blockchain consensus
    const newScore = await this.blockchain.getUserReputation(this.profile.pubkey);
    this.profile.reputationScore = newScore;
  }

  /**
   * Get consensus progress percentage
   */
  private getConsensusProgress(): number {
    if (!this.currentState?.consensusData) return 0;
    return Math.round(this.currentState.consensusData.convergence * 100);
  }

  /**
   * Format answer for display
   */
  private formatAnswer(answer: any): string {
    if (!answer) return 'No answer';
    if (Array.isArray(answer)) return answer.join(', ');
    return String(answer);
  }

  /**
   * Format consensus answer
   */
  private formatConsensusAnswer(consensusData: ConsensusData): string {
    if (consensusData.type === 'mcq' && consensusData.mcq) {
      // Find most selected choice
      const distribution = consensusData.mcq.distribution;
      const topChoice = Object.entries(distribution)
        .sort(([,a], [,b]) => b - a)[0];
      return topChoice ? `Choice ${topChoice[0]} (${topChoice[1]} votes)` : 'No consensus';
    } else if (consensusData.type === 'frq' && consensusData.frq) {
      const mean = consensusData.frq.mean.toFixed(1);
      return `Mean score: ${mean}/5`;
    }
    return 'Unknown';
  }

  /**
   * Check if user answer matches consensus
   */
  private isConsensusMatch(): boolean {
    if (!this.currentState?.consensusData || !this.currentState.userAnswer) return false;
    
    if (this.currentState.consensusData.type === 'mcq') {
      const distribution = this.currentState.consensusData.mcq?.distribution || {};
      const topChoice = Object.entries(distribution)
        .sort(([,a], [,b]) => b - a)[0];
      return topChoice && topChoice[0] === this.currentState.userAnswer;
    }
    
    // FRQ doesn't have exact match, check if within 1 point of mean
    if (this.currentState.consensusData.type === 'frq') {
      // TODO: Get user's score from blockchain
      return true;
    }
    
    return false;
  }

  /**
   * Render error message
   */
  private renderError(message: string): HTMLElement {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    return error;
  }

  /**
   * Add styles
   */
  private addStyles(container: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .question-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .video-container {
        margin-bottom: 2rem;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .question-element {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
      }
      
      .question-controls {
        display: flex;
        gap: 1rem;
        justify-content: center;
      }
      
      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      
      .btn-secondary {
        background: #e0e0e0;
        color: #333;
      }
      
      .btn-secondary:hover {
        background: #d0d0d0;
      }
    `;
    container.appendChild(style);
  }

  /**
   * Add attestation styles
   */
  private addAttestationStyles(container: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .attestation-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .blind-attestation,
      .reveal-attestation {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      }
      
      .attestation-status {
        text-align: center;
        margin-bottom: 2rem;
      }
      
      .status-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .waiting-text {
        color: #666;
        font-style: italic;
      }
      
      .your-answer {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 8px;
        margin: 2rem 0;
      }
      
      .answer-display {
        font-size: 1.1rem;
        margin-top: 0.5rem;
      }
      
      .consensus-progress {
        margin: 2rem 0;
      }
      
      .progress-bar {
        height: 30px;
        background: #e0e0e0;
        border-radius: 15px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        transition: width 0.5s ease;
      }
      
      .progress-text {
        text-align: center;
        margin-top: 0.5rem;
        color: #666;
      }
      
      .btn-reveal {
        display: block;
        margin: 2rem auto 0;
        background: linear-gradient(135deg, #4CAF50, #8BC34A);
      }
      
      .reveal-header {
        text-align: center;
        margin-bottom: 2rem;
      }
      
      .distribution-chart {
        margin: 2rem 0;
        padding: 1rem;
        background: #f9f9f9;
        border-radius: 8px;
      }
      
      .answer-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin: 2rem 0;
      }
      
      .comparison-item {
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 8px;
      }
      
      .match-badge {
        display: inline-block;
        background: #4CAF50;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
        margin-top: 0.5rem;
      }
      
      .peer-answers {
        margin: 2rem 0;
      }
      
      .peer-answer {
        background: #f9f9f9;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
      }
      
      .peer-score {
        font-weight: 600;
        color: #667eea;
        margin-bottom: 0.5rem;
      }
      
      .btn-next {
        display: block;
        margin: 2rem auto 0;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }
    `;
    container.appendChild(style);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.consensusSubscription) {
      clearInterval(this.consensusSubscription);
      this.consensusSubscription = null;
    }
    this.currentState = null;
  }
}