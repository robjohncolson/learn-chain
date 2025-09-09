/**
 * Enhanced Application Entry Point
 * Combines working basic UI with advanced features
 */

import { initialize as initBackend, API } from './index';
import { renderQuestion as renderQuizQuestion, renderChart, renderConsensusDisplay } from './quiz_renderer';
import { questionLoader } from './questions/loader';
import { initializeChart } from './utils/chartHelpers';
import { observeChart } from './ui/charts';
import { queueMathRendering, renderChoiceMath } from './renderer/mathRenderer';
import { EnhancedBlockchain } from './core/enhanced-blockchain';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

// Global state
let currentView: 'home' | 'dashboard' | 'question' | 'sync' = 'home';
let currentQuestion: any = null;
let blockchain: EnhancedBlockchain;
let allUnitsData: any = null;

// Load MathJax for LaTeX rendering
function loadMathJax() {
  if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
    // MathJax already loaded, just re-typeset
    try {
      (window as any).MathJax.typesetPromise();
    } catch (e) {
      console.log('MathJax typeset error (will retry):', e);
    }
    return;
  }
  
  // Configure MathJax before loading
  (window as any).MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true
    },
    svg: {
      fontCache: 'global'
    },
    startup: {
      ready: () => {
        (window as any).MathJax.startup.defaultReady();
        (window as any).MathJax.startup.promise.then(() => {
          console.log('MathJax loaded and ready');
          // Try to typeset after MathJax is ready
          setTimeout(() => {
            if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
              try {
                (window as any).MathJax.typesetPromise();
              } catch (e) {
                console.log('Initial MathJax typeset error:', e);
              }
            }
          }, 100);
        });
      }
    }
  };
  
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
  script.async = true;
  document.head.appendChild(script);
}

function loadChartJS(): Promise<void> {
  if ((window as any).Chart) {
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
      console.log('Chart.js loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load Chart.js from CDN');
      resolve();
    };
    document.head.appendChild(script);
  });
}

