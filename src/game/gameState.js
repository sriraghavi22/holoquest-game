class GameState {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.states = {
      LOADING: 'loading',
      MENU: 'menu',
      PLAYING: 'playing',
      PAUSED: 'paused',
      COMPLETED: 'completed',
      GAME_OVER: 'gameOver'
    };
    
    this.currentState = this.states.LOADING;
    this.previousState = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.pausedTime = 0;
    
    // Game progress tracking
    this.progress = {
      puzzlesSolved: 0,
      totalPuzzles: 0,
      itemsCollected: 0,
      totalItems: 0
    };
    
    // Event callbacks
    this.stateChangeCallbacks = [];
  }

  init(totalPuzzles, totalItems) {
    this.progress.totalPuzzles = totalPuzzles;
    this.progress.totalItems = totalItems;
    this.setState(this.states.MENU);
    return this;
  }

  setState(newState) {
    this.previousState = this.currentState;
    this.currentState = newState;
    
    // Handle state-specific actions
    switch (newState) {
      case this.states.PLAYING:
        if (this.previousState === this.states.LOADING || 
            this.previousState === this.states.MENU) {
          this.startTime = Date.now();
        } else if (this.previousState === this.states.PAUSED) {
          this.pausedTime += (Date.now() - this.pauseStartTime);
        }
        break;
        
      case this.states.PAUSED:
        this.pauseStartTime = Date.now();
        break;
        
      case this.states.COMPLETED:
      case this.states.GAME_OVER:
        this.elapsedTime = this.getElapsedTime();
        break;
    }
    
    // Notify callbacks
    this.stateChangeCallbacks.forEach(callback => {
      callback(this.currentState, this.previousState);
    });
    
    return this;
  }

  onStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
    return this;
  }

  getCurrentState() {
    return this.currentState;
  }

  getElapsedTime() {
    if (this.currentState === this.states.PLAYING) {
      return (Date.now() - this.startTime - this.pausedTime) / 1000;
    }
    return this.elapsedTime;
  }

  puzzleSolved() {
    this.progress.puzzlesSolved++;
    
    // Check if all puzzles are solved
    if (this.progress.puzzlesSolved >= this.progress.totalPuzzles) {
      this.checkGameCompletion();
    }
    
    return this;
  }

  itemCollected() {
    this.progress.itemsCollected++;
    
    // Check if all items are collected
    this.checkGameCompletion();
    
    return this;
  }

  checkGameCompletion() {
    // Game is complete when all puzzles are solved
    if (this.progress.puzzlesSolved >= this.progress.totalPuzzles) {
      this.setState(this.states.COMPLETED);
    }
  }

  getProgress() {
    return {
      ...this.progress,
      percentComplete: Math.floor(
        (this.progress.puzzlesSolved / Math.max(1, this.progress.totalPuzzles)) * 100
      )
    };
  }

  // Save game state to localStorage
  saveGame() {
    const saveData = {
      progress: this.progress,
      elapsedTime: this.getElapsedTime(),
      timestamp: Date.now()
    };
    
    localStorage.setItem('holoquest_savedata', JSON.stringify(saveData));
    return this;
  }

  // Load game state from localStorage
  loadGame() {
    const saveData = localStorage.getItem('holoquest_savedata');
    
    if (saveData) {
      try {
        const parsedData = JSON.parse(saveData);
        this.progress = parsedData.progress;
        this.elapsedTime = parsedData.elapsedTime;
        this.pausedTime = 0;
        this.startTime = Date.now() - (this.elapsedTime * 1000);
        return true;
      } catch (error) {
        console.error('Error loading saved game:', error);
        return false;
      }
    }
    
    return false;
  }

  // Reset game state
  resetGame() {
    this.progress = {
      puzzlesSolved: 0,
      totalPuzzles: this.progress.totalPuzzles,
      itemsCollected: 0,
      totalItems: this.progress.totalItems
    };
    
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.pausedTime = 0;
    
    return this;
  }
}

export { GameState };