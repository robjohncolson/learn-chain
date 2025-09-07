/**
 * Core type definitions for the Quiz Renderer module
 * Aligned with FUNDAMENTAL.md specification and AP Statistics curriculum
 */

import type { ConsensusData } from './consensus';

// ============= Core Question & Curriculum Types =============

/** Represents a single question in the curriculum (Q atoms) */
export interface Question {
  /** Unique identifier aligned with FUNDAMENTAL.md questionId atom */
  id: string;
  
  /** Question type classification */
  type: 'multiple-choice' | 'free-response';
  
  /** The question prompt text (supports LaTeX via MathJax) */
  prompt: string;
  
  /** Answer key for MCQ (letter choice) */
  answerKey?: string;
  
  /** SHA-256 hash of correct answer for MCQ validation (B atom) */
  answerHash?: string;
  
  /** Explanation or reasoning for the answer */
  reasoning?: string;
  
  /** Supplementary materials (charts, tables, images) */
  attachments?: Attachments;
  
  /** Direct choices array (convenience, usually in attachments) */
  choices?: Choice[];
  
  /** Detailed solution for free-response questions */
  solution?: Solution;
  
  /** FRQ scoring rubric (1-5 scale per ADR-028) */
  rubric?: ScoringRubric;
}

/** The entire curriculum is an array of questions */
export type Curriculum = Question[];

// ============= Attachment Types =============

/** Supplementary materials for a question */
export interface Attachments {
  /** Multiple-choice options */
  choices?: Choice[];
  
  /** Table data (2D array of strings) */
  table?: TableData;
  
  /** Multiple charts */
  charts?: ChartData[];
  
  /** Single chart (legacy support) */
  chartType?: ChartType;
  
  /** Single image */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  
  /** Multiple images */
  images?: ImageAttachment[];
  
  /** Chart-specific properties for single charts */
  [key: string]: any;
}

/** A multiple-choice option */
export interface Choice {
  /** Option letter (A, B, C, D, E) */
  key: string;
  
  /** Option text content */
  value: string;
}

/** Image attachment with metadata */
export interface ImageAttachment {
  image: string;
  imageAlt?: string;
  imageCaption?: string;
}

/** Table data structure */
export type TableData = string[][];

// ============= Chart Types =============

/** Supported chart types for data visualization */
export type ChartType = 
  | 'bar' 
  | 'histogram' 
  | 'pie' 
  | 'scatter' 
  | 'dotplot' 
  | 'boxplot' 
  | 'normal'
  | 'chisquare'
  | 'numberline';

/** Generic chart data configuration */
export interface ChartData {
  /** Type of chart to render */
  chartType: ChartType;
  
  /** Chart title */
  title?: string;
  
  /** Chart description */
  description?: string;
  
  /** Request full width in multi-chart layouts */
  fullWidth?: boolean;
  
  /** Chart.js configuration options */
  chartConfig?: ChartConfig;
  
  /** Chart-specific data properties */
  series?: ChartSeries[];
  points?: ScatterPoint[];
  values?: number[];
  xLabels?: string[];
  yLabels?: string[];
  
  /** Distribution-specific properties */
  mean?: number;
  sd?: number;
  df?: number;
  dfList?: number[];
  labels?: string[];
  shade?: { lower?: number | null; upper?: number | null };
  
  /** Number line specific */
  ticks?: NumberLineTick[];
  xAxis?: AxisConfig;
  
  [key: string]: any;
}

/** Chart configuration options */
export interface ChartConfig {
  /** Axis configurations */
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  
  /** Grid line display options */
  gridLines?: boolean | { horizontal?: boolean; vertical?: boolean };
  
  /** Chart orientation */
  orientation?: 'horizontal' | 'vertical';
  
  /** Stack bars */
  stacked?: boolean;
  
  /** Show data labels on points */
  showPointLabels?: boolean;
  
  /** Regression line for scatter plots */
  regressionLine?: boolean;
  regressionLineColor?: string;
  regressionLineDash?: number[];
  
  /** Reference line at y=0 for residual plots */
  referenceLineAtZero?: boolean;
  
  /** Boxplot specific data */
  boxplotData?: BoxplotData | BoxplotData[];
  
  /** Number of points for curve rendering */
  numPoints?: number;
  
  /** Dot plot radius */
  dotRadius?: number;
  
  [key: string]: any;
}

/** Axis configuration */
export interface AxisConfig {
  title?: string;
  min?: number;
  max?: number;
  tickInterval?: number;
  hideTicks?: boolean;
  labelType?: 'upperBound' | 'range' | 'lowerBound';
  labels?: string[];
}

/** Chart series data */
export interface ChartSeries {
  name: string;
  values: number[] | PieDataPoint[];
}

/** Pie chart data point */
export interface PieDataPoint {
  name: string;
  value: number;
}

/** Scatter plot point */
export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
}

/** Boxplot statistics */
export interface BoxplotData {
  name?: string;
  Q1: number;
  Q3: number;
  median: number;
  min?: number;
  max?: number;
  whiskerMin?: number;
  whiskerMax?: number;
  outliers?: number[];
}

/** Number line tick mark */
export interface NumberLineTick {
  x: number;
  label?: string;
  topLabel?: string;
  bottomLabel?: string;
  valueLabel?: string;
  drawTick?: boolean;
}

// ============= Solution & Scoring Types (FRQ) =============

/** Complete solution for a free-response question */
export interface Solution {
  /** Solution broken into parts */
  parts: SolutionPart[];
  