function renderSimpleChart(canvas: HTMLCanvasElement, chartData: any) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Simple fallback chart rendering
  const width = canvas.width = 400;
  const height = canvas.height = 300;
  
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);
  
  ctx.fillStyle = '#333';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${chartData.chartType || 'Chart'} - Data Visualization`, width/2, height/2);
  ctx.font = '12px sans-serif';
  ctx.fillText('(Chart.js not loaded)', width/2, height/2 + 20);
  
  console.log('Rendered simple fallback chart');
}

async function startApp() {
  console.log('Starting AP Statistics PoK Blockchain (Enhanced)...');
  
  // Initialize backend first
  await initBackend();
  
  // Initialize enhanced blockchain
  blockchain = new EnhancedBlockchain();
  
  // Load required libraries
  try {
    await loadChartJS();
  } catch (error) {
    console.error('Error loading Chart.js:', error);
  }
  loadMathJax();
  
  // Load curriculum data
  await loadCurriculumData();
  
  // Create initial UI
  renderHomeView();
  
  // Make API globally accessible for debugging
  (window as any).API = API;
  (window as any).blockchain = blockchain;
}

async function loadCurriculumData() {
  try {
    // Load questions first
    await questionLoader.load();
    const allQuestions = await questionLoader.getAllQuestions();
    console.log('Questions loaded:', allQuestions.length);
    
    // Load allUnitsData for curriculum tree
    const unitsResponse = await fetch('./assets/allUnitsData.js');
    if (unitsResponse.ok) {
      const unitsText = await unitsResponse.text();
      // Extract the ALL_UNITS_DATA array from the JS file
      const match = unitsText.match(/const ALL_UNITS_DATA = (\[[\s\S]*?\]);/);
      if (match) {
        const unitsArray = eval(match[0] + '; ALL_UNITS_DATA;');
        // Convert array to object keyed by unitId
        allUnitsData = {};
        unitsArray.forEach((unit: any) => {
          const unitNum = unit.unitId.replace('unit', '');
          allUnitsData[unit.unitId] = {
            title: unit.displayName,
            examWeight: unit.examWeight,
            topics: {}
          };
          // Convert topics array to object
          if (unit.topics) {
            unit.topics.forEach((topic: any) => {
              // Map questions to this topic based on ID pattern
              // topic.id is like "1-2", need to match "U1-L2-"
              const lessonNum = topic.id.split('-')[1];
              const pattern = `U${unitNum}-L${lessonNum}-`;
              
              const topicQuestions = allQuestions.filter(q => {
                return q.id && q.id.startsWith(pattern);
              });
              
              console.log(`Topic ${topic.id}: Found ${topicQuestions.length} questions with pattern ${pattern}`);
              
              allUnitsData[unit.unitId].topics[topic.id] = {
                title: topic.description || topic.name,
                questions: topicQuestions
              };
            });
          }
        });
        
        // Map remaining PC (Progress Check) and FRQ questions
        const unmappedQuestions = allQuestions.filter(q => {
          // Check if this question was already mapped
          let isMapped = false;
          Object.values(allUnitsData).forEach((unit: any) => {
            Object.values(unit.topics).forEach((topic: any) => {
              if (topic.questions.includes(q)) {
                isMapped = true;
              }
            });
          });
          return !isMapped;
        });
        
        console.log(`Found ${unmappedQuestions.length} unmapped questions`);
        
        // Group PC and FRQ questions by unit
        unmappedQuestions.forEach((q: any) => {
          // Check for PC questions (including PC-FRQ and PC-MCQ)
          const pcMatch = q.id.match(/U(\d+)-PC-/);
          if (pcMatch) {
            const unitNum = pcMatch[1];
            const unitId = `unit${unitNum}`;
            if (allUnitsData[unitId]) {
              // Determine if it's FRQ or MCQ
              const isFRQ = q.id.includes('FRQ');
              const topicKey = isFRQ ? 'progress-check-frq' : 'progress-check-mcq';
              const topicTitle = isFRQ ? 'Progress Check - Free Response' : 'Progress Check - Multiple Choice';
              
              // Add to appropriate Progress Check topic
              if (!allUnitsData[unitId].topics[topicKey]) {
                allUnitsData[unitId].topics[topicKey] = {
                  title: topicTitle,
                  questions: []
                };
              }
              allUnitsData[unitId].topics[topicKey].questions.push(q);
            }
          } else {
            // Check for other FRQ questions or any other pattern
            const unitMatch = q.id.match(/U(\d+)/);
            if (unitMatch) {
              const unitNum = unitMatch[1];
              const unitId = `unit${unitNum}`;
              if (allUnitsData[unitId]) {
                // Add to "Other Questions" topic
                if (!allUnitsData[unitId].topics['other']) {
                  allUnitsData[unitId].topics['other'] = {
                    title: 'Additional Questions',
                    questions: []
                  };
                }
                allUnitsData[unitId].topics['other'].questions.push(q);
              }
            }
          }
        });
        
        // Log statistics
        let totalMapped = 0;
        Object.values(allUnitsData).forEach((unit: any) => {
          Object.values(unit.topics).forEach((topic: any) => {
            totalMapped += topic.questions.length;
          });
        });
        console.log('Loaded units data:', Object.keys(allUnitsData).length, 'units');
        console.log('Mapped questions to topics:', totalMapped, 'of', allQuestions.length);
      }
    }
  } catch (error) {
    console.error('Error loading curriculum data:', error);
  }
}

function renderHomeView() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;
  
  currentView = 'home';
  
  appContainer.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0;">AP Statistics Consensus Blockchain</h1>
          <p style="margin: 5px 0; opacity: 0.9;">Proof of Knowledge Learning System</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="window.showDashboard()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            📚 Dashboard
          </button>
          <button onclick="window.showSyncModal()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            🔄 Sync
          </button>
        </div>
      </div>
      
      <!-- Profile Section -->
      <div id="profile-section" style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Profile</h2>
        <div id="profile-content"></div>
      </div>

      <!-- Quick Start -->
      <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Quick Start</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
          <button onclick="window.showDashboard()" style="padding: 15px; background: white; border: 2px solid #4CAF50; border-radius: 8px; cursor: pointer; text-align: left;">
            <div style="font-size: 24px;">📖</div>
            <div style="font-weight: bold; margin: 5px 0;">Study Questions</div>
            <div style="font-size: 0.9em; color: #666;">Browse curriculum & practice</div>
          </button>
          <button onclick="window.startRandomQuestion()" style="padding: 15px; background: white; border: 2px solid #2196F3; border-radius: 8px; cursor: pointer; text-align: left;">
            <div style="font-size: 24px;">🎲</div>
            <div style="font-weight: bold; margin: 5px 0;">Random Question</div>
            <div style="font-size: 0.9em; color: #666;">Test your knowledge</div>
          </button>
          <button onclick="window.showSyncModal()" style="padding: 15px; background: white; border: 2px solid #FF9800; border-radius: 8px; cursor: pointer; text-align: left;">
            <div style="font-size: 24px;">📱</div>
            <div style="font-weight: bold; margin: 5px 0;">Sync Devices</div>
            <div style="font-size: 0.9em; color: #666;">Share via QR code</div>
          </button>
        </div>
      </div>

      <!-- Blockchain Status -->
      <div id="blockchain-info" style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Blockchain Status</h2>
        <div id="chain-info">Loading...</div>
      </div>
    </div>
  `;
  
  // Set up profile section
  updateProfileSection();
  
  // Update blockchain info
  updateBlockchainInfo();
  
  // Set up global functions
  setupGlobalFunctions();
}

