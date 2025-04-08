const mongoose = require('mongoose');

const PuzzleMetricsSchema = new mongoose.Schema({
  puzzleId: { type: String, required: true },
  // time: { type: Number, required: true },
  attempts: { type: Number, required: true },
  success: { type: Boolean, default: false }, // Changed default to false
  firstInteraction: { type: Number } // Add to store timestamp
});

const StageMetricsSchema = new mongoose.Schema({
  stageNumber: { type: String, required: true },
  totalStageTime: { type: Number, required: true },
  totalStageAttempts: { type: Number, required: true },
  puzzles: [PuzzleMetricsSchema],
  difficultyRating: { type: Number },
  playerActions: [{ type: String }]
});

const GameSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  cumulativeMetrics: {
    totalTime: { type: Number, required: true },
    totalAttempts: { type: Number, required: true },
    stagesCompleted: { type: Number, required: true },
    averageTimePerStage: { type: Number }, // Add
    averageAttemptsPerPuzzle: { type: Number }, // Add
    overallSuccessRate: { type: Number } // Add
  },
  stageMetrics: [StageMetricsSchema],
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameSession', GameSessionSchema);