  /** Scoring information */
  scoring?: Scoring;
}

/** A single part of a multi-part solution */
export interface SolutionPart {
  /** Part identifier (a, b, c, etc.) */
  partId: string;
  
  /** Part description */
  description: string;
  
  /** Solution response text */
  response: string;
  
  /** Step-by-step calculations */
  calculations?: string[];
  
  /** Supporting materials for this part */
  attachments?: Attachments;
}

/** Scoring guide for free-response */
export interface Scoring {
  /** Total possible points */
  totalPoints: number;
  
  /** Rubric for each part */
  rubric: RubricPart[];
}

/** Scoring rubric component */
export interface RubricPart {
  /** Part identifier */
  part: string;
  
  /** Maximum points for this part */
  maxPoints: number;
  
  /** Scoring criteria list */
  criteria: string[];
  
  /** Additional scoring notes */
  scoringNotes?: string;
}

/** FRQ Scoring rubric (1-5 scale per ADR-028) */
export interface ScoringRubric {
  /** Minimum score */
  minScore: 1;
  
  /** Maximum score */
  maxScore: 5;
  
  /** Detailed scoring criteria */
  criteria: RubricCriteria[];
}

/** Individual scoring criterion */
export interface RubricCriteria {
  score: 1 | 2 | 3 | 4 | 5;
  description: string;
}

// ============= Rendering Configuration =============

/** Rendering mode for questions */
export type RenderMode = 
  | 'blind'      // Hide answers, enable submission
  | 'reveal'     // Show answers and explanations
  | 'consensus'; // Show emergent consensus data

/** Configuration options for rendering */
export interface RenderOptions {
  /** Current rendering mode */
  mode: RenderMode;
  
  /** Show consensus distributions */
  showDistributions?: boolean;
  
  /** Show confidence metrics */
  showConfidence?: boolean;
  
  /** Enable interactive elements */
  interactive?: boolean;
  
  /** Single question or full quiz */
  singleQuestion?: boolean;
  
  /** Callbacks for UI interactions */
  callbacks?: RenderCallbacks;
  
  /** Container element for rendering */
  container?: HTMLElement;
  
  /** Theme override */
  theme?: Theme;
}

/** Theme configuration */
export interface Theme {
  name: 'light' | 'dark';
  colors?: ThemeColors;
}

/** Theme color palette */
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  grid: string;
  [key: string]: string;
}

// ============= Callback Interfaces =============

/** Callbacks for UI integration */
export interface RenderCallbacks {
  /** Called when user submits an attestation */
  onSubmitAttestation?: OnSubmitAttestation;
  
  /** Called when consensus data is needed */
  onRequestConsensus?: OnRequestConsensus;
  
  /** Called when user navigates between questions */
  onNavigate?: OnNavigate;
  
  /** Called when theme changes */
  onThemeChange?: OnThemeChange;
  
  /** Called when audio feedback plays */
  onAudioFeedback?: OnAudioFeedback;
}

/** Attestation submission handler */
export type OnSubmitAttestation = (
  questionId: string,
  answer: string | number,
  confidence: number
) => void | Promise<void>;

/** Consensus data request handler */
export type OnRequestConsensus = (
  questionId: string
) => ConsensusData | Promise<ConsensusData>;

/** Navigation handler */
export type OnNavigate = (
  fromQuestionId: string | null,
  toQuestionId: string
) => void;

/** Theme change handler */
export type OnThemeChange = (theme: Theme) => void;

/** Audio feedback handler */
export type OnAudioFeedback = (
  type: FeedbackType,
  volume: number
) => void;

/** Types of audio feedback */
export type FeedbackType = 
  | 'success'
  | 'error'
  | 'click'
  | 'load'
  | 'clear'
  | 'theme';

// ============= Message Display =============

/** Message display types */
export type MessageType = 'success' | 'error' | 'info' | 'warning';

/** Message configuration */
export interface MessageOptions {
  type: MessageType;
  duration?: number;
  dismissible?: boolean;
  container?: HTMLElement;
}

// ============= Export Aggregation =============

/** Main API returned by initialization */
export interface RendererAPI {
  renderQuiz: (data: Curriculum, options?: RenderOptions) => void;
  renderQuestion: (question: Question, index: number, options?: RenderOptions) => string | HTMLElement;
  renderChart: (chartData: ChartData, questionId: string) => string;
  renderTable: (tableData: TableData) => string;
  renderChoices: (choices: Choice[], answerKey?: string, callbacks?: RenderCallbacks) => string;
  renderSolution: (solution: Solution, questionId: string) => string;
  renderConsensusDisplay: (consensus: ConsensusData, questionId: string) => string;
  cleanJsonText: (text: string) => string;
  showMessage: (message: string, options?: MessageOptions) => void;
  showStats: (questions: Curriculum, container?: HTMLElement) => void;
  clearAll: () => void;
  toggleTheme: () => Theme;
  destroy: () => void;
}

/** Renderer configuration */
export interface RendererConfig {
  /** Initial theme */
  theme?: Theme;
  
  /** Enable audio feedback */
  audioEnabled?: boolean;
  
  /** Initial volume (0-100) */
  volume?: number;
  
  /** Default render mode */
  defaultMode?: RenderMode;
  
  /** Lazy load Chart.js */
  lazyLoadCharts?: boolean;
  
  /** Lazy load MathJax */
  lazyLoadMath?: boolean;
  
  /** Local storage key prefix */
  storagePrefix?: string;
}

// ============= Consensus Data Types =============
// ConsensusData is defined in consensus.ts - import from there