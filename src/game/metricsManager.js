// src/game/metricsManager.js
const tf = require('@tensorflow/tfjs');
const { eventBus } = require('./eventBus');
const { v4: uuidv4 } = require('uuid');

class MetricsManager {
  constructor() {
    this.playerMetrics = {
      sessionId: uuidv4(),
      cumulativeMetrics: { totalTime: 0, totalAttempts: 0, stagesCompleted: 0 },
      stageMetrics: [],
      skillHistory: [],
    };
    this.currentStage = null;
    this.puzzleInteractions = {};
    this.dqnAgent = null;
    this.modelLoaded = this.loadDQNModel();
    this.completedStages = new Set();

    this.startStage = this.startStage.bind(this);
    this.trackPuzzle = this.trackPuzzle.bind(this);
    this.completeStage = this.completeStage.bind(this);
    this.trackPlayerAction = this.trackPlayerAction.bind(this);

    eventBus.on('stageStarted', this.startStage);
    eventBus.on('puzzleInteracted', this.trackPuzzle);
    eventBus.on('stageCompleted', this.completeStage);
    eventBus.on('game:restart', this.resetMetrics.bind(this));
    eventBus.on('object:interaction', this.trackPlayerAction);
  }

  async loadDQNModel() {
    try {
      console.log('[DEBUG] Starting to load DQN model from http://localhost:8081/models/dqn-skill-model/model.json');
      const DQNAgent = require('./dqnAgentBrowser');
      this.dqnAgent = new DQNAgent();
      await this.dqnAgent.loadModelFromURL('http://localhost:8081/models/dqn-skill-model/model.json');
      console.log('[DEBUG] DQN model loaded successfully');
    } catch (e) {
      console.error('[DEBUG] Failed to load DQN model:', e.message);
      console.error('[DEBUG] Full error:', e);
    }
  }

  extractLevelName(levelData) {
    if (typeof levelData === 'object' && levelData !== null) {
      return Object.keys(levelData)
        .filter((key) => key !== '_timestamp')
        .map((key) => levelData[key])
        .join('');
    }
    return typeof levelData === 'string' ? levelData : String(levelData || 'unknown');
  }

  startStage(levelId) {
    const levelName = this.extractLevelName(levelId);
    if (this.currentStage) {
      console.log('[DEBUG] Previous stage not completed, finishing it first');
      this.completeStage(levelId);
    }
    this.currentStage = {
      stageNumber: levelName,
      totalStageTime: 0,
      totalStageAttempts: 0,
      puzzles: [],
      difficultyRating: null,
      playerActions: [],
    };
    this.puzzleInteractions = {};
    console.log(`[DEBUG] Stage initialized - stageNumber: ${levelName}`);
  }

  trackPuzzle({ id, success }) {
    const now = Date.now();
    if (!this.currentStage) {
      console.log('[DEBUG] No active stage - ignoring puzzle interaction');
      return;
    }

    let puzzle = this.currentStage.puzzles.find((p) => p.puzzleId === id);
    if (!puzzle) {
      puzzle = {
        puzzleId: id,
        attempts: 0,
        success: false,
        firstInteraction: now,
      };
      this.currentStage.puzzles.push(puzzle);
      this.puzzleInteractions[id] = [{ timestamp: now, success: false }];
      console.log(`[DEBUG] Started tracking puzzle ${id} at ${new Date(now).toISOString()}`);
    }

    puzzle.attempts++;
    this.currentStage.totalStageAttempts++;
    this.puzzleInteractions[id].push({ timestamp: now, success });

    if (success && !puzzle.success) {
      puzzle.success = true;
      console.log(`[DEBUG] Puzzle ${id} solved, attempts: ${puzzle.attempts}`);
    } else if (!success) {
      console.log(`[DEBUG] Puzzle ${id} attempted, attempts: ${puzzle.attempts}`);
    }
  }

  trackPlayerAction({ id, type }) {
    if (!this.currentStage) return;
    const now = Date.now();
    const action = `Interacted with ${id} (${type}) at ${new Date(now).toISOString()}`;
    this.currentStage.playerActions.push(action);
    console.log(`[DEBUG] Player action recorded: ${action}`);
  }

