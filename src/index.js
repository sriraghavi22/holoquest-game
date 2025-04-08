import { GameState } from './game/gameState';
import { SceneManager } from './scene/scene';
import { ControlManager } from './controls/controlManager';
import { UIManager } from './ui/uiManager';
import { eventBus } from './game/eventBus';
import MetricsManager from './game/metricsManager.js';
import { LevelManager } from './scene/levelManager';
import { InteractionSystem } from './game/interactions.js';

class HoloQuest {
  constructor() {
    this.eventBus = eventBus;
    this.showLoadingScreen();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeGame());
    } else {
      this.initializeGame();
    }
  }

  async initializeGame() {
    try {
      this.gameState = new GameState(this.eventBus);
      this.gameState.init(5, 10);
  
      this.sceneManager = new SceneManager(this.eventBus);
  
      this.uiManager = new UIManager(this.eventBus);
      this.uiManager.init();
  
      this.interactionSystem = new InteractionSystem(this.sceneManager.camera, this.sceneManager.scene);
      await this.interactionSystem.init();
  
      this.controlManager = new ControlManager(
        this.eventBus,
        this.sceneManager.camera,
        this.sceneManager.renderer.domElement,
        this.interactionSystem
      );
      await this.controlManager.init();
  
      this.sceneManager.eventBus.on('scene:ready', () => {
        this.interactionSystem.setInteractiveObjects(this.sceneManager.getInteractiveObjects());
      });
  
      this.setupEventListeners();
      this.updateButtonVisibility();
  
      // Ensure cursor is unlocked at startup (menu state)
      this.controlManager.releasePointerLock();
  
      this.hideLoadingScreen();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      this.showErrorScreen(error);
    }
  }

  async startLevel(levelId) {
    console.log(`[DEBUG] Starting level: ${levelId}`);
    const loadingMessage = levelId === 'scholarsLibrary' 
      ? 'Entering the Scholar’s Library...' 
      : `Loading ${levelId}...`;
    this.showLoadingScreen(loadingMessage);
  
    await new Promise(resolve => setTimeout(resolve, 0));
    await this.sceneManager.loadLevel(levelId);
  
    this.controlManager.enableControls();
    this.sceneManager.startRenderLoop();
  
    this.startGameLoop();
  
    console.log(`[DEBUG] Hiding loading screen for ${levelId}, game state: ${this.gameState.getCurrentState()}`);
    this.hideLoadingScreen();
  
    if (levelId === 'scholarsLibrary') {
      this.eventBus.emit('showMessage', 'Welcome, seeker of knowledge. Light the way to unveil the library’s secrets.');
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize.bind(this));
  
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const currentState = this.gameState.getCurrentState();
        if (currentState === this.gameState.states.PLAYING) {
          console.log('[DEBUG] Esc pressed, pausing game');
          this.eventBus.emit('game:pause');
        } else if (currentState === this.gameState.states.PAUSED) {
          console.log('[DEBUG] Esc pressed while paused, resuming game');
          this.eventBus.emit('game:resume');
        }
      }
    });
  
    const setupButton = (id, eventName) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.eventBus.emit(eventName);
        });
      } else {
        console.warn(`Button with ID "${id}" not found in the DOM`);
      }
    };
  
    setupButton('start-button', 'game:start');
    setupButton('pause-button', 'game:pause');
    setupButton('resume-button', 'game:resume');
    setupButton('restart-button', 'game:restart');
  
    this.eventBus.on('game:start', () => {
      console.log('[DEBUG] Game start event triggered');
      this.gameState.setState(this.gameState.states.PLAYING);
      this.startGameLoop();
      this.controlManager.enableControls();
      this.controlManager.requestPointerLock(); // Lock cursor only when game starts
      this.updateButtonVisibility();
    });
  
    this.eventBus.on('game:pause', () => {
      console.log('[DEBUG] Game pause event triggered');
      this.gameState.setState(this.gameState.states.PAUSED);
      this.sceneManager.stopRenderLoop();
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.controlManager.disableControls();
      this.controlManager.releasePointerLock(); // Release cursor
      this.updateButtonVisibility();
    });
  
    this.eventBus.on('game:resume', () => {
      console.log('[DEBUG] Game resume event triggered');
      this.gameState.setState(this.gameState.states.PLAYING);
      this.sceneManager.startRenderLoop();
      if (!this.timerInterval) {
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
      }
      this.controlManager.enableControls();
      this.controlManager.requestPointerLock();
      this.updateButtonVisibility();
    });
  
    this.eventBus.on('game:restart', () => {
      this.restartGame();
      this.controlManager.releasePointerLock(); // Ensure cursor is free in menu
    });
  
    this.eventBus.on('level:reset', () => {
      console.log('Received level:reset event, resetting game state and timer...');
      this.resetGameState();
      this.resetTimer();
      this.updateButtonVisibility();
      // Do not request pointer lock here; wait for game:start
    });

    this.eventBus.on('door:opened', (data) => {
      const currentLevelId = this.sceneManager.currentLevel?.constructor.name.toLowerCase() || 'unknown';
      console.log(`[DEBUG] Door opened, completing stage: ${currentLevelId}`);
      this.eventBus.emit('puzzleInteracted', { id: 'lever', success: true });
      this.eventBus.emit('stageCompleted', currentLevelId);
    });

    this.eventBus.on('game:win', () => {
      const currentLevelId = this.sceneManager.currentLevel?.constructor.name.toLowerCase() || 'unknown';
      console.log(`[DEBUG] Game won, completing stage: ${currentLevelId}`);
      this.eventBus.emit('stageCompleted', currentLevelId);
      this.gameState.setState(this.gameState.states.COMPLETED);
      this.updateButtonVisibility();
    });

    this.eventBus.on('skillLevelUpdated', (skillLevel) => {
      console.log(`[DEBUG] Skill level updated to: ${JSON.stringify(skillLevel)}`);
      const nextLevelId = LevelManager.getNextLevelId(this.sceneManager.currentLevel?.constructor.name.toLowerCase());
      if (nextLevelId) {
        console.log(`[DEBUG] Next level ${nextLevelId} will adjust to ${skillLevel}`);
      }
    });

    this.gameState.onStateChange((newState, oldState) => {
      console.log(`[DEBUG] State changed from ${oldState} to ${newState}`);
      this.updateButtonVisibility();
      document.body.setAttribute('data-game-state', newState);
    });
  
    // Other listeners remain unchanged...
  }

  updateButtonVisibility() {
    const currentState = this.gameState.getCurrentState();
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');
    const resumeButton = document.getElementById('resume-button');
    const restartButton = document.getElementById('restart-button');

    if (!startButton || !pauseButton || !resumeButton) {
      console.warn('One or more game control buttons not found!');
      return;
    }

    startButton.style.display = 'none';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    if (restartButton) restartButton.style.display = 'none';

    switch (currentState) {
      case this.gameState.states.MENU:
        startButton.style.display = 'block';
        break;
      case this.gameState.states.PLAYING:
        pauseButton.style.display = 'block';
        break;
      case this.gameState.states.PAUSED:
        resumeButton.style.display = 'block';
        break;
      case this.gameState.states.COMPLETED:
        if (restartButton) restartButton.style.display = 'block';
        break;
      default:
        startButton.style.display = 'block';
    }
  }

  startGameLoop() {
    this.sceneManager.startRenderLoop();
    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    }
  }

  updateTimer() {
    if (this.gameState.getCurrentState() !== this.gameState.states.PLAYING) {
      return;
    }
    const elapsedTime = this.gameState.getElapsedTime();
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsedTime % 60).toString().padStart(2, '0');
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.textContent = `${minutes}:${seconds}`;
    }
  }

  resetGameState() {
    this.gameState.setState(this.gameState.states.MENU);
    this.gameState.resetGame();
  }

  resetTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.textContent = '00:00';
    }
  }

  updateScene() {
    if (this.interactionSystem && this.sceneManager) {
      this.interactionSystem.setInteractiveObjects(this.sceneManager.getInteractiveObjects());
    }
  }

  restartGame() {
    this.showLoadingScreen('Returning to menu...');
    this.gameState.resetGame();
    this.gameState.setState(this.gameState.states.MENU);
    this.sceneManager.stopRenderLoop();
    this.sceneManager.cleanup();
    this.uiManager.hideAll();
    this.sceneManager.resetGame();
    this.hideLoadingScreen();
  }

  onWindowResize() {
    if (this.sceneManager) {
      this.sceneManager.onWindowResize();
    }
  }

  showLoadingScreen(message = 'Loading...') {
    let loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) {
      loadingScreen = document.createElement('div');
      loadingScreen.id = 'loading-screen';
      loadingScreen.style.position = 'absolute';
      loadingScreen.style.top = '0';
      loadingScreen.style.left = '0';
      loadingScreen.style.width = '100%';
      loadingScreen.style.height = '100%';
      loadingScreen.style.background = 'rgba(0, 0, 0, 0.8)';
      loadingScreen.style.color = 'white';
      loadingScreen.style.display = 'flex';
      loadingScreen.style.justifyContent = 'center';
      loadingScreen.style.alignItems = 'center';
      loadingScreen.style.zIndex = '1000';
      loadingScreen.innerHTML = `
        <div class="loader"></div>
        <div class="loading-text">${message}</div>
      `;
      document.body.appendChild(loadingScreen);
    } else {
      loadingScreen.style.display = 'flex';
      loadingScreen.querySelector('.loading-text').textContent = message;
    }
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        loadingScreen.classList.remove('fade-out');
      }, 500);
    }
  }

  showErrorScreen(error) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      const loadingText = loadingScreen.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = `Error: ${error.message || 'Failed to load game'}`;
        loadingText.style.color = 'red';
      }
    }
  }
}

// Instantiate and attach to window
window.holoQuest = new HoloQuest();
export default HoloQuest;