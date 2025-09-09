/**
 * Main Application Entry Point
 * Initializes both backend and UI components
 */

import { initialize as initBackend } from './index';

// Import UI controller (we'll create a simplified version if needed)
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

  // Create a simple interface to get started
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
  loadQuestions();
  
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
      // Import the API from index.ts
      const { API } = await import('./index');
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
  try {
    // Try to load curriculum data
    const response = await fetch('./assets/curriculum.json');
    if (response.ok) {
      const data = await response.json();
      const questionsList = document.getElementById('questions-list');
      if (questionsList && data.units && data.units.length > 0) {
        // Show first few questions
        const firstUnit = data.units[0];
        const firstTopic = firstUnit.topics?.[0];
        const questions = firstTopic?.questions?.slice(0, 3) || [];
        
        questionsList.innerHTML = `
          <h3>${firstUnit.title}</h3>
          <p>${firstTopic?.title || 'Topic'}</p>
          <ul>
            ${questions.map((q: any) => `
              <li style="margin: 10px 0;">
                <strong>Q${q.id}:</strong> ${q.prompt?.substring(0, 100)}...
                <br><small>Type: ${q.type}</small>
              </li>
            `).join('')}
          </ul>
          <p><em>${data.units.length} units, ${data.units.reduce((sum: number, u: any) => 
            sum + (u.topics?.reduce((tSum: number, t: any) => 
              tSum + (t.questions?.length || 0), 0) || 0), 0)} total questions available</em></p>
        `;
      }
    } else {
      throw new Error('Could not load curriculum');
    }
  } catch (error) {
    console.error('Error loading questions:', error);
    const questionsList = document.getElementById('questions-list');
    if (questionsList) {
      questionsList.innerHTML = '<p style="color: red;">Error loading questions. Check console.</p>';
    }
  }
}

async function updateBlockchainInfo() {
  try {
    const { API } = await import('./index');
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

// Start the app when DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', startApp);
}