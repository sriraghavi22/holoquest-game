// src/trainDQN.js
const tf = require('@tensorflow/tfjs');
const DQNAgent = require('./game/dqnAgentNode');

// Updated SkillEnv class with expert-focused rewards
// Updated SkillEnv with balanced rewards
class SkillEnv {
  constructor() {
    this.reset();
  }

  reset() {
    this.time = 0;
    this.attempts = 0;
    this.successes = 0;
    this.puzzles = 3;
    this.stageComplete = false;
    return this.getStateVector();
  }

  getStateVector() {
    const avgTime = this.time / Math.max(1, this.puzzles);
    const avgAttempts = this.attempts / Math.max(1, this.puzzles);
    const successRate = this.successes / this.puzzles;
    
    return [
      Math.max(0, Math.min(1, avgTime / 150)),
      Math.max(0, Math.min(1, avgAttempts / 6)),
      Math.max(0, Math.min(1, successRate))
    ];
  }

  step(action) {
    let timeIncrement, attemptIncrement, success, reward;

    // Calculate state vector before applying action effects
    const stateVector = this.getStateVector();
    const time = stateVector[0]; // Normalized time [0-1]
    const attempts = stateVector[1]; // Normalized attempts [0-1]
    const successRate = stateVector[2]; // [0-1]
    
    // Determine if action matches state - using clear boundaries
    let isCorrectAction = false;

    if (action === 0) { // Beginner
      // CLEAR BEGINNER: high time (>0.5), high attempts (>0.5), low success (<0.4)
      isCorrectAction = (time > 0.5 && attempts > 0.5);
      
      // Simulate beginner performance
      timeIncrement = Math.random() * 40 + 80; // 80-120s
      attemptIncrement = Math.floor(Math.random() * 2) + 4; // 4-5 attempts
      success = Math.random() < 0.3; // 30% success
      
      // Reward structure
      if (isCorrectAction) {
        reward = 20; // High reward for correct classification
      } else if (time < 0.2 && attempts < 0.2) {
        reward = -20; // Severe penalty for misclassifying expert as beginner
      } else {
        reward = -5; // Small penalty for other misclassifications
      }
    } 
    else if (action === 1) { // Intermediate
      // CLEAR INTERMEDIATE: mid time (0.2-0.6), mid attempts (0.2-0.6)
      isCorrectAction = (time >= 0.2 && time <= 0.6 && attempts >= 0.2 && attempts <= 0.6);
      
      // Simulate intermediate performance
      timeIncrement = Math.random() * 20 + 40; // 40-60s
      attemptIncrement = Math.floor(Math.random() * 1) + 2; // 2-3 attempts
      success = Math.random() < 0.7; // 70% success
      
      // Reward structure
      if (isCorrectAction) {
        reward = 20; // High reward for correct classification
      } else {
        reward = -5; // Small penalty for misclassification
      }
    } 
    else { // Expert (action === 2)
      // CLEAR EXPERT: low time (<0.2), low attempts (<0.2), high success (>0.8)
      isCorrectAction = (time < 0.2 && attempts < 0.2 && successRate > 0.7);
      
      // Simulate expert performance
      timeIncrement = Math.random() * 10 + 5; // 5-15s
      attemptIncrement = 1; // Always 1 attempt
      success = Math.random() < 0.9; // 90% success
      
      // Reward structure
      if (isCorrectAction) {
        reward = 20; // High reward for correct classification
      } else if (time > 0.5 || attempts > 0.5) {
        reward = -20; // Severe penalty for misclassifying beginner as expert
      } else {
        reward = -5; // Small penalty for other misclassifications
      }
    }

    // Update environment state
    this.time += timeIncrement;
    this.attempts += attemptIncrement;
    if (success) this.successes++;
    this.stageComplete = this.successes >= this.puzzles;

    if (Math.random() < 0.05) { // Log 5% of steps
      const skillNames = ['Beginner', 'Intermediate', 'Expert'];
      console.log(`[DEBUG] Step - Action: ${skillNames[action]}, ` +
        `State: [${stateVector.map(v => v.toFixed(2)).join(', ')}], ` +
        `Correct: ${isCorrectAction}, Reward: ${reward.toFixed(2)}`);
    }

    return [this.getStateVector(), reward, this.stageComplete];
  }
}

async function trainDQN() {
  const env = new SkillEnv();
  const agent = new DQNAgent();
  await agent.train(env, 1000); // Train for 1000 episodes for better convergence
  await agent.saveModel(); // Explicitly save the model
}

trainDQN().catch(console.error);