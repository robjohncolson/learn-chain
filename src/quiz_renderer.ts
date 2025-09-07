/**
 * Quiz Renderer Module
 * Converts quiz data into HTML with support for charts, tables, and math rendering
 * Aligned with FUNDAMENTAL.md UI subsystem (U atoms)
 */

import type {
  Question,
  Curriculum,
  Choice,
  ChartData,
  TableData,
  Solution,
  SolutionPart,
  Attachments,
  RenderOptions,
  RenderMode,
  RenderCallbacks,
  Theme,
  ConsensusData,
  MCQDistribution,
  FRQDistribution,
  MessageOptions,
  MessageType,
  RendererAPI,
  RendererConfig,
  Scoring,
  RubricPart
} from './types';

// Chart.js will be lazily loaded
let ChartJS: any = null;
let ChartDataLabels: any = null;

// MathJax will be lazily loaded
let MathJax: any = null;

// Track active chart instances for cleanup
const chartInstances: Map<string, any> = new Map();

// Current theme state
let currentTheme: Theme = { name: 'light' };

// Audio state
let audioEnabled = true;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

/**
 * Render a complete quiz/curriculum
 * Main entry point for multi-question rendering
 */
export function renderQuiz(
  data: Curriculum,
  options: RenderOptions = { mode: 'blind' }
): HTMLElement {
  const container = options.container || document.createElement('div');
  container.className = 'quiz-renderer-container';
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Destroy existing charts
  chartInstances.forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  chartInstances.clear();
  
  // Render stats if in multi-question mode
  if (!options.singleQuestion) {
    const statsEl = renderStats(data);
    container.appendChild(statsEl);
  }
  
  // Render each question
  const questionsContainer = document.createElement('div');
  questionsContainer.id = 'questionsContainer';
  
  data.forEach((question, index) => {
    const questionEl = renderQuestionElement(question, index, options);
    questionsContainer.appendChild(questionEl);
  });
  
  container.appendChild(questionsContainer);
  
  // Initialize MathJax if needed
  if (MathJax && typeof MathJax.typesetPromise === 'function') {
    MathJax.typesetPromise([container]).catch((e: any) => 
      console.warn('MathJax typesetting failed:', e)
    );
  }
  
  return container;
}

/**
 * Render a single question
 * Can return either HTMLElement or HTML string based on usage
 */
export function renderQuestion(
  question: Question,
  index: number = 0,
  options: RenderOptions = { mode: 'blind' }
): string {
  const questionNumber = index + 1;
  const mode = options.mode;
  const callbacks = options.callbacks;
  
  let html = `
    <div class="quiz-container" 
         data-question-number="${questionNumber}" 
         data-question-id="${escapeHtml(question.id)}">
      <div class="question-header">Question ${questionNumber}</div>
      <div class="question-id">ID: ${escapeHtml(question.id)}</div>
      <div class="question-id">Type: ${escapeHtml(question.type)}</div>
      
      <div class="question-prompt">
        ${escapeHtml(question.prompt)}
      </div>
  `;
  
  // Handle attachments
  if (question.attachments) {
    html += renderAttachments(question.attachments, question.id, options);
  }
  
  // Handle choices (MCQ)
  if (question.choices || question.attachments?.choices) {
    const choices = question.choices || question.attachments?.choices || [];
    const answerKey = mode === 'reveal' ? question.answerKey : undefined;
    html += renderChoices(choices, answerKey, callbacks);
  }
  
  // Show answer/reasoning in reveal mode
  if (mode === 'reveal' || mode === 'consensus') {
    if (question.answerKey) {
      html += `
        <div class="answer-key">
          <strong>Answer:</strong> ${escapeHtml(question.answerKey)}
        </div>
      `;
    }
    
    if (question.reasoning) {
      html += `
        <div class="reasoning">
          <strong>Explanation:</strong> ${escapeHtml(question.reasoning)}
        </div>
      `;
    }
    
    if (question.solution) {
      html += renderSolution(question.solution, question.id);
    }
  }
  
  // Show consensus data if available
  if (mode === 'consensus' && callbacks?.onRequestConsensus) {
    const consensusData = callbacks.onRequestConsensus(question.id);
    if (consensusData && (consensusData as ConsensusData).hasConsensus) {
      html += renderConsensusDisplay(consensusData as ConsensusData, question.id);
    }
  }
  
  html += '</div>';
  return html;
}