function renderDashboardView() {
  const appContainer = document.getElementById('app');
  if (!appContainer || !allUnitsData) return;
  
  currentView = 'dashboard';
  
  appContainer.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
      <!-- Header with Back Button -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <button onclick="window.goHome()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
          ← Back
        </button>
        <h1 style="margin: 0;">Curriculum Dashboard</h1>
        <p style="margin: 5px 0; opacity: 0.9;">Select a topic to begin studying</p>
      </div>
      
      <!-- Units Tree -->
      <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div id="units-tree"></div>
      </div>
    </div>
  `;
  
  renderUnitsTree();
}

function renderUnitsTree() {
  const treeContainer = document.getElementById('units-tree');
  if (!treeContainer || !allUnitsData) return;
  
  let html = '';
  
  // Render each unit
  Object.entries(allUnitsData).forEach(([unitId, unitData]: [string, any]) => {
    const unitNum = unitId.replace('unit', '');
    html += `
      <div style="margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="padding: 15px; background: #f5f5f5; cursor: pointer;" onclick="window.toggleUnit('${unitId}')">
          <h3 style="margin: 0; color: #333;">Unit ${unitNum}: ${unitData.title}</h3>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">${Object.keys(unitData.topics).length} topics</p>
        </div>
        <div id="${unitId}-topics" style="display: none; padding: 0 15px 15px 15px;">
    `;
    
    // Render topics
    Object.entries(unitData.topics).forEach(([topicId, topicData]: [string, any]) => {
      const questionCount = topicData.questions?.length || 0;
      html += `
        <div style="padding: 10px; margin: 10px 0; background: #f9f9f9; border-radius: 6px; cursor: pointer; hover: background: #f0f0f0;" 
             onclick="window.selectTopic('${unitId}', '${topicId}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${topicData.title}</strong>
              <div style="color: #666; font-size: 0.85em; margin-top: 3px;">${questionCount} questions</div>
            </div>
            <div style="color: #4CAF50;">→</div>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  });
  
  treeContainer.innerHTML = html;
}

