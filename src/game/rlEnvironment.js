// src/game/rlEnvironment.js
class RLEnvironment {
    constructor() {
      this.reset();
    }
  
    reset() {
      // Initial state: typical new player metrics
      this.state = {
        avgTimePerStage: 40, // Seconds
        avgAttemptsPerPuzzle: 2.5,
        overallSuccessRate: 0.5
      };
      this.stepCount = 0;
      return this.state;
    }
  
    step(action) {
      // Action: 0 = Beginner, 1 = Intermediate, 2 = Expert
      const difficulty = ['Beginner', 'Intermediate', 'Expert'][action];
      
      // Simulate player response (adjust based on your game’s typical outcomes)
      let nextTime, nextAttempts, nextSuccess;
      switch (difficulty) {
        case 'Beginner':
          nextTime = Math.max(10, this.state.avgTimePerStage * 0.8); // Easier = faster
          nextAttempts = Math.max(1, this.state.avgAttemptsPerPuzzle * 0.7);
          nextSuccess = Math.min(1, this.state.overallSuccessRate + 0.2);
          break;
        case 'Intermediate':
          nextTime = this.state.avgTimePerStage;
          nextAttempts = this.state.avgAttemptsPerPuzzle;
          nextSuccess = this.state.overallSuccessRate;
          break;
        case 'Expert':
          nextTime = this.state.avgTimePerStage * 1.2; // Harder = slower
          nextAttempts = this.state.avgAttemptsPerPuzzle * 1.3;
          nextSuccess = Math.max(0, this.state.overallSuccessRate - 0.1);
          break;
      }
  
      // Update state
      this.state = {
        avgTimePerStage: nextTime,
        avgAttemptsPerPuzzle: nextAttempts,
        overallSuccessRate: nextSuccess
      };
  
      // Reward: Encourage balanced difficulty (20-40s completion, moderate attempts)
      const timeReward = nextTime < 20 ? 0.5 : nextTime <= 40 ? 1 : 0.7;
      const attemptReward = nextAttempts < 1.5 ? 1 : nextAttempts <= 2.5 ? 0.8 : 0.6;
      const successReward = nextSuccess > 0.8 ? 1 : nextSuccess >= 0.5 ? 0.8 : 0.6;
      const reward = (timeReward + attemptReward + successReward) / 3;
  
      this.stepCount++;
      const done = this.stepCount >= 10; // Simulate 10 stages
      return [this.state, reward, done];
    }
  
    getStateVector() {
      return [
        this.state.avgTimePerStage / 100, // Normalize to 0-1
        this.state.avgAttemptsPerPuzzle / 5,
        this.state.overallSuccessRate
      ];
    }
  }
  
  module.exports = RLEnvironment;