  async completeStage(currentLevelId) {
    if (!this.currentStage) {
      console.log('[DEBUG] No active stage - ignoring completion');
      return;
    }

    const levelName = this.extractLevelName(currentLevelId);
    if (this.completedStages.has(levelName)) {
      console.log(`[DEBUG] Stage ${levelName} already completed, ignoring duplicate`);
      this.currentStage = null;
      return;
    }

    const timerElement = document.getElementById('timer');
    const timerText = timerElement ? timerElement.textContent : '00:00';
    const [minutes, seconds] = timerText.split(':').map(Number);
    this.currentStage.totalStageTime = minutes * 60 + seconds;

    this.playerMetrics.cumulativeMetrics.totalTime += this.currentStage.totalStageTime;
    this.playerMetrics.cumulativeMetrics.totalAttempts += this.currentStage.totalStageAttempts;
    this.playerMetrics.cumulativeMetrics.stagesCompleted++;

    const totalPuzzles = this.currentStage.puzzles.length;
    const successCount = this.currentStage.puzzles.filter((p) => p.success).length;
    const failedAttempts = this.currentStage.totalStageAttempts - successCount;
    const maxReasonableTime = 60;
    this.currentStage.difficultyRating = Math.min(
      1,
      (this.currentStage.totalStageTime / maxReasonableTime) * (1 + Math.min(1, failedAttempts / totalPuzzles))
    );

    this.playerMetrics.stageMetrics.push({ ...this.currentStage });
    this.completedStages.add(levelName);

    await this.modelLoaded;
    const skillLevel = await this.getSkillLevel();
    const skillObject = {
      skillLevel,
      timestamp: new Date().toISOString(),
      levelId: levelName,
    };
    this.playerMetrics.skillHistory.push(skillObject);

    console.log(`[DEBUG] Stage ${levelName} completed:`, JSON.stringify(this.currentStage, null, 2));
    console.log(`[DEBUG] DQN predicted skill level: ${skillLevel} for ${levelName}`);
    console.log('[DEBUG] Skill history updated:', this.playerMetrics.skillHistory);

    this.saveMetrics();
    eventBus.emit('skillLevelUpdated', skillObject);

    this.currentStage = null;
    this.puzzleInteractions = {};
  }

  async getSkillLevel() {
    if (!this.dqnAgent) {
      console.log('[DEBUG] DQN agent not initialized, using default skill');
      return 'Intermediate';
    }

    await this.modelLoaded;
    if (!this.dqnAgent.model) {
      console.log('[DEBUG] Model still not loaded after await, using default skill');
      return 'Intermediate';
    }

    const { totalTime, totalAttempts, stagesCompleted } = this.playerMetrics.cumulativeMetrics;
    const totalPuzzles = this.playerMetrics.stageMetrics.reduce((acc, s) => acc + s.puzzles.length, 0) || 1;
    const metrics = {
      avgTimePerStage: stagesCompleted > 0 ? totalTime / stagesCompleted : 40,
      avgAttemptsPerPuzzle: totalPuzzles > 0 ? totalAttempts / totalPuzzles : 2.5,
      overallSuccessRate: totalPuzzles > 0 
        ? this.playerMetrics.stageMetrics.reduce((acc, s) => acc + s.puzzles.filter(p => p.success).length, 0) / totalPuzzles 
        : 0.5
    };

    console.log('[DEBUG] Metrics for DQN prediction:', metrics);
    return this.dqnAgent.predictSkillLevel(metrics);
  }

  getLatestSkillObject() {
    const latest = this.playerMetrics.skillHistory[this.playerMetrics.skillHistory.length - 1];
    return latest || { skillLevel: 'Beginner', timestamp: new Date().toISOString(), levelId: 'initial' };
  }

  async saveMetrics() {
    const dataToSave = {
      sessionId: this.playerMetrics.sessionId,
      cumulativeMetrics: {
        totalTime: this.playerMetrics.cumulativeMetrics.totalTime,
        totalAttempts: this.playerMetrics.cumulativeMetrics.totalAttempts,
        stagesCompleted: this.playerMetrics.cumulativeMetrics.stagesCompleted,
        averageTimePerStage:
          this.playerMetrics.cumulativeMetrics.stagesCompleted > 0
            ? this.playerMetrics.cumulativeMetrics.totalTime / this.playerMetrics.cumulativeMetrics.stagesCompleted
            : 0,
        averageAttemptsPerPuzzle:
          this.playerMetrics.stageMetrics.reduce((acc, stage) => acc + stage.puzzles.length, 0) > 0
            ? this.playerMetrics.cumulativeMetrics.totalAttempts /
              this.playerMetrics.stageMetrics.reduce((acc, stage) => acc + stage.puzzles.length, 0)
            : 0,
        overallSuccessRate:
          this.playerMetrics.stageMetrics.reduce((acc, stage) => acc + stage.puzzles.filter((p) => p.success).length, 0) /
            this.playerMetrics.stageMetrics.reduce((acc, stage) => acc + stage.puzzles.length, 0) || 0,
      },
      stageMetrics: this.playerMetrics.stageMetrics,
      skillHistory: this.playerMetrics.skillHistory,
    };

    console.log('[DEBUG] Sending metrics to backend:', JSON.stringify(dataToSave, null, 2));
    try {
      const response = await fetch('http://localhost:3000/api/save-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      console.log('[DEBUG] Metrics saved to backend:', result);
    } catch (err) {
      console.error('[DEBUG] Error saving metrics:', err.message);
    }
  }

  resetMetrics() {
    this.playerMetrics = {
      sessionId: uuidv4(),
      cumulativeMetrics: { totalTime: 0, totalAttempts: 0, stagesCompleted: 0 },
      stageMetrics: [],
      skillHistory: [],
    };
    this.currentStage = null;
    this.puzzleInteractions = {};
    this.completedStages.clear();
    console.log('[DEBUG] Metrics reset');
  }
}

module.exports = new MetricsManager();