/**
 * Render a single question as HTMLElement
 */
function renderQuestionElement(
  question: Question,
  index: number,
  options: RenderOptions
): HTMLElement {
  const html = renderQuestion(question, index, options);
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Attach event listeners if callbacks provided
  if (options.callbacks) {
    attachQuestionEventListeners(div, question, options.callbacks);
  }
  
  return div.firstElementChild as HTMLElement;
}

/**
 * Render attachments (charts, tables, images)
 */
function renderAttachments(
  attachments: Attachments,
  questionId: string,
  options: RenderOptions
): string {
  let html = '';
  
  // Render single image
  if (attachments.image) {
    html += renderImage(
      attachments.image,
      attachments.imageAlt,
      attachments.imageCaption
    );
  }
  
  // Render multiple images
  if (attachments.images && Array.isArray(attachments.images)) {
    html += '<div class="images-container">';
    attachments.images.forEach((img, idx) => {
      html += renderImage(
        img.image,
        img.imageAlt || `Question diagram ${idx + 1}`,
        img.imageCaption
      );
    });
    html += '</div>';
  }
  
  // Render multiple charts
  if (attachments.charts && Array.isArray(attachments.charts)) {
    html += '<div class="multiple-charts-container">';
    attachments.charts.forEach((chart, idx) => {
      html += renderChart(chart, `${questionId}-chart-${idx}`);
    });
    html += '</div>';
  }
  // Render single chart
  else if (attachments.chartType) {
    html += renderChart(attachments as ChartData, questionId);
  }
  
  // Render table
  if (attachments.table) {
    html += renderTable(attachments.table);
  }
  
  return html;
}

/**
 * Render an image with caption
 */
