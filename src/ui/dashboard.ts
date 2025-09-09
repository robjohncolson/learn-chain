/**
 * Dashboard Component - Phase 3
 * Displays curriculum navigation tree from allUnitsData.js
 * Shows progress, recent attestations, and unit overview
 */

import { EnhancedBlockchain } from '../core/enhanced-blockchain';

// Import allUnitsData.js
declare const ALL_UNITS_DATA: any[];

// Define Profile interface locally to avoid import issues
interface Profile {
  username: string;
  pubkey: string;
  privkey: string;
  seedphrase: string;
  reputationScore?: number;
}

export interface DashboardOptions {
  profile: Profile;
  blockchain: EnhancedBlockchain;
  onTopicSelect?: (unitId: string, topicId: string) => void;
  onQuestionSelect?: (questionId: string) => void;
}

interface UnitProgress {
  unitId: string;
  totalTopics: number;
  completedTopics: number;
  totalQuestions: number;
  attestedQuestions: number;
  consensusReached: number;
}

/**
 * Load and parse allUnitsData.js
 */
async function loadUnitsData(): Promise<any[]> {
  try {
    // Try to load from global if already loaded
    if (typeof ALL_UNITS_DATA !== 'undefined') {
      return ALL_UNITS_DATA;
    }
    
    // Otherwise load the script
    const script = document.createElement('script');
    script.src = '/assets/allUnitsData.js';
    document.head.appendChild(script);
    
    // Wait for script to load
    await new Promise((resolve) => {
      script.onload = resolve;
    });
    
    return (window as any).ALL_UNITS_DATA || [];
  } catch (error) {
    console.error('Failed to load units data:', error);
    return [];
  }
}

/**
 * Calculate progress for a unit
 */
function calculateUnitProgress(unit: any, blockchain: EnhancedBlockchain): UnitProgress {
  let completedTopics = 0;
  let totalQuestions = 0;
  let attestedQuestions = 0;
  let consensusReached = 0;
  
  unit.topics.forEach((topic: any) => {
    const topicCompleted = topic.videos.every((v: any) => v.completed) &&
                          topic.quizzes.every((q: any) => q.completed);
    if (topicCompleted) completedTopics++;
    
    totalQuestions += topic.quizzes.length;
    
    // Check blockchain for attestations
    topic.quizzes.forEach((quiz: any) => {
      const attestations = blockchain.getAttestationsForQuestion(quiz.quizId);
      if (attestations.length > 0) {
        attestedQuestions++;
        const consensus = blockchain.getConsensusForQuestion(quiz.quizId);
        if (consensus && consensus.convergence > 0.5) {
          consensusReached++;
        }
      }
    });
  });
  
  return {
    unitId: unit.unitId,
    totalTopics: unit.topics.length,
    completedTopics,
    totalQuestions,
    attestedQuestions,
    consensusReached
  };
}

/**
 * Render the dashboard
 */
