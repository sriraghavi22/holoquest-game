// src/game/dqnAgentNode.js
const tf = require('@tensorflow/tfjs');
const fs = require('fs').promises;
const path = require('path');

class DQNAgent {
  constructor() {
    this.model = this.createModel();
    this.targetModel = this.createModel();
    this.updateTargetModel();
    
    this.epsilon = 1.0;
    this.epsilonMin = 0.1;
    this.epsilonDecay = 0.998;
    this.gamma = 0.9;
    
    this.memory = [];
    this.batchSize = 64;
    this.maxMemory = 20000;
    this.learningRate = 0.0001;
    
    this.actionCounts = [0, 0, 0];
    this.trainCounter = 0;
    this.updateFrequency = 5;
  }

  createModel() {
    console.log('[DEBUG] Creating DQN model...');
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({ 
      units: 32, 
      inputShape: [3], 
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }));
    
    // Hidden layers
    model.add(tf.layers.dense({ 
      units: 32, 
      activation: 'relu'
    }));
    
    // Output layer
    model.add(tf.layers.dense({ 
      units: 3, 
      activation: 'linear' 
    }));
    
    model.compile({ 
      optimizer: tf.train.adam(this.learningRate), 
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  updateTargetModel() {
    const weights = this.model.getWeights();
    this.targetModel.setWeights(weights);
    console.log('[DEBUG] Target network updated');
  }

  async train(env, episodes = 1000) {
    console.log('[DEBUG] Starting training for', episodes, 'episodes...');
    
    // Pre-fill memory with demonstrations for each skill level
    await this.pretrainWithDemonstrations(env);
    
    // Action-specific memories for balanced training
    const actionMemories = [[], [], []];
    
    for (let episode = 0; episode < episodes; episode++) {
      // Every 3 episodes, we'll focus on a specific skill level
      const focusSkill = episode % 3;
      
      // Create appropriate state for the focus skill
      let state;
      if (focusSkill === 0) {
        // Beginner-like state
        state = [
          0.6 + Math.random() * 0.3,  // 60-90% time (slow)
          0.6 + Math.random() * 0.3,  // 60-90% attempts (many)
          0.1 + Math.random() * 0.3   // 10-40% success rate (poor)
        ];
      } else if (focusSkill === 1) {
        // Intermediate-like state
        state = [
          0.3 + Math.random() * 0.3,  // 30-60% time (medium)
          0.3 + Math.random() * 0.3,  // 30-60% attempts (medium)
          0.4 + Math.random() * 0.3   // 40-70% success rate (medium)
        ];
      } else {
        // Expert-like state
        state = [
          0.05 + Math.random() * 0.15, // 5-20% time (fast)
          0.05 + Math.random() * 0.15, // 5-20% attempts (few)
          0.7 + Math.random() * 0.3    // 70-100% success rate (high)
        ];
      }
      
      // Force the correct action for this state for demonstration
      let action = focusSkill;
      this.actionCounts[action]++;
      
      // Get reward
      let [nextState, reward, isDone] = env.step(action);
      
      // Store in memory
      const experience = { 
        state, action, reward, nextState, done: isDone,
        priority: 2.0  // High priority for demonstration
      };
      
      this.memory.push(experience);
      actionMemories[action].push(experience);
      
      if (this.memory.length > this.maxMemory) this.memory.shift();
      
      // Training using all memories
      if (this.memory.length >= this.batchSize) {
        await this.trainOnBalancedBatch(actionMemories);
      }
      
      // Regular episode with exploration
      let regularState = env.reset();
      let totalReward = 0;
      let steps = 0;
      let done = false;
      
      while (!done && steps < 3) {
        steps++;
        const stateTensor = tf.tensor2d([regularState]);
        
        // Choose action based on epsilon-greedy
        action = this.getAction(stateTensor);
        this.actionCounts[action]++;
        
        const [nextRegularState, regularReward, nextDone] = env.step(action);
        totalReward += regularReward;
        
        // Store experience
        const regularExp = { 
          state: regularState, 
          action, 
          reward: regularReward, 
          nextState: nextRegularState, 
          done: nextDone,
          priority: 1.0
        };
        
        this.memory.push(regularExp);
        actionMemories[action].push(regularExp);
        
        if (this.memory.length > this.maxMemory) this.memory.shift();
        
        regularState = nextRegularState;
        done = nextDone;
        
        // Train
        if (this.memory.length >= this.batchSize) {
          await this.trainOnBalancedBatch(actionMemories);
        }
        
        stateTensor.dispose();
      }
      
      // Decay epsilon
      this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
      
      // Logging
      if ((episode + 1) % 50 === 0 || episode < 5) {
        const totalActions = this.actionCounts.reduce((sum, count) => sum + count, 0);
        const actionFreq = this.actionCounts.map(count => 
          ((count / Math.max(1, totalActions)) * 100).toFixed(1) + '%'
        );
        
        console.log(`[DEBUG] Episode ${episode + 1}/${episodes}, Reward: ${totalReward.toFixed(2)}, Epsilon: ${this.epsilon.toFixed(2)}`);
        console.log(`[DEBUG] Action distribution: Beginner=${actionFreq[0]}, Intermediate=${actionFreq[1]}, Expert=${actionFreq[2]}`);
      }
      
      // Validation
      if ((episode + 1) % 100 === 0 || episode === episodes - 1) {
        await this.validate(episode + 1);
      }
    }
  }
  
  async pretrainWithDemonstrations(env) {
    console.log('[DEBUG] Pre-filling memory with skill demonstrations');
    
    // Create clear examples for each skill level
    const demonstrations = [
      // Beginner examples (skill level 0)
      { state: [0.7, 0.7, 0.2], action: 0 },
      { state: [0.8, 0.8, 0.3], action: 0 },
      { state: [0.9, 0.7, 0.3], action: 0 },
      { state: [0.75, 0.8, 0.2], action: 0 },
      { state: [0.8, 0.75, 0.25], action: 0 },
      
      // Intermediate examples (skill level 1)
      { state: [0.3, 0.3, 0.6], action: 1 },
      { state: [0.4, 0.4, 0.5], action: 1 },
      { state: [0.35, 0.45, 0.6], action: 1 },
      { state: [0.45, 0.35, 0.55], action: 1 },
      { state: [0.5, 0.4, 0.5], action: 1 },
      
      // Expert examples (skill level 2)
      { state: [0.05, 0.15, 0.9], action: 2 },
      { state: [0.1, 0.1, 0.95], action: 2 },
      { state: [0.07, 0.12, 0.9], action: 2 },
      { state: [0.12, 0.08, 0.95], action: 2 },
      { state: [0.1, 0.15, 0.85], action: 2 }
    ];
    
    // Generate experiences using these demonstrations
    for (const demo of demonstrations) {
      // Repeat each demonstration several times
      for (let i = 0; i < 30; i++) {
        const [nextState, reward, done] = env.step(demo.action);
        
        this.memory.push({
          state: demo.state,
          action: demo.action,
          reward,
          nextState,
          done,
          priority: 3.0 // Very high priority for demonstrations
        });
      }
    }
    
    // Pre-train the model on these demonstrations
    for (let i = 0; i < 10; i++) {
      await this.replay(this.memory);
      console.log(`[DEBUG] Pre-training batch ${i+1}/10`);
    }
    
    console.log(`[DEBUG] Pre-trained on ${this.memory.length} demonstration experiences`);
  }

  getAction(stateTensor) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 3);
    }
    
