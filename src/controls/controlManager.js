// src/controls/controlManager.js
import * as THREE from 'three';
import { MouseControls } from './mouseControls.js';
import GestureControls from '../input/gestureControls.js';
import { eventBus } from '../game/eventBus.js';

export class ControlManager {
    constructor(eventBus, camera, domElement, interactionSystem) {
        this.eventBus = eventBus;
        this.camera = camera;
        this.domElement = domElement;
        this.interactionSystem = interactionSystem;
        console.log('[ControlManager] Constructor - Camera:', this.camera);
        this.activeControls = [];
        this.isPaused = false;
        this.isPointerLocked = false;
        this.playerPosition = new THREE.Vector3(0, 0, 0);
        this.mouse = new THREE.Vector2();
        this.scene = null;

        if (!this.interactionSystem) {
            console.error('[ControlManager] No InteractionSystem provided');
        }
    }
    
    async init() {
        await this.initMouseControls();
        await this.initGestureControls();
        this.setupEventListeners();
        this.setupPointerLock();
        console.log('[ControlManager] Initialized');
        return this;
    }
    
    async initMouseControls() {
        try {
            const mouseControls = new MouseControls(this.camera, this.domElement);
            await mouseControls.init();
            this.activeControls.push(mouseControls);
            return mouseControls;
        } catch (error) {
            console.error('Failed to initialize mouse controls:', error);
            const fallbackControls = {
                update: () => {},
                dispose: () => {}
            };
            this.activeControls.push(fallbackControls);
            return fallbackControls;
        }
    }
    
    // ControlManager.js (adjusted snippet)
async initGestureControls() {
    try {
      const gestureControls = new GestureControls(this.camera);
      await gestureControls.init();
      this.activeControls.push(gestureControls);
      return gestureControls;
    } catch (error) {
      console.error('Failed to initialize gesture controls:', error);
      const fallbackControls = { update: () => {}, dispose: () => {} };
      this.activeControls.push(fallbackControls);
      return fallbackControls;
    }
  }
    
    setupPointerLock() {
        // Track pointer lock state changes
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.domElement;
            console.log(`[Control Manager] Pointer lock state changed: ${this.isPointerLocked ? 'locked' : 'unlocked'}`);
        });
    }
    
    setupEventListeners() {
        this.eventBus.on('game:start', () => {
          console.log('[ControlManager] Game start event triggered');
          this.isPaused = false;
          this.enableControls();
          this.requestPointerLock(); // Lock cursor when game starts
        });
      
        this.eventBus.on('game:pause', () => {
          this.isPaused = true;
          this.disableControls();
          this.releasePointerLock();
          if (window.holoQuest && window.holoQuest.timerInterval) {
            clearInterval(window.holoQuest.timerInterval);
            window.holoQuest.timerInterval = null;
          }
        });
      
        this.eventBus.on('game:resume', () => {
          this.isPaused = false;
          this.enableControls();
          this.requestPointerLock();
          if (window.holoQuest && !window.holoQuest.timerInterval) {
            window.holoQuest.timerInterval = setInterval(() => window.holoQuest.updateTimer(), 1000);
          }
        });
      
        this.eventBus.on('game:win', () => {
          console.log('[ControlManager] Level completed, releasing cursor');
          this.isPaused = true;
          this.disableControls();
          this.releasePointerLock();
          if (window.holoQuest && window.holoQuest.timerInterval) {
            clearInterval(window.holoQuest.timerInterval);
            window.holoQuest.timerInterval = null;
          }
        });
      
        this.eventBus.on('stageCompleted', () => {
          console.log('[ControlManager] Stage completed, releasing cursor');
          this.isPaused = true;
          this.disableControls();
          this.releasePointerLock();
        });
      
        this.eventBus.on('level:reset', () => {
          console.log('[ControlManager] Level reset event triggered, enabling controls');
          this.isPaused = false;
          this.enableControls();
          // Do not request pointer lock here; wait for game:start
        });
      
        this.eventBus.on('game:restart', () => {
          console.log('[ControlManager] Game restart event, releasing pointer lock');
          this.releasePointerLock();
        });
      
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            if (!this.isPaused) {
              console.log('[ControlManager] Esc pressed, emitting game:pause');
              this.eventBus.emit('game:pause');
            } else {
              console.log('[ControlManager] Esc pressed while paused, emitting game:resume');
              this.eventBus.emit('game:resume');
            }
          }
        });
      
        this.eventBus.on('playerMove', ({ directionX, directionZ, speed }) => {
          if (this.scene && this.camera && !this.isPaused) {
            const moveDirection = new THREE.Vector3(directionX, 0, directionZ);
            moveDirection.normalize().applyQuaternion(this.camera.quaternion);
            moveDirection.y = 0;
            moveDirection.multiplyScalar(speed);
            this.playerPosition.add(moveDirection);
            this.camera.position.copy(this.playerPosition);
            console.log(`[DEBUG] ControlManager playerMove - x: ${this.playerPosition.x}, z: ${this.playerPosition.z}`);
          }
        });
      
        this.domElement.addEventListener('mousemove', (event) => {
          this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
      }
    
    releasePointerLock() {
        if ('exitPointerLock' in document) {
            console.log('[Control Manager] Explicitly releasing pointer lock');
            document.exitPointerLock();
        }
    }
    
    requestPointerLock() {
        if (this.domElement && 'requestPointerLock' in this.domElement) {
            this.domElement.requestPointerLock();
        }
    }
    
    enableControls() {
        this.activeControls.forEach(control => {
            if (control.enable) {
                control.enable();
            }
        });
    }
    
    disableControls() {
        this.activeControls.forEach(control => {
            if (control.disable) {
                control.disable();
            }
        });
    }
    
    setScene(scene) {
        this.scene = scene;
        console.log('[DEBUG] Scene set in ControlManager');
    }
    
    update(delta) {
        // Skip updates if game is paused
        if (this.isPaused) return;
        
        // Update any controls that need animation frame updates
        this.activeControls.forEach(control => {
            if (control.update) {
                control.update(delta);
            }
        });
    }
    
    dispose() {
        // Release pointer lock before disposing
        this.releasePointerLock();
        
        // Clean up all controls
        this.activeControls.forEach(control => {
            if (control.dispose) {
                control.dispose();
            }
        });
        this.activeControls = [];
    }
}