export async function renderDashboard(options: DashboardOptions): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'dashboard-container';
  
  // Load units data
  const unitsData = await loadUnitsData();
  
  // Create dashboard sections
  const statsSection = createStatsSection(options.profile, options.blockchain);
  const unitsSection = await createUnitsSection(unitsData, options);
  const recentSection = createRecentActivity(options.blockchain);
  
  container.appendChild(statsSection);
  container.appendChild(unitsSection);
  container.appendChild(recentSection);
  
  // Add styles
  container.innerHTML += `
    <style>
      .dashboard-container {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        gap: 2rem;
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      
      .dashboard-section {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .section-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #333;
      }
      
      .stats-grid {
        display: grid;
        gap: 1rem;
      }
      
      .stat-card {
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
      }
      
      .stat-value {
        font-size: 2rem;
        font-weight: bold;
      }
      
      .stat-label {
        font-size: 0.9rem;
        opacity: 0.9;
        margin-top: 0.25rem;
      }
      
      .units-tree {
        max-height: 600px;
        overflow-y: auto;
      }
      
      .unit-item {
        margin-bottom: 1.5rem;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .unit-header {
        padding: 1rem;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s;
      }
      
      .unit-header:hover {
        background: #eeeeee;
      }
      
      .unit-title {
        font-weight: 600;
        color: #333;
      }
      
      .unit-progress {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .progress-ring {
        width: 40px;
        height: 40px;
      }
      
      .progress-ring-circle {
        transition: stroke-dashoffset 0.3s;
        transform: rotate(-90deg);
        transform-origin: 50% 50%;
      }
      
      .topics-list {
        padding: 0;
        margin: 0;
        list-style: none;
        display: none;
      }
      
      .unit-item.expanded .topics-list {
        display: block;
      }
      
      .topic-item {
        padding: 0.75rem 1rem 0.75rem 2rem;
        border-top: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .topic-item:hover {
        background: #f9f9f9;
      }
      
      .topic-info {
        flex: 1;
      }
      
      .topic-name {
        font-weight: 500;
        color: #555;
      }
      
      .topic-description {
        font-size: 0.85rem;
        color: #888;
        margin-top: 0.25rem;
      }
      
      .topic-stats {
        display: flex;
        gap: 1rem;
        font-size: 0.85rem;
        color: #666;
      }
      
      .topic-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      
      .badge-video {
        background: #e3f2fd;
        color: #1976d2;
      }
      
      .badge-quiz {
        background: #f3e5f5;
        color: #7b1fa2;
      }
      
      .badge-complete {
        background: #e8f5e9;
        color: #388e3c;
      }
      
      .recent-activity {
        max-height: 400px;
        overflow-y: auto;
      }
      
      .activity-item {
        padding: 0.75rem;
        border-bottom: 1px solid #f0f0f0;
        font-size: 0.9rem;
      }
      
      .activity-item:last-child {
        border-bottom: none;
      }
      
      .activity-time {
        color: #888;
        font-size: 0.8rem;
      }
      
      .activity-text {
        margin-top: 0.25rem;
      }
      
      @media (max-width: 1024px) {
        .dashboard-container {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `;
  
  return container;
}

/**
 * Create stats section
 */
function createStatsSection(profile: Profile, blockchain: EnhancedBlockchain): HTMLElement {
  const section = document.createElement('div');
  section.className = 'dashboard-section stats-section';
  
  section.innerHTML = `
    <h2 class="section-title">Your Stats</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${profile.reputationScore}</div>
        <div class="stat-label">Reputation</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${blockchain.getAttestationCount(profile.pubkey)}</div>
        <div class="stat-label">Attestations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${calculateStreak(blockchain, profile.pubkey)}</div>
        <div class="stat-label">Day Streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${calculateAccuracy(blockchain, profile.pubkey)}%</div>
        <div class="stat-label">Consensus Rate</div>
      </div>
    </div>
  `;
  
  return section;
}

/**
 * Create units section with navigation tree
 */
async function createUnitsSection(unitsData: any[], options: DashboardOptions): Promise<HTMLElement> {
  const section = document.createElement('div');
  section.className = 'dashboard-section units-section';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'AP Statistics Curriculum';
  section.appendChild(title);
  
  const unitsTree = document.createElement('div');
  unitsTree.className = 'units-tree';
  
  unitsData.forEach(unit => {
    const progress = calculateUnitProgress(unit, options.blockchain);
    const unitEl = createUnitElement(unit, progress, options);
    unitsTree.appendChild(unitEl);
  });
  
  section.appendChild(unitsTree);
  return section;
}

/**
 * Create a unit element with topics
 */
function createUnitElement(unit: any, progress: UnitProgress, options: DashboardOptions): HTMLElement {
  const unitEl = document.createElement('div');
  unitEl.className = 'unit-item';
  unitEl.dataset.unitId = unit.unitId;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'unit-header';
  
  const titleDiv = document.createElement('div');
  titleDiv.innerHTML = `
    <div class="unit-title">${unit.displayName}</div>
    <div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">
      ${unit.examWeight} • ${progress.completedTopics}/${progress.totalTopics} topics
    </div>
  `;
  
  const progressDiv = document.createElement('div');
  progressDiv.className = 'unit-progress';
  progressDiv.innerHTML = `
    <span style="font-size: 0.9rem; color: #666;">
      ${Math.round((progress.attestedQuestions / progress.totalQuestions) * 100)}%
    </span>
    ${createProgressRing((progress.attestedQuestions / progress.totalQuestions) * 100)}
  `;
  
  header.appendChild(titleDiv);
  header.appendChild(progressDiv);
  
  // Toggle topics on click
  header.onclick = () => {
    unitEl.classList.toggle('expanded');
  };
  
  // Create topics list
  const topicsList = document.createElement('ul');
  topicsList.className = 'topics-list';
  
  unit.topics.forEach((topic: any) => {
    const topicEl = createTopicElement(topic, unit.unitId, options);
    topicsList.appendChild(topicEl);
  });
  
  unitEl.appendChild(header);
  unitEl.appendChild(topicsList);
  
  return unitEl;
}

