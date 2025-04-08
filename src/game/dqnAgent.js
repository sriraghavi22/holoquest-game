// src/game/dqnAgent.js
const tf = require('@tensorflow/tfjs');
const fs = require('fs').promises;
const path = require('path');

class DQNAgent {
  constructor() {
    this.model = this.createModel();
    this.epsilon = 1.0;
    this.epsilonMin = 0.01;
    this.epsilonDecay = 0.995;
    this.gamma = 0.95;
    this.memory = [];
    this.batchSize = 32;
    this.maxMemory = 1000;
  }

  createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, inputShape: [3], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'linear' }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    return model;
  }

  async train(env, episodes = 100) {
    for (let episode = 0; episode < episodes; episode++) {
      let state = env.reset();
      let totalReward = 0;
      let done = false;

      while (!done) {
        const stateTensor = tf.tensor2d([env.getStateVector()]);
        const action = this.getAction(stateTensor);
        
        const [nextState, reward, nextDone] = env.step(action);
        totalReward += reward;

        this.memory.push({ 
          state: env.getStateVector(), 
          action, 
          reward, 
          nextState: env.getStateVector(), 
          done: nextDone 
        });
        if (this.memory.length > this.maxMemory) this.memory.shift();

        state = nextState;
        done = nextDone;

        if (this.memory.length >= this.batchSize) {
          await this.replay();
        }
        stateTensor.dispose();
      }

      this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
      console.log(`Episode ${episode + 1}/${episodes}, Reward: ${totalReward.toFixed(2)}, Epsilon: ${this.epsilon.toFixed(3)}`);
    }
    await this.saveModel();
  }

  getAction(stateTensor) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 3);
    }
    const qValues = this.model.predict(stateTensor);
    const action = qValues.argMax(1).dataSync()[0];
    qValues.dispose();
    return action;
  }

  async replay() {
    const batch = this.memory.sort(() => 0.5 - Math.random()).slice(0, this.batchSize);
    const states = tf.tensor2d(batch.map(b => b.state));
    const nextStates = tf.tensor2d(batch.map(b => b.nextState));
    
    const qValues = this.model.predict(states);
    const nextQValues = this.model.predict(nextStates);
    
    const targets = qValues.arraySync();
    batch.forEach((sample, i) => {
      const { action, reward, done } = sample;
      targets[i][action] = done ? reward : reward + this.gamma * Math.max(...nextQValues.arraySync()[i]);
    });

    await this.model.fit(states, tf.tensor2d(targets), { epochs: 1, verbose: 0 });
    states.dispose();
    nextStates.dispose();
    qValues.dispose();
    nextQValues.dispose();
  }

  async saveModel() {
    const saveDir = path.join(__dirname, '..', 'models', 'dqn-skill-model');
    try {
      // Ensure directory exists
      await fs.mkdir(saveDir, { recursive: true });

      // Save model topology as JSON
      const modelTopology = this.model.toJSON(null, false);
      const topologyPath = path.join(saveDir, 'model.json');
      await fs.writeFile(topologyPath, JSON.stringify(modelTopology, null, 2));
      console.log(`[DEBUG] Model topology saved to ${topologyPath}`);

      // Save weights manually
      const weights = this.model.getWeights(); // Array of tf.Tensor
      const weightData = [];
      for (let i = 0; i < weights.length; i++) {
        const data = await weights[i].data(); // Get Float32Array
        weightData.push(...data); // Flatten into single array
        weights[i].dispose(); // Clean up
      }
      const weightsBuffer = Buffer.from(new Float32Array(weightData).buffer);
      const weightsPath = path.join(saveDir, 'weights.bin');
      await fs.writeFile(weightsPath, weightsBuffer);
      console.log(`[DEBUG] Model weights saved to ${weightsPath}`);

      console.log(`[DEBUG] DQN model saved to ${saveDir}`);
    } catch (e) {
      console.error('[ERROR] Failed to save DQN model', e.message);
    }
  }

  async loadModel() {
    try {
      const loadDir = path.join(__dirname, '..', 'models', 'dqn-skill-model');
      const topologyPath = path.join(loadDir, 'model.json');
      const weightsPath = path.join(loadDir, 'weights.bin');

      // Load topology
      const topologyJson = await fs.readFile(topologyPath, 'utf8');
      this.model = await tf.models.modelFromJSON(JSON.parse(topologyJson));
      console.log('[DEBUG] Model topology loaded from filesystem');

      // Load weights
      const weightsBuffer = await fs.readFile(weightsPath);
      const weightData = new Float32Array(weightsBuffer.buffer);
      const weightsSpec = this.model.weights.map(w => w.shape); // Get expected shapes
      let offset = 0;
      const weightTensors = [];
      for (const shape of weightsSpec) {
        const size = tf.util.sizeFromShape(shape);
        const values = weightData.slice(offset, offset + size);
        weightTensors.push(tf.tensor(values, shape));
        offset += size;
      }
      this.model.setWeights(weightTensors);
      weightTensors.forEach(t => t.dispose()); // Clean up
      console.log('[DEBUG] Model weights loaded from filesystem');

      this.epsilon = 0;
      console.log('[DEBUG] DQN model fully loaded from filesystem');
    } catch (e) {
      console.log('[DEBUG] No saved DQN model found, using untrained model', e.message);
    }
  }

  async loadModelFromURL(url) {
    try {
      this.model = await tf.loadLayersModel(url);
      this.epsilon = 0;
      console.log('[DEBUG] DQN model loaded from URL');
    } catch (e) {
      console.log('[DEBUG] Failed to load DQN model from URL', e.message);
    }
  }

  predictSkillLevel(metrics) {
    const state = [
      (metrics.avgTimePerStage || 40) / 100,
      (metrics.avgAttemptsPerPuzzle || 2.5) / 5,
      metrics.overallSuccessRate || 0.5
    ];
    const stateTensor = tf.tensor2d([state]);
    const action = this.getAction(stateTensor);
    stateTensor.dispose();
    return ['Beginner', 'Intermediate', 'Expert'][action];
  }
}

module.exports = DQNAgent;