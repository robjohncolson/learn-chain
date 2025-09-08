/**
 * Header Component - Phase 3
 * Displays user stats, reputation, exam countdown, and controls
 */

export interface HeaderOptions {
  username: string;
  reputationScore: number;
  currentUnit?: string;
  examDate: Date;
  onUnitChange?: (unitId: string) => void;
  onThemeToggle?: () => void;
  onAudioToggle?: () => void;
}

/**
 * Calculate days until exam
 */
function getDaysUntilExam(examDate: Date): number {
  const now = new Date();
  const diff = examDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format reputation score with emoji archetype
 */
function formatReputation(score: number): string {
  // Archetype emojis based on score ranges
  let emoji = '🌱'; // Beginner
  if (score >= 100) emoji = '📚'; // Scholar
  if (score >= 500) emoji = '🎓'; // Graduate
  if (score >= 1000) emoji = '🏆'; // Master
  if (score >= 5000) emoji = '⭐'; // Expert
  if (score >= 10000) emoji = '👑'; // Legend

  return `${emoji} ${score.toLocaleString()}`;
}

/**
 * Get progress percentage for current unit
 */
function getUnitProgress(unitId?: string): number {
  // TODO: Calculate from blockchain attestations
  return Math.floor(Math.random() * 100); // Placeholder
}

/**
 * Render the header component
 */
export function renderHeader(options: HeaderOptions): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-header';
  
  // Create header sections
  const leftSection = createLeftSection(options);
  const centerSection = createCenterSection(options);
  const rightSection = createRightSection(options);
  
  header.appendChild(leftSection);
  header.appendChild(centerSection);
  header.appendChild(rightSection);
  
  // Add styles
  header.innerHTML += `
    <style>
      .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        background: var(--header-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        min-height: 60px;
      }
      
      .header-section {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      
      .user-info {
        display: flex;
        flex-direction: column;
      }
      
      .username {
        font-weight: 600;
        font-size: 1.1rem;
      }
      
      .reputation {
        font-size: 0.9rem;
        opacity: 0.9;
      }
      
      .exam-countdown {
        text-align: center;
      }
      
      .countdown-label {
        font-size: 0.8rem;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .countdown-days {
        font-size: 1.8rem;
        font-weight: bold;
        margin: 0.2rem 0;
      }
      
      .countdown-date {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      .progress-bar {
        width: 200px;
        height: 8px;
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
        overflow: hidden;
        margin-top: 0.5rem;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #8BC34A);
        transition: width 0.3s ease;
      }
      
      .control-buttons {
        display: flex;
        gap: 0.5rem;
      }
      
      .header-btn {
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }
      
      .header-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-1px);
      }
      
      .icon-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
      }
      
      @media (max-width: 768px) {
        .app-header {
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
        }
        
        .header-section {
          width: 100%;
          justify-content: center;
        }
      }
    </style>
  `;
  
  return header;
}

/**
 * Create left section with user info
 */
function createLeftSection(options: HeaderOptions): HTMLElement {
  const section = document.createElement('div');
  section.className = 'header-section left-section';
  
  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';
  
  const username = document.createElement('div');
  username.className = 'username';
  username.textContent = options.username || 'Anonymous';
  
  const reputation = document.createElement('div');
  reputation.className = 'reputation';
  reputation.textContent = formatReputation(options.reputationScore || 0);
  
  userInfo.appendChild(username);
  userInfo.appendChild(reputation);
  
  // Add progress bar if unit selected
  if (options.currentUnit) {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${getUnitProgress(options.currentUnit)}%`;
    
    progressBar.appendChild(progressFill);
    userInfo.appendChild(progressBar);
  }
  
  section.appendChild(userInfo);
  return section;
}

/**
 * Create center section with exam countdown
 */
function createCenterSection(options: HeaderOptions): HTMLElement {
  const section = document.createElement('div');
  section.className = 'header-section center-section';
  
  const countdown = document.createElement('div');
  countdown.className = 'exam-countdown';
  
  const label = document.createElement('div');
  label.className = 'countdown-label';
  label.textContent = 'AP Exam In';
  
  const days = document.createElement('div');
  days.className = 'countdown-days';
  const daysUntil = getDaysUntilExam(options.examDate);
  days.textContent = `${daysUntil}`;
  
  const date = document.createElement('div');
  date.className = 'countdown-date';
  date.textContent = options.examDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Color code based on urgency
  if (daysUntil < 30) {
    days.style.color = '#ff6b6b';
  } else if (daysUntil < 60) {
    days.style.color = '#ffd93d';
  }
  
  countdown.appendChild(label);
  countdown.appendChild(days);
  countdown.appendChild(date);
  
  section.appendChild(countdown);
  return section;
}

/**
 * Create right section with controls
 */
function createRightSection(options: HeaderOptions): HTMLElement {
  const section = document.createElement('div');
  section.className = 'header-section right-section control-buttons';
  
  // Theme toggle button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'header-btn icon-btn';
  themeBtn.innerHTML = '🌙';
  themeBtn.title = 'Toggle theme';
  themeBtn.onclick = () => {
    if (options.onThemeToggle) {
      options.onThemeToggle();
      themeBtn.innerHTML = themeBtn.innerHTML === '🌙' ? '☀️' : '🌙';
    }
  };
  
  // Audio toggle button
  const audioBtn = document.createElement('button');
  audioBtn.className = 'header-btn icon-btn';
  audioBtn.innerHTML = '🔊';
  audioBtn.title = 'Toggle audio';
  audioBtn.onclick = () => {
    if (options.onAudioToggle) {
      options.onAudioToggle();
      audioBtn.innerHTML = audioBtn.innerHTML === '🔊' ? '🔇' : '🔊';
    }
  };
  
  // Stats button
  const statsBtn = document.createElement('button');
  statsBtn.className = 'header-btn';
  statsBtn.textContent = 'Stats';
  statsBtn.onclick = () => {
    // TODO: Show stats modal
    console.log('Show stats');
  };
  
  section.appendChild(themeBtn);
  section.appendChild(audioBtn);
  section.appendChild(statsBtn);
  
  return section;
}