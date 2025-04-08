// src/game/dqnAgentBrowser.js
const tf = require('@tensorflow/tfjs');

class DQNAgent {
  constructor() {
    this.model = null;
  }

  async loadModelFromURL(url) {
    try {
      this.model = await tf.loadLayersModel(url);
      console.log('[DEBUG] DQN model loaded from URL');
    } catch (e) {
      console.error('[DEBUG] Failed to load DQN model from URL', e.message);
      throw e;
    }
  }

  getAction(stateTensor) {
    if (!this.model) {
      console.error('[DEBUG] Model not loaded, defaulting to Intermediate');
      return 1;
    }
    
    const qValues = this.model.predict(stateTensor);
    const action = qValues.argMax(1).dataSync()[0];
    qValues.dispose();
    return action;
  }

  predictSkillLevel(metrics) {
    if (!this.model) {
      console.log('[DEBUG] Model not loaded, returning default skill level');
      return 'Intermediate';
    }
    
    // Extract metrics
    const avgTime = metrics.avgTimePerStage || 40; 
    const avgAttempts = metrics.avgAttemptsPerPuzzle || 2.5;
    const successRate = metrics.overallSuccessRate || 0.5;
    
    console.log('[DEBUG] Player metrics:');
    console.log(`  Time: ${avgTime.toFixed(1)}s`);
    console.log(`  Attempts: ${avgAttempts.toFixed(1)}`);
    console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`);
    
    // ======= PRIORITY RULE-BASED SYSTEM =======
    // This addresses the model bias toward Intermediate by using clear rules
    
    // 1. Expert Rules
    if (avgTime < 20 && avgAttempts <= 1.5 && successRate >= 0.8) {
      console.log('[DEBUG] Rule-based classification: EXPERT');
      console.log('  Reason: Fast time, few attempts, high success rate');
      return 'Expert';
    }
    
    // 2. Beginner Rules - Primary issue to fix
    if (avgTime > 80 || (avgAttempts >= 4 && avgTime > 60)) {
      console.log('[DEBUG] Rule-based classification: BEGINNER');
      console.log('  Reason: Very slow time or many attempts with slow time');
      return 'Beginner';
    }
    
    // 3. Use model for less clear cases
    // Normalize state
    const state = [
      Math.min(1, avgTime / 150),
      Math.min(1, avgAttempts / 6),
      Math.min(1, Math.max(0, successRate))
    ];
    
    console.log('[DEBUG] Normalized state:', 
      `[${state[0].toFixed(3)}, ${state[1].toFixed(3)}, ${state[2].toFixed(3)}]`
    );
    
    // Get model prediction
    const stateTensor = tf.tensor2d([state]);
    const qValues = this.model.predict(stateTensor);
    const qValuesArray = qValues.arraySync()[0];
    const action = qValues.argMax(1).dataSync()[0];
    
    // Convert to skill name
    const skillNames = ['Beginner', 'Intermediate', 'Expert'];
    let prediction = skillNames[action];
    
    // Post-process model prediction
    // If the model predicts Intermediate but metrics suggest Beginner
    if (prediction === 'Intermediate' && (avgTime > 60 || avgAttempts >= 3.5)) {
      // Check if Beginner Q-value is reasonably close to Intermediate
      const beginnerQValue = qValuesArray[0];
      const intermediateQValue = qValuesArray[1];
      
      if (beginnerQValue > 15 && beginnerQValue > (intermediateQValue * 0.7)) {
        prediction = 'Beginner';
        console.log('[DEBUG] Overriding to Beginner based on metrics and Q-values');
      }
    }
    
    console.log('[DEBUG] Model prediction:');
    console.log(`  Q-values: Beginner=${qValuesArray[0].toFixed(2)}, Intermediate=${qValuesArray[1].toFixed(2)}, Expert=${qValuesArray[2].toFixed(2)}`);
    console.log(`  Final prediction: ${prediction}`);
    
    // Clean up
    stateTensor.dispose();
    qValues.dispose();
    
    return prediction;
  }
}

module.exports = DQNAgent;