/**
 * Create a topic element
 */
function createTopicElement(topic: any, unitId: string, options: DashboardOptions): HTMLElement {
  const topicEl = document.createElement('li');
  topicEl.className = 'topic-item';
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'topic-info';
  infoDiv.innerHTML = `
    <div class="topic-name">${topic.name}</div>
    <div class="topic-description">${topic.description}</div>
  `;
  
  const statsDiv = document.createElement('div');
  statsDiv.className = 'topic-stats';
  
  if (topic.videos.length > 0) {
    const videoBadge = document.createElement('span');
    videoBadge.className = 'topic-badge badge-video';
    videoBadge.textContent = `${topic.videos.length} video${topic.videos.length > 1 ? 's' : ''}`;
    statsDiv.appendChild(videoBadge);
  }
  
  if (topic.quizzes.length > 0) {
    const quizBadge = document.createElement('span');
    quizBadge.className = 'topic-badge badge-quiz';
    quizBadge.textContent = `${topic.quizzes.length} quiz${topic.quizzes.length > 1 ? 'zes' : ''}`;
    statsDiv.appendChild(quizBadge);
  }
  
  const allComplete = topic.videos.every((v: any) => v.completed) && 
                      topic.quizzes.every((q: any) => q.completed);
  if (allComplete) {
    const completeBadge = document.createElement('span');
    completeBadge.className = 'topic-badge badge-complete';
    completeBadge.textContent = '✓ Complete';
    statsDiv.appendChild(completeBadge);
  }
  
  topicEl.appendChild(infoDiv);
  topicEl.appendChild(statsDiv);
  
  // Handle click
  topicEl.onclick = (e) => {
    e.stopPropagation();
    if (options.onTopicSelect) {
      options.onTopicSelect(unitId, topic.id);
    }
  };
  
  return topicEl;
}

/**
 * Create recent activity section
 */
function createRecentActivity(blockchain: EnhancedBlockchain): HTMLElement {
  const section = document.createElement('div');
  section.className = 'dashboard-section recent-section';
  
  section.innerHTML = `<h2 class="section-title">Recent Activity</h2>`;
  
  const activityList = document.createElement('div');
  activityList.className = 'recent-activity';
  
  // Get recent transactions
  const recentTxs = blockchain.getRecentTransactions(10);
  
  recentTxs.forEach(tx => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    const time = new Date(tx.timestamp).toLocaleString();
    const text = formatActivityText(tx);
    
    item.innerHTML = `
      <div class="activity-time">${time}</div>
      <div class="activity-text">${text}</div>
    `;
    
    activityList.appendChild(item);
  });
  
  if (recentTxs.length === 0) {
    activityList.innerHTML = '<div style="color: #888; text-align: center; padding: 2rem;">No recent activity</div>';
  }
  
  section.appendChild(activityList);
  return section;
}

/**
 * Create SVG progress ring
 */
function createProgressRing(percentage: number): string {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return `
    <svg class="progress-ring" viewBox="0 0 40 40">
      <circle
        cx="20"
        cy="20"
        r="${radius}"
        fill="none"
        stroke="#e0e0e0"
        stroke-width="3"
      />
      <circle
        class="progress-ring-circle"
        cx="20"
        cy="20"
        r="${radius}"
        fill="none"
        stroke="#667eea"
        stroke-width="3"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}"
        stroke-linecap="round"
      />
    </svg>
  `;
}

/**
 * Calculate streak days
 */
function calculateStreak(blockchain: EnhancedBlockchain, pubkey: string): number {
  // TODO: Implement actual streak calculation
  return 7;
}

/**
 * Calculate consensus accuracy
 */
function calculateAccuracy(blockchain: EnhancedBlockchain, pubkey: string): number {
  // TODO: Implement actual accuracy calculation
  return 85;
}

/**
 * Format activity text
 */
function formatActivityText(tx: any): string {
  switch (tx.txType) {
    case 'Attestation':
      return `Attested to question ${tx.data.questionId}`;
    case 'APReveal':
      return `AP revealed answer for ${tx.data.questionId}`;
    case 'CreateUser':
      return `New user joined`;
    default:
      return `Transaction: ${tx.txType}`;
  }
}