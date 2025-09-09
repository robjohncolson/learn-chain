/**
 * Basic Application Entry Point
 * Simple working version without complex UI controller
 */

import { initialize as initBackend, API } from './index';

async function startApp() {
  console.log('Starting AP Statistics PoK Blockchain...');
  
  // Initialize backend first
  await initBackend();
  
  // Create basic UI
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found!');
    return;
  }

  // Create a simple interface
  appContainer.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1>AP Statistics Consensus Blockchain</h1>
      
      <div id="profile-section" style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Create Profile</h2>
        <input type="text" id="username" placeholder="Enter username" style="padding: 8px; width: 200px;">
        <button id="create-profile" style="padding: 8px 16px; margin-left: 10px;">Create Profile</button>
        <div id="profile-info" style="margin-top: 10px;"></div>
      </div>

      <div id="question-section" style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Questions</h2>
        <p>Loading questions from curriculum...</p>
        <div id="questions-list"></div>
      </div>

      <div id="blockchain-info" style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Blockchain Status</h2>
        <div id="chain-info">Initializing...</div>
      </div>
    </div>
  `;

  // Set up event handlers
  setupEventHandlers();
  
  // Load questions
  await loadQuestions();
  
  // Update blockchain info
  updateBlockchainInfo();
}

function setupEventHandlers() {
  const createButton = document.getElementById('create-profile');
  const usernameInput = document.getElementById('username') as HTMLInputElement;
  
  createButton?.addEventListener('click', async () => {
    const username = usernameInput?.value.trim();
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    try {
      const profile = await API.createUser(username);
      
      if (profile) {
        const profileInfo = document.getElementById('profile-info');
        if (profileInfo) {
          profileInfo.innerHTML = `
            <div style="color: green; margin-top: 10px;">
              ✓ Profile created successfully!<br>
              Username: ${profile.username}<br>
              Public Key: ${profile.pubkey.substring(0, 20)}...<br>
              <strong>Save your seed phrase:</strong><br>
              <code style="background: #fff; padding: 5px; display: inline-block; margin-top: 5px;">
                ${profile.seedphrase}
              </code>
            </div>
          `;
        }
        updateBlockchainInfo();
      } else {
        alert('Failed to create profile. Username may already exist.');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Error creating profile. Check console for details.');
    }
  });
}

async function loadQuestions() {
  const questionsList = document.getElementById('questions-list');
  if (!questionsList) return;
  
  try {
    // Try to load curriculum data
    const response = await fetch('./assets/curriculum.json');
    if (response.ok) {
      const data = await response.json();
      console.log('Loaded curriculum data:', data);
      
      // Show first few questions
      if (Array.isArray(data) && data.length > 0) {
        const questions = data.slice(0, 5);
        
        questionsList.innerHTML = `
          <h3>AP Statistics Questions</h3>
          <p><strong>${data.length} total questions available</strong></p>
          <h4>Sample Questions:</h4>
          <ul>
            ${questions.map((q: any, idx: number) => `
              <li style="margin: 15px 0; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                <strong>Question ${idx + 1}${q.id ? ` (ID: ${q.id})` : ''}:</strong><br>
                ${(q.prompt || q.text || q.question || 'Question text')?.substring(0, 150)}...<br>
                <small>
                  Type: <span style="color: blue;">${q.type || 'unknown'}</span>
                  ${q.unit ? ` | Unit: ${q.unit}` : ''}
                  ${q.topic ? ` | Topic: ${q.topic}` : ''}
                </small>
              </li>
            `).join('')}
          </ul>
          <p style="color: green;">✓ Questions loaded successfully!</p>
        `;
      } else {
        questionsList.innerHTML = '<p>No questions found in curriculum</p>';
      }
    } else {
      throw new Error(`Could not load curriculum: ${response.status}`);
    }
  } catch (error) {
    console.error('Error loading questions:', error);
    questionsList.innerHTML = '<p style="color: red;">Error loading questions. Check console.</p>';
  }
}

function updateBlockchainInfo() {
  try {
    const info = API.getBlockchainInfo();
    
    const chainInfo = document.getElementById('chain-info');
    if (chainInfo) {
      chainInfo.innerHTML = `
        <div>
          <strong>Blocks:</strong> ${info.blockCount}<br>
          <strong>Latest Hash:</strong> <code>${info.latestBlockHash.substring(0, 20)}...</code><br>
          <strong>Status:</strong> <span style="color: green;">✓ Valid</span>
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