    const qValues = this.model.predict(stateTensor);
    const qValuesArray = qValues.arraySync()[0];
    const action = qValues.argMax(1).dataSync()[0];
    
    if (Math.random() < 0.05) {
      console.log('[DEBUG] Q-values:', qValuesArray.map(x => x.toFixed(2)), '-> Action:', action);
    }
    
    qValues.dispose();
    return action;
  }

  async replay(memorySubset) {
    if (memorySubset.length < 10) return;
    
    // Sample from memory based on priority
    const batch = [];
    const totalPriority = memorySubset.reduce((sum, exp) => sum + exp.priority, 0);
    
    while (batch.length < this.batchSize && batch.length < memorySubset.length) {
      let value = Math.random() * totalPriority;
      let cumSum = 0;
      
      for (let i = 0; i < memorySubset.length; i++) {
        cumSum += memorySubset[i].priority;
        if (cumSum > value) {
          batch.push(memorySubset[i]);
          break;
        }
      }
    }
    
    // Prepare training data
    const states = tf.tensor2d(batch.map(b => b.state));
    const nextStates = tf.tensor2d(batch.map(b => b.nextState));
    
    // Use target network for more stable Q-values
    const qValues = this.model.predict(states);
    const qValuesData = qValues.arraySync();
    
    const nextQValues = this.targetModel.predict(nextStates);
    const nextQValuesData = nextQValues.arraySync();
    
    // Create training targets
    const targets = [...qValuesData];
    
    batch.forEach((exp, i) => {
      if (exp.done) {
        targets[i][exp.action] = exp.reward;
      } else {
        const nextMaxQ = Math.max(...nextQValuesData[i]);
        targets[i][exp.action] = exp.reward + this.gamma * nextMaxQ;
      }
    });
    
    // Train
    const targetsTensor = tf.tensor2d(targets);
    
    await this.model.fit(states, targetsTensor, { 
      epochs: 1, 
      batchSize: batch.length,
      verbose: 0 
    });
    
    // Update target network periodically
    this.trainCounter++;
    if (this.trainCounter % this.updateFrequency === 0) {
      this.updateTargetModel();
    }
    
    // Clean up tensors
    states.dispose();
    nextStates.dispose();
    qValues.dispose();
    nextQValues.dispose();
    targetsTensor.dispose();
  }

  async trainOnBalancedBatch(actionMemories) {
    // Create separate batches for each action
    for (let action = 0; action < 3; action++) {
      if (actionMemories[action].length >= 10) {
        await this.replay(actionMemories[action]);
        
        // Log less frequently to avoid spam
        if (this.trainCounter % 20 === 0) {
          console.log(`[DEBUG] Trained on batch for action ${action}`);
        }
      }
    }
    
    // Also occasionally train on entire memory for robustness
    if (this.trainCounter % 10 === 0) {
      await this.replay(this.memory);
    }
  }

  async validate(episode) {
    const testCases = [
      // Core test cases
      { state: [0.067, 0.167, 0.950], label: "Expert", expected: 2 },
      { state: [0.333, 0.333, 0.600], label: "Intermediate", expected: 1 },
      { state: [0.667, 0.667, 0.300], label: "Beginner", expected: 0 },
      
      // Edge cases
      { state: [0.100, 0.167, 0.900], label: "Expert+", expected: 2 },
      { state: [0.250, 0.250, 0.700], label: "Expert-", expected: 2 },
      { state: [0.400, 0.417, 0.500], label: "Intermediate+", expected: 1 },
      { state: [0.500, 0.500, 0.400], label: "Intermediate-", expected: 1 },
      { state: [0.800, 0.750, 0.200], label: "Beginner+", expected: 0 },
      { state: [0.600, 0.600, 0.400], label: "Beginner-", expected: 0 },
    ];

    console.log(`[DEBUG] Validation at episode ${episode}:`);
    
    let correctCount = 0;
    
    for (const test of testCases) {
      const stateTensor = tf.tensor2d([test.state]);
      const qValues = this.model.predict(stateTensor);
      const qValuesArray = qValues.arraySync()[0].map(x => x.toFixed(2));
      const action = qValues.argMax(1).dataSync()[0];
      const result = action === test.expected ? "✓" : "✗";
      
      if (action === test.expected) {
        correctCount++;
      }
      
      console.log(`  ${test.label.padEnd(15)}: [${test.state.map(x => x.toFixed(3)).join(', ')}], Q:[${qValuesArray.join(', ')}], Pred:${action}, Exp:${test.expected} ${result}`);
      
      stateTensor.dispose();
      qValues.dispose();
    }
    
    const accuracy = (correctCount / testCases.length * 100).toFixed(1);
    console.log(`  Validation accuracy: ${accuracy}% (${correctCount}/${testCases.length})`);
  }

  async saveModel() {
    const saveDir = path.join(__dirname, '..', 'models', 'dqn-skill-model');
    try {
      await fs.mkdir(saveDir, { recursive: true });

      const modelJson = {
        modelTopology: this.model.toJSON(null, false),
        weightsManifest: [
          {
            paths: ['weights.bin'],
            weights: this.model.weights.map(w => ({
              name: w.name,
              shape: w.shape,
              dtype: 'float32'
            }))
          }
        ],
        format: 'layers-model',
        generatedBy: `tensorflow.js v${tf.version.tfjs}`,
        convertedBy: null
      };

      const topologyPath = path.join(saveDir, 'model.json');
      await fs.writeFile(topologyPath, JSON.stringify(modelJson, null, 2));
      console.log(`[DEBUG] Model topology saved to ${topologyPath}`);

      const weights = this.model.getWeights();
      const weightData = [];
      for (let i = 0; i < weights.length; i++) {
        const data = await weights[i].data();
        weightData.push(...data);
      }
      const weightsBuffer = Buffer.from(new Float32Array(weightData).buffer);
      const weightsPath = path.join(saveDir, 'weights.bin');
      await fs.writeFile(weightsPath, weightsBuffer);
      console.log(`[DEBUG] Model weights saved to ${weightsPath}`);

      weights.forEach(w => w.dispose());
      console.log(`[DEBUG] DQN model saved to ${saveDir}`);
    } catch (e) {
      console.error('[ERROR] Failed to save DQN model:', e.message);
    }
  }
}

module.exports = DQNAgent;