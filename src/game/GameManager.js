import { eventBus } from './eventBus';
import { StorageRoom } from '../scene/room';
import { LibraryRoom } from '../scene/LibraryRoom';

export class GameManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.rooms = [StorageRoom, LibraryRoom];
    this.currentRoomIndex = 0;
    this.isGameRunning = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.on('level:select', (payload) => {
      const index = typeof payload === 'object' && payload !== null ? payload.data || 0 : payload;
      console.log('GameManager: Level select event received with payload:', payload, 'Resolved index:', index);
      this.currentRoomIndex = Number(index);
      this.resetLevel();
    });

    eventBus.on('game:win', () => {
      console.log(`GameManager: Player escaped Level ${this.currentRoomIndex + 1}!`);
      this.sceneManager.stopRenderLoop();
      this.showWinScreen();
    });

    eventBus.on('scene:ready', () => {
      console.log('GameManager: Scene ready');
      if (!this.isGameRunning) {
        this.sceneManager.startRenderLoop();
        this.isGameRunning = true;
      }
    });
  }

  async resetLevel() {
    console.log(`GameManager: Resetting to Level ${this.currentRoomIndex + 1}`);
    this.sceneManager.stopRenderLoop();
    
    // Extract light objects into an array, preserve with player
    const lightArray = Object.values(this.sceneManager.lights || {});
    const persistentObjects = [...lightArray, this.sceneManager.player.mesh];
    this.sceneManager.scene.children = persistentObjects;
    this.sceneManager.interactableObjects = [];
    this.sceneManager.inventory.items = [];
    eventBus.emit('inventory:updated', this.sceneManager.inventory);

    const RoomClass = this.rooms[this.currentRoomIndex];
    const room = new RoomClass(this.sceneManager.scene);
    this.sceneManager.room = room;
    await room.init();
    this.sceneManager.scene.add(room);
    this.sceneManager.interactableObjects = room.getInteractiveObjects();
    this.sceneManager.interactionSystem.setInteractiveObjects(this.sceneManager.interactableObjects);

    console.log('GameManager: Level reset - scene children:', this.sceneManager.scene.children.length);
    this.sceneManager.startRenderLoop();
    eventBus.emit('scene:ready');
  }

  showWinScreen() {
    const existingWinScreen = document.getElementById('win-screen');
    if (existingWinScreen) {
      document.body.removeChild(existingWinScreen);
    }
    
    const winScreen = document.createElement('div');
    winScreen.id = 'win-screen';
    winScreen.style.position = 'absolute';
    winScreen.style.top = '50%';
    winScreen.style.left = '50%';
    winScreen.style.transform = 'translate(-50%, -50%)';
    winScreen.style.background = 'rgba(0, 100, 0, 0.9)';
    winScreen.style.color = 'white';
    winScreen.style.padding = '20px';
    winScreen.style.borderRadius = '10px';
    winScreen.style.fontSize = '24px';
    winScreen.style.textAlign = 'center';
    winScreen.style.zIndex = '3000';
    winScreen.innerHTML = `
      <h1>You Escaped!</h1>
      <p>Congratulations on solving Level ${this.currentRoomIndex + 1}!</p>
      <button id="replay-button">Replay Level ${this.currentRoomIndex + 1}</button>
      ${this.currentRoomIndex < this.rooms.length - 1 ? `<button id="next-level-button">Go to Level ${this.currentRoomIndex + 2}</button>` : ''}
    `;
    document.body.appendChild(winScreen);

    const replayButton = document.getElementById('replay-button');
    replayButton.style.padding = '10px 20px';
    replayButton.style.background = '#FFD700';
    replayButton.style.color = 'black';
    replayButton.style.border = 'none';
    replayButton.style.borderRadius = '5px';
    replayButton.style.cursor = 'pointer';
    replayButton.style.margin = '5px';
    replayButton.addEventListener('click', () => {
      document.body.removeChild(winScreen);
      eventBus.emit('level:select', this.currentRoomIndex);
    });

    if (this.currentRoomIndex < this.rooms.length - 1) {
      const nextLevelButton = document.getElementById('next-level-button');
      nextLevelButton.style.padding = '10px 20px';
      nextLevelButton.style.background = '#00FF00';
      nextLevelButton.style.color = 'black';
      nextLevelButton.style.border = 'none';
      nextLevelButton.style.borderRadius = '5px';
      nextLevelButton.style.cursor = 'pointer';
      nextLevelButton.style.margin = '5px';
      nextLevelButton.addEventListener('click', () => {
        document.body.removeChild(winScreen);
        eventBus.emit('level:select', this.currentRoomIndex + 1);
      });
    }
  }
}