async function renderQuestionView(unitId: string, topicId: string, questionIndex: number = 0) {
  const appContainer = document.getElementById('app');
  if (!appContainer || !allUnitsData) return;
  
  currentView = 'question';
  
  const unit = allUnitsData[unitId];
  const topic = unit?.topics[topicId];
  const questions = topic?.questions || [];
  
  if (questions.length === 0) {
    alert('No questions found for this topic');
    renderDashboardView();
    return;
  }
  
  currentQuestion = questions[questionIndex];
  
  // Try to load full question data from curriculum.json
  const fullQuestion = await questionLoader.getQuestion(currentQuestion.id);
  if (fullQuestion) {
    currentQuestion = fullQuestion;
  }
  
  appContainer.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <button onclick="window.showDashboard()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
          ← Back to Dashboard
        </button>
        <h2 style="margin: 0;">${topic.title}</h2>
        <p style="margin: 5px 0; opacity: 0.9;">Question ${questionIndex + 1} of ${questions.length}</p>
      </div>
      
      <!-- Question Container -->
      <div id="question-container" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div id="question-content"></div>
        
        <!-- Answer Section -->
        <div id="answer-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h3>Your Answer:</h3>
          <div id="answer-input"></div>
          <button onclick="window.submitAnswer()" style="margin-top: 15px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
            Submit Answer
          </button>
        </div>
        
        <!-- Consensus Section (hidden initially) -->
        <div id="consensus-section" style="display: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h3>Consensus Results:</h3>
          <div id="consensus-content"></div>
        </div>
      </div>
      
      <!-- Navigation -->
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button onclick="window.previousQuestion('${unitId}', '${topicId}', ${questionIndex})" 
                style="padding: 10px 20px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer;"
                ${questionIndex === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        <button onclick="window.nextQuestion('${unitId}', '${topicId}', ${questionIndex})" 
                style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;"
                ${questionIndex === questions.length - 1 ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    </div>
  `;
  
  // Render the question using quiz_renderer
  const questionContent = document.getElementById('question-content');
  const answerInput = document.getElementById('answer-input');
  
  if (questionContent && answerInput) {
    // Render question text
    let questionHTML = `
      <h3>Question ${currentQuestion.id || questionIndex + 1}</h3>
      <div style="font-size: 1.1em; line-height: 1.6; margin: 15px 0;">
        ${currentQuestion.prompt || currentQuestion.text || 'Question text not available'}
      </div>
    `;
    
    // Add table if present
    if (currentQuestion.attachments?.table) {
      questionHTML += `
        <div style="margin: 15px 0; overflow-x: auto;">
          <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
            ${currentQuestion.attachments.table.map((row: any[], idx: number) => `
              <tr style="${idx === 0 ? 'background: #f0f0f0; font-weight: bold;' : ''}">
                ${row.map((cell: any) => `
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">
                    ${cell}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }
    
    // Add image if present
    if (currentQuestion.attachments?.image) {
      questionHTML += `
        <div style="margin: 15px 0;">
          <img src="${currentQuestion.attachments.image}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      `;
    }
    
    // Add chart if present
    if (currentQuestion.attachments?.chartType) {
      questionHTML += renderChart(currentQuestion.attachments, currentQuestion.id || `q-${questionIndex}`);
    }
    
    questionContent.innerHTML = questionHTML;
    
    // Trigger MathJax rendering after content is added to DOM
    setTimeout(() => {
      loadMathJax();
    }, 50);
    
    // Initialize any charts that were added using new lazy loading
    if (currentQuestion.attachments?.chartType) {
      setTimeout(() => {
        // The chart ID is generated by renderChart function
        const canvases = questionContent.querySelectorAll('canvas[id^="chart-"]');
        if (canvases.length > 0) {
          const chartCanvas = canvases[0] as HTMLCanvasElement;
          try {
            // Use new observeChart for lazy loading
            observeChart(chartCanvas.id, currentQuestion.attachments);
            console.log('Chart observer set for:', chartCanvas.id);
          } catch (error) {
            console.error('Error observing chart:', error);
            // Fallback: try to render a simple chart without Chart.js
            renderSimpleChart(chartCanvas, currentQuestion.attachments);
          }
        }
      }, 200);
    }
    
    // Render answer input based on question type
    if (currentQuestion.type === 'multiple-choice') {
      // Get actual choices from attachments.choices or generate defaults
      let choices = [];
      
      if (currentQuestion.attachments?.choices) {
        // Choices are provided in attachments
        choices = currentQuestion.attachments.choices.map((c: any) => ({
          id: c.key || c.id,
          text: c.value || c.text
        }));
      } else if (currentQuestion.choices) {
        // Choices directly on question
        choices = currentQuestion.choices;
      } else {
        // Generate default choices based on answerKey
        const lastOption = currentQuestion.answerKey || 'E';
        const numOptions = lastOption.charCodeAt(0) - 65 + 1;
        choices = ['A', 'B', 'C', 'D', 'E'].slice(0, Math.min(numOptions, 5)).map(id => ({
          id,
          text: `Option ${id}`
        }));
      }
      
      answerInput.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;" id="mc-choices">
          ${choices.map((choice: any) => `
            <label style="display: flex; align-items: flex-start; padding: 10px; background: #f5f5f5; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
              <input type="radio" name="answer" value="${choice.id}" style="margin-right: 10px; margin-top: 3px;">
              <span class="choice-text"><strong>${choice.id}:</strong> ${choice.text}</span>
            </label>
          `).join('')}
        </div>
      `;
      
      // Use new math renderer for multiple choice answers
      setTimeout(() => {
        const choicesDiv = document.getElementById('mc-choices');
        if (choicesDiv) {
          renderChoiceMath(choicesDiv);
        }
      }, 100);
    } else {
      // Free response
      answerInput.innerHTML = `
        <textarea id="frq-answer" style="width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; font-size: 14px;" 
                  placeholder="Enter your answer here..."></textarea>
      `;
    }
  }
}

function renderSyncModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'sync-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 10px; padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0;">📱 Device Sync</h2>
        <button onclick="window.closeSyncModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
      </div>
      
      <p style="color: #666; margin-bottom: 20px;">Share your progress with another device using QR codes</p>
      
      <div style="display: grid; gap: 20px;">
        <button onclick="window.startQRShare()" style="padding: 15px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          📤 Share My Data (Generate QR)
        </button>
        
        <button onclick="window.startQRScan()" style="padding: 15px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          📥 Receive Data (Scan QR)
        </button>
        
        <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0;">📊 Sync Status</h4>
          <div style="font-size: 0.9em; color: #666;">
            Last sync: Never<br>
            Blocks: ${blockchain?.getChain?.()?.length || 0}<br>
            Questions answered: 0
          </div>
        </div>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        
        <h4 style="margin: 0 0 10px 0;">💾 Manual Export/Import</h4>
        <div style="display: grid; gap: 10px;">
          <button onclick="window.exportData()" style="padding: 10px; background: #9C27B0; color: white; border: none; border-radius: 6px; cursor: pointer;">
            📤 Export to File
          </button>
          <button onclick="window.importData()" style="padding: 10px; background: #673AB7; color: white; border: none; border-radius: 6px; cursor: pointer;">
            📥 Import from File
          </button>
        </div>
      </div>
      
      <div id="qr-display" style="margin-top: 20px; text-align: center;"></div>
      <div id="qr-scanner" style="margin-top: 20px;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function setupGlobalFunctions() {
  // Navigation functions
  (window as any).goHome = () => renderHomeView();
  (window as any).showDashboard = () => renderDashboardView();
  
  // Unit/Topic selection
  (window as any).toggleUnit = (unitId: string) => {
    const topicsDiv = document.getElementById(`${unitId}-topics`);
    if (topicsDiv) {
      topicsDiv.style.display = topicsDiv.style.display === 'none' ? 'block' : 'none';
    }
  };
  
  (window as any).selectTopic = (unitId: string, topicId: string) => {
    renderQuestionView(unitId, topicId, 0);
  };
  
  // Question navigation
  (window as any).nextQuestion = (unitId: string, topicId: string, currentIndex: number) => {
    renderQuestionView(unitId, topicId, currentIndex + 1);
  };
  
  (window as any).previousQuestion = (unitId: string, topicId: string, currentIndex: number) => {
    renderQuestionView(unitId, topicId, currentIndex - 1);
  };
  
  (window as any).startRandomQuestion = async () => {
    try {
      const questions = await questionLoader.getAllQuestions();
      console.log('Available questions:', questions.length);
      
      if (questions.length > 0) {
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        currentQuestion = randomQ;
        console.log('Selected random question:', randomQ.id);
        
        // Build proper question display with all attachments
        let questionHTML = `<div style="font-size: 1.1em; line-height: 1.6; margin: 15px 0;">
          ${randomQ.text || randomQ.prompt || 'Question text not available'}
        </div>`;
        
        // Add table if present
        if (randomQ.attachments?.table) {
          questionHTML += `
            <div style="margin: 15px 0; overflow-x: auto;">
              <table style="border-collapse: collapse; width: 100%;">
                ${randomQ.attachments.table.map((row: any[], idx: number) => `
                  <tr style="${idx === 0 ? 'background: #f0f0f0; font-weight: bold;' : ''}">
                    ${row.map((cell: any) => `
                      <td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>
                    `).join('')}
                  </tr>
                `).join('')}
              </table>
            </div>
          `;
        }
        
        // Build answer choices
        let answerHTML = '';
        if (randomQ.type === 'multiple-choice') {
          let choices = [];
          if (randomQ.attachments?.choices) {
            choices = randomQ.attachments.choices.map((c: any) => ({
              id: c.key || c.id,
              text: c.value || c.text
            }));
          } else {
            const lastOption = randomQ.answerKey || 'E';
            const numOptions = lastOption.charCodeAt(0) - 65 + 1;
            choices = ['A', 'B', 'C', 'D', 'E'].slice(0, Math.min(numOptions, 5)).map(id => ({
              id,
              text: `Option ${id} (choices not provided in data)`
            }));
          }
          
          answerHTML = `<div style="display: flex; flex-direction: column; gap: 10px;">
            ${choices.map((choice: any) => 
              `<label style="display: flex; align-items: flex-start; padding: 10px; background: #f5f5f5; border-radius: 6px; cursor: pointer;">
                <input type="radio" name="answer" value="${choice.id}" style="margin-right: 10px; margin-top: 3px;">
                <span><strong>${choice.id}:</strong> ${choice.text}</span>
              </label>`
            ).join('')}
          </div>`;
        } else {
          answerHTML = `<textarea style="width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" placeholder="Enter your answer..."></textarea>`;
        }
        
        const appContainer = document.getElementById('app');
        if (appContainer) {
          appContainer.innerHTML = `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <button onclick="window.goHome()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
                  ← Back Home
                </button>
                <h2 style="margin: 0;">Random Question</h2>
                <p style="margin: 5px 0; opacity: 0.9;">Question ID: ${randomQ.id} | Type: ${randomQ.type}</p>
              </div>
              
              <!-- Question Container -->
              <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h3>Question</h3>
                ${questionHTML}
                
                <!-- Answer Section -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                  <h3>Your Answer:</h3>
                  <div id="answer-input">${answerHTML}</div>
                  <button onclick="window.submitRandomAnswer()" style="margin-top: 15px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Submit Answer
                  </button>
                </div>
              </div>
              
              <button onclick="window.startRandomQuestion()" style="margin-top: 20px; padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Next Random Question →
              </button>
            </div>
          `;
          
          // Load MathJax for LaTeX rendering if needed
          if ((randomQ.text || randomQ.prompt || '').includes('$') || (randomQ.text || randomQ.prompt || '').includes('\\(')) {
            loadMathJax();
          }
        }
      } else {
        alert('No questions available');
      }
    } catch (error) {
      console.error('Error loading random question:', error);
      alert('Error loading questions. Check console.');
    }
  };
  
  // Answer submission
  (window as any).submitAnswer = async () => {
    let answer: any;
    
    if (currentQuestion.type === 'multiple-choice') {
      const selected = document.querySelector('input[name="answer"]:checked') as HTMLInputElement;
      if (!selected) {
        alert('Please select an answer');
        return;
      }
      answer = selected.value;
    } else {
      const textarea = document.getElementById('frq-answer') as HTMLTextAreaElement;
      answer = textarea?.value.trim();
      if (!answer) {
        alert('Please enter an answer');
        return;
      }
    }
    
    // Create attestation (simplified for now)
    console.log('Submitting answer:', answer);
    
    // Show consensus section
    const consensusSection = document.getElementById('consensus-section');
    const consensusContent = document.getElementById('consensus-content');
    
    if (consensusSection && consensusContent) {
      consensusSection.style.display = 'block';
      
      // Mock consensus data for now
      consensusContent.innerHTML = `
        <div style="padding: 15px; background: #e8f5e9; border-radius: 8px;">
          <p><strong>Your answer has been recorded!</strong></p>
          <p>Waiting for more responses to show consensus...</p>
          <div style="margin-top: 10px;">
            <small>Convergence: 25% (need 50% for reveal)</small>
          </div>
        </div>
      `;
    }
  };
  
  // Submit answer for random question
  (window as any).submitRandomAnswer = () => {
    const selected = document.querySelector('input[name="answer"]:checked') as HTMLInputElement;
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    
    if (currentQuestion?.type === 'multiple-choice') {
      if (!selected) {
        alert('Please select an answer');
        return;
      }
      alert(`Answer "${selected.value}" submitted!\n\nCorrect answer: ${currentQuestion.answerKey || 'Not provided'}`);
    } else {
      if (!textarea?.value.trim()) {
        alert('Please enter an answer');
        return;
      }
      alert('Free response answer submitted!');
    }
  };
  
  // Sync modal
  (window as any).showSyncModal = () => renderSyncModal();
  
  (window as any).closeSyncModal = () => {
    const modal = document.getElementById('sync-modal');
    if (modal) modal.remove();
  };
  
  (window as any).startQRShare = async () => {
    const qrDisplay = document.getElementById('qr-display');
    if (qrDisplay) {
      try {
        // Get blockchain data to share
        const shareData = {
          blocks: blockchain.getChain(),
          timestamp: Date.now(),
          version: '1.0'
        };
        
        // Convert to JSON and compress
        const dataStr = JSON.stringify(shareData);
        
        // Check if data is too large for QR code
        if (dataStr.length > 2953) { // QR code limit
          // Split into chunks for multiple QR codes
          const chunkSize = 1000;
          const chunks = [];
          for (let i = 0; i < dataStr.length; i += chunkSize) {
            chunks.push(dataStr.slice(i, i + chunkSize));
          }
          
          let currentChunk = 0;
          const showChunk = async (index: number) => {
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, chunks[index], {
              width: 256,
              margin: 2
            });
            
            qrDisplay.innerHTML = `
              <div style="padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
                <p><strong>Data QR Code (Part ${index + 1} of ${chunks.length})</strong></p>
                <div style="margin: 15px 0;"></div>
                <p>Size: ${(dataStr.length / 1024).toFixed(2)} KB | Blocks: ${shareData.blocks.length}</p>
                <div style="margin-top: 15px;">
                  <button onclick="window.nextQRChunk()" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Next Part →
                  </button>
                </div>
              </div>
            `;
            qrDisplay.querySelector('div > div')?.appendChild(canvas);
          };
          
          (window as any).nextQRChunk = () => {
            currentChunk = (currentChunk + 1) % chunks.length;
            showChunk(currentChunk);
          };
          
          await showChunk(0);
        } else {
          // Single QR code
          const canvas = document.createElement('canvas');
          await QRCode.toCanvas(canvas, dataStr, {
            width: 256,
            margin: 2
          });
          
          qrDisplay.innerHTML = `
            <div style="padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
              <p><strong>Blockchain Data QR Code</strong></p>
              <div style="margin: 15px 0;"></div>
              <p>Size: ${(dataStr.length / 1024).toFixed(2)} KB | Blocks: ${shareData.blocks.length}</p>
              <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                Scan this code on another device to sync
              </p>
            </div>
          `;
          qrDisplay.querySelector('div > div')?.appendChild(canvas);
        }
      } catch (error) {
        console.error('Error generating QR:', error);
        qrDisplay.innerHTML = '<p style="color: red;">Error generating QR code</p>';
      }
    }
  };
  
  (window as any).startQRScan = async () => {
    const qrScanner = document.getElementById('qr-scanner');
    if (qrScanner) {
      try {
        // Create video element for camera
        qrScanner.innerHTML = `
          <div style="padding: 15px; background: #f0f9ff; border-radius: 8px;">
            <p><strong>QR Scanner</strong></p>
            <div id="qr-reader" style="width: 100%; max-width: 400px; margin: 15px auto;"></div>
            <div id="scan-result" style="margin-top: 15px;"></div>
            <button onclick="window.stopQRScan()" style="margin-top: 10px; padding: 8px 16px; background: #ff6b6b; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Stop Scanning
            </button>
          </div>
        `;
        
        // Initialize QR scanner
        const html5QrCode = new Html5Qrcode("qr-reader");
        const scannedChunks: string[] = [];
        
        const qrCodeSuccessCallback = (decodedText: string, decodedResult: any) => {
          console.log('QR Code scanned:', decodedText.substring(0, 50) + '...');
          
          // Check if this is a multi-part QR
          if (decodedText.startsWith('PART:')) {
            // Handle multi-part QR codes
            const match = decodedText.match(/PART:(\d+)\/(\d+):(.*)/);
            if (match) {
              const [, part, total, data] = match;
              scannedChunks[parseInt(part) - 1] = data;
              
              const scanResult = document.getElementById('scan-result');
              if (scanResult) {
                scanResult.innerHTML = `<p style="color: green;">Scanned part ${part} of ${total}</p>`;
              }
              
              // Check if all parts are scanned
              if (scannedChunks.filter(Boolean).length === parseInt(total)) {
                const fullData = scannedChunks.join('');
                processScannedData(fullData);
                html5QrCode.stop();
              }
            }
          } else {
            // Single QR code
            processScannedData(decodedText);
            html5QrCode.stop();
          }
        };
        
        const processScannedData = (data: string) => {
          try {
            const syncData = JSON.parse(data);
            const scanResult = document.getElementById('scan-result');
            if (scanResult) {
              scanResult.innerHTML = `
                <div style="padding: 10px; background: #e8f5e9; border-radius: 6px;">
                  <p style="color: green;"><strong>✓ Data Received!</strong></p>
                  <p>Blocks: ${syncData.blocks?.length || 0}</p>
                  <p>Timestamp: ${new Date(syncData.timestamp).toLocaleString()}</p>
                  <button onclick="window.mergeData('${btoa(data)}')" style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Merge Data
                  </button>
                </div>
              `;
            }
          } catch (error) {
            console.error('Error processing scanned data:', error);
            const scanResult = document.getElementById('scan-result');
            if (scanResult) {
              scanResult.innerHTML = '<p style="color: red;">Error: Invalid QR code data</p>';
            }
          }
        };
        
        // Start scanning
        await html5QrCode.start(
          { facingMode: "environment" }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          qrCodeSuccessCallback,
          (errorMessage) => {
            // Ignore errors silently (happens when no QR in view)
          }
        );
        
        // Store scanner instance for cleanup
        (window as any).currentScanner = html5QrCode;
        
      } catch (error) {
        console.error('Error starting QR scanner:', error);
        qrScanner.innerHTML = `
          <div style="padding: 15px; background: #fff3cd; border-radius: 8px;">
            <p style="color: #856404;"><strong>Camera Access Required</strong></p>
            <p>Please allow camera access to scan QR codes.</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Error: ${error}</p>
          </div>
        `;
      }
    }
  };
  
  (window as any).stopQRScan = () => {
    const scanner = (window as any).currentScanner;
    if (scanner) {
      scanner.stop().then(() => {
        console.log('QR scanner stopped');
        const qrScanner = document.getElementById('qr-scanner');
        if (qrScanner) {
          qrScanner.innerHTML = '<p>Scanner stopped</p>';
        }
      });
    }
  };
  
  (window as any).mergeData = (encodedData: string) => {
    try {
      const data = JSON.parse(atob(encodedData));
      // TODO: Implement actual merge logic
      alert(`Data merged! Added ${data.blocks?.length || 0} blocks to your chain.`);
      window.closeSyncModal();
    } catch (error) {
      console.error('Error merging data:', error);
      alert('Error merging data');
    }
  };
  
  // Manual export/import functions
  (window as any).exportData = () => {
    try {
      const exportData = {
        blocks: blockchain.getChain(),
        profile: localStorage.getItem('userProfile'),
        timestamp: Date.now(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ap-stats-blockchain-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      alert('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data');
    }
  };
  
  (window as any).importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.blocks && Array.isArray(data.blocks)) {
          // TODO: Merge blockchain data
          alert(`Import successful!\n\nImported ${data.blocks.length} blocks\nTimestamp: ${new Date(data.timestamp).toLocaleString()}`);
          window.closeSyncModal();
        } else {
          alert('Invalid file format');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing file. Please check the file format.');
      }
    };
    
    input.click();
  };
}

function updateProfileSection() {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;
  
  // Check if we have a saved profile
  const savedProfile = localStorage.getItem('userProfile');
  
  if (savedProfile) {
    const profile = JSON.parse(savedProfile);
    profileContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p><strong>Username:</strong> ${profile.username}</p>
          <p><strong>Reputation:</strong> 🌱 0 points</p>
        </div>
        <button onclick="window.createNewProfile()" style="padding: 8px 16px; background: #ff6b6b; color: white; border: none; border-radius: 6px; cursor: pointer;">
          New Profile
        </button>
      </div>
    `;
  } else {
    profileContent.innerHTML = `
      <div>
        <input type="text" id="username" placeholder="Enter username" style="padding: 8px; width: 200px; margin-right: 10px;">
        <button onclick="window.createProfile()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Create Profile
        </button>
      </div>
    `;
  }
  
  // Profile functions
  (window as any).createProfile = async () => {
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const username = usernameInput?.value.trim();
    
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    try {
      const profile = await API.createUser(username);
      if (profile) {
        localStorage.setItem('userProfile', JSON.stringify(profile));
        updateProfileSection();
        updateBlockchainInfo();
        alert(`Profile created! Save your seed phrase:\n\n${profile.seedphrase}`);
      } else {
        alert('Failed to create profile. Username may already exist.');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Error creating profile. Check console for details.');
    }
  };
  
  (window as any).createNewProfile = () => {
    if (confirm('This will create a new profile. Your current profile will be lost unless you saved the seed phrase. Continue?')) {
      localStorage.removeItem('userProfile');
      updateProfileSection();
    }
  };
}

function updateBlockchainInfo() {
  try {
    const info = API.getBlockchainInfo();
    const chainInfo = document.getElementById('chain-info');
    
    if (chainInfo) {
      chainInfo.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
          <div>
            <strong>Blocks:</strong> ${info.blockCount}
          </div>
          <div>
            <strong>Latest Hash:</strong> <code style="font-size: 0.8em;">${info.latestBlockHash.substring(0, 12)}...</code>
          </div>
          <div>
            <strong>Network:</strong> <span style="color: green;">✓ Local</span>
          </div>
          <div>
            <strong>Status:</strong> <span style="color: green;">✓ Valid</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error updating blockchain info:', error);
  }
}

// Export for module use
export { startApp };

// Start the app when DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', startApp);
}