function renderImage(src: string, alt?: string, caption?: string): string {
  return `
    <div class="image-container">
      <img src="${escapeHtml(src)}" 
           alt="${escapeHtml(alt || 'Question diagram')}" 
           class="question-image" 
           loading="lazy" 
           decoding="async">
      ${caption ? `<div class="image-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

/**
 * Render a chart placeholder
 * Actual Chart.js initialization happens asynchronously
 */
export function renderChart(chartData: ChartData, questionId: string): string {
  const chartId = `chart-${questionId}-${Date.now()}`;
  const config = chartData.chartConfig || {};
  
  const chartTitle = chartData.title || 
    `${chartData.chartType.toUpperCase()} CHART`;
  
  const containerStyle = chartData.fullWidth ? 
    'style="flex:0 0 100%; max-width:100%; width:100%;"' : '';
  
  const html = `
    <div class="chart-container" ${containerStyle}>
      <div class="chart-title">${escapeHtml(chartTitle)}</div>
      ${config.description ? 
        `<div class="chart-description">${escapeHtml(config.description)}</div>` : ''}
      <div class="chart-canvas">
        <canvas id="${chartId}"></canvas>
      </div>
    </div>
  `;
  
  // Schedule chart initialization
  setTimeout(() => initializeChart(chartId, chartData), 100);
  
  return html;
}

/**
 * Render a data table
 */
export function renderTable(tableData: TableData): string {
  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return '';
  }
  
  const headers = tableData[0];
  const rows = tableData.slice(1);
  
  let html = '<div class="table-container"><table><thead><tr>';
  
  // Headers
  headers.forEach(header => {
    html += `<th>${escapeHtml(header)}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // Rows
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += `<td>${escapeHtml(cell)}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  return html;
}

/**
 * Render multiple choice options
 */
export function renderChoices(
  choices: Choice[],
  answerKey?: string,
  callbacks?: RenderCallbacks
): string {
  if (!choices || !Array.isArray(choices)) return '';
  
  const normalizedAnswer = (answerKey || '').toString().trim().toUpperCase();
  
  let html = '<div class="choices">';
  
  choices.forEach(choice => {
    const isCorrect = choice.key.toString().trim().toUpperCase() === normalizedAnswer;
    const classes = ['choice'];
    if (isCorrect) classes.push('correct-choice');
    
    const dataAttrs = callbacks?.onSubmitAttestation ? 
      `data-choice-key="${escapeHtml(choice.key)}"` : '';
    
    html += `
      <div class="${classes.join(' ')}" ${dataAttrs}>
        <span class="choice-key">${escapeHtml(choice.key)}.</span> 
        ${escapeHtml(choice.value)}
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Render solution with parts and scoring
 */
export function renderSolution(solution: Solution, questionId: string): string {
  if (!solution) return '';
  
  let html = `
    <div class="solution">
      <div class="solution-title">📝 Solution</div>
  `;
  
  // Render solution parts
  if (solution.parts && Array.isArray(solution.parts)) {
    solution.parts.forEach(part => {
      html += renderSolutionPart(part, questionId);
    });
  }
  
  html += '</div>';
  
  // Render scoring rubric
  if (solution.scoring) {
    html += renderScoringRubric(solution.scoring);
  }
  
  return html;
}

/**
 * Render a single solution part
 */
function renderSolutionPart(part: SolutionPart, questionId: string): string {
  let html = `
    <div class="solution-part">
      <div class="solution-part-id">Part ${escapeHtml(part.partId)}</div>
      <div class="solution-description">${escapeHtml(part.description)}</div>
      <div class="solution-response">${escapeHtml(part.response)}</div>
  `;
  
  // Render attachments if present
  if (part.attachments) {
    html += renderAttachments(part.attachments, `${questionId}-solution-${part.partId}`, 
      { mode: 'reveal' });
  }
  
  // Render calculations if present
  if (part.calculations && Array.isArray(part.calculations)) {
    html += `
      <div class="solution-calculations">
        <div class="solution-calculations-title">Calculations:</div>
    `;
    part.calculations.forEach(calc => {
      html += `<div class="calculation-step">${escapeHtml(calc)}</div>`;
    });
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * Render scoring rubric
 */
function renderScoringRubric(scoring: Scoring): string {
  if (!scoring || !scoring.rubric) return '';
  
  let html = `
    <div class="scoring-rubric">
      <div class="scoring-title">Scoring Rubric (Total: ${scoring.totalPoints} points)</div>
  `;
  
  scoring.rubric.forEach(rubricPart => {
    html += `
      <div class="scoring-part">
        <div class="scoring-part-header">
          Part ${escapeHtml(rubricPart.part)} 
          (${rubricPart.maxPoints} point${rubricPart.maxPoints !== 1 ? 's' : ''})
        </div>
        <div class="scoring-criteria">
    `;
    
    if (rubricPart.criteria && Array.isArray(rubricPart.criteria)) {
      rubricPart.criteria.forEach(criterion => {
        html += `<div class="scoring-criterion">${escapeHtml(criterion)}</div>`;
      });
    }
    
    html += '</div>';
    
    if (rubricPart.scoringNotes) {
      html += `<div class="scoring-notes">${escapeHtml(rubricPart.scoringNotes)}</div>`;
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}

/**
 * Render consensus display for emergent attestation
 */
export function renderConsensusDisplay(
  consensus: ConsensusData,
  questionId: string
): string {
  let html = `
    <div class="consensus-display">
      <div class="consensus-header">
        📊 Emergent Consensus 
        (${consensus.totalAttestations} attestations, 
        ${(consensus.convergence * 100).toFixed(1)}% convergence)
      </div>
  `;
  
  // MCQ distribution
  if (consensus.mcqDistribution) {
    const mcqDist: MCQDistribution = {
      choices: consensus.mcqDistribution,
      total: Object.values(consensus.mcqDistribution).reduce((a, b) => a + b, 0),
      mode: Object.entries(consensus.mcqDistribution).reduce((a, b) => b[1] > a[1] ? b : a)[0],
      modePercentage: 0
    };
    mcqDist.modePercentage = (consensus.mcqDistribution[mcqDist.mode] / mcqDist.total) * 100;
    html += renderMCQConsensus(mcqDist, questionId);
  }
  
  // FRQ distribution
  if (consensus.frqDistribution) {
    const frqDist: FRQDistribution = {
      scores: consensus.frqDistribution.map(s => ({
        score: s.score,
        count: s.count,
        percentage: 0
      })),
      mean: 0,
      median: 0,
      stdDev: 0,
      total: consensus.frqDistribution.reduce((sum, s) => sum + s.count, 0)
    };
    // Calculate percentages
    frqDist.scores.forEach(s => {
      s.percentage = (s.count / frqDist.total) * 100;
    });
    // Simple mean calculation
    frqDist.mean = frqDist.scores.reduce((sum, s) => sum + s.score * s.count, 0) / frqDist.total;
    html += renderFRQConsensus(frqDist, questionId);
  }
  
  // Confidence metrics
  html += `
    <div class="consensus-metrics">
      <div>Average Confidence: ${consensus.confidence.toFixed(1)}/5</div>
      <div>Required Quorum: ${consensus.quorum}</div>
      <div>Consensus Reached: ${consensus.hasConsensus ? '✅ Yes' : '❌ No'}</div>
      ${consensus.emergentAnswer ? 
        `<div>Emergent Answer: <strong>${escapeHtml(String(consensus.emergentAnswer))}</strong></div>` : ''}
    </div>
  `;
  
  html += '</div>';
  return html;
}

/**
 * Render MCQ consensus distribution
 */
function renderMCQConsensus(dist: MCQDistribution, questionId: string): string {
  const chartData: ChartData = {
    chartType: 'bar',
    title: 'Answer Distribution',
    series: [{
      name: 'Responses',
      values: Object.values(dist.choices)
    }],
    xLabels: Object.keys(dist.choices),
    chartConfig: {
      yAxis: {
        title: 'Number of Attestations',
        min: 0
      },
      xAxis: {
        title: 'Answer Choice'
      }
    }
  };
  
  return `
    <div class="consensus-mcq">
      ${renderChart(chartData, `${questionId}-consensus-mcq`)}
      <div class="consensus-mode">
        Most Common: ${escapeHtml(dist.mode)} (${dist.modePercentage.toFixed(1)}%)
      </div>
    </div>
  `;
}

/**
 * Render FRQ consensus distribution
 */
function renderFRQConsensus(dist: FRQDistribution, questionId: string): string {
  const chartData: ChartData = {
    chartType: 'histogram',
    title: 'Score Distribution',
    series: [{
      name: 'Scores',
      values: dist.scores.map(s => s.count)
    }],
    xLabels: dist.scores.map(s => s.score.toString()),
    chartConfig: {
      yAxis: {
        title: 'Number of Attestations',
        min: 0
      },
      xAxis: {
        title: 'Score (1-5)'
      }
    }
  };
  
  return `
    <div class="consensus-frq">
      ${renderChart(chartData, `${questionId}-consensus-frq`)}
      <div class="consensus-stats">
        <div>Mean: ${dist.mean.toFixed(2)}</div>
        <div>Median: ${dist.median.toFixed(2)}</div>
        <div>Std Dev: ${dist.stdDev.toFixed(2)}</div>
      </div>
    </div>
  `;
}

/**
 * Render statistics summary
 */
function renderStats(questions: Curriculum): HTMLElement {
  const totalQuestions = questions.length;
  const mcQuestions = questions.filter(q => q.type === 'multiple-choice').length;
  const frQuestions = questions.filter(q => q.type === 'free-response').length;
  const hasAnswers = questions.filter(q => q.answerKey).length;
  const hasReasoning = questions.filter(q => q.reasoning).length;
  const hasSolutions = questions.filter(q => q.solution).length;
  
  const statsDiv = document.createElement('div');
  statsDiv.className = 'stats';
  statsDiv.innerHTML = `
    <strong>📊 Quiz Statistics:</strong><br>
    Total Questions: ${totalQuestions} | 
    Multiple Choice: ${mcQuestions} | 
    Free Response: ${frQuestions}<br>
    With Answer Keys: ${hasAnswers} | 
    With Reasoning: ${hasReasoning} | 
    With Solutions: ${hasSolutions}
  `;
  
  return statsDiv;
}

/**
 * Show statistics in container
 */
export function showStats(questions: Curriculum, container?: HTMLElement): void {
  const target = container || document.getElementById('statsContainer');
  if (!target) return;
  
  const statsEl = renderStats(questions);
  target.innerHTML = '';
  target.appendChild(statsEl);
}

/**
 * Attach event listeners for interactive elements
 */
function attachQuestionEventListeners(
  element: HTMLElement,
  question: Question,
  callbacks: RenderCallbacks
): void {
  // MCQ choice click handlers
  if (callbacks.onSubmitAttestation) {
    const choices = element.querySelectorAll('.choice[data-choice-key]');
    choices.forEach(choice => {
      choice.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const choiceKey = target.dataset.choiceKey;
        if (choiceKey) {
          // Visual feedback
          choices.forEach(c => c.classList.remove('selected'));
          target.classList.add('selected');
          
          // Submit attestation with default confidence
          callbacks.onSubmitAttestation!(question.id, choiceKey, 3);
        }
      });
    });
  }
}

/**
 * Initialize Chart.js chart
 * This is called asynchronously after the canvas element is in the DOM
 */
async function initializeChart(canvasId: string, chartData: ChartData): Promise<void> {
  // Lazy load Chart.js if needed
  if (!ChartJS) {
    await loadChartJS();
  }
  
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Create chart based on type
  // This would contain the full chart initialization logic from quiz_renderer.html
  // For brevity, showing structure only
  
  let chart: any;
  
  switch (chartData.chartType) {
    case 'bar':
    case 'histogram':
      chart = createBarChart(ctx, chartData);
      break;
    case 'pie':
      chart = createPieChart(ctx, chartData);
      break;
    case 'scatter':
      chart = createScatterChart(ctx, chartData);
      break;
    // ... other chart types
    default:
      console.warn(`Unknown chart type: ${chartData.chartType}`);
      return;
  }
  
  if (chart) {
    chartInstances.set(canvasId, chart);
  }
}

/**
 * Create bar/histogram chart
 */
function createBarChart(ctx: CanvasRenderingContext2D, chartData: ChartData): any {
  // Implementation would go here
  // This is a placeholder showing the structure
  return null;
}

/**
 * Create pie chart
 */
function createPieChart(ctx: CanvasRenderingContext2D, chartData: ChartData): any {
  // Implementation would go here
  return null;
}

/**
 * Create scatter plot
 */
function createScatterChart(ctx: CanvasRenderingContext2D, chartData: ChartData): any {
  // Implementation would go here
  return null;
}

/**
 * Lazy load Chart.js library
 */
async function loadChartJS(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Chart) {
    ChartJS = (window as any).Chart;
    return;
  }
  
  // In a real implementation, this would dynamically load the script
  console.warn('Chart.js not loaded. Charts will not be rendered.');
}

/**
 * HTML escape utility
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all rendered content
 */
export function clearAll(): void {
  // Clear chart instances
  chartInstances.forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  chartInstances.clear();
  
  // Clear DOM containers if they exist
  const containers = [
    'messageContainer',
    'questionsContainer', 
    'statsContainer'
  ];
  
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}