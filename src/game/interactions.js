// interactions.js
import * as THREE from 'three';
import { eventBus } from './eventBus.js';

class InteractionSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.1;
    this.raycaster.far = 1000;
    this.mouse = new THREE.Vector2();
    this.touchPosition = new THREE.Vector2();
    this.interactiveObjects = [];
    this.hoveredObject = null;
    this.maxInteractionDistance = 20;
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    this.inventory = {
      items: [],
      hasItem: (id) => this.inventory.items.some(item => item.id === id)
    };
    
    this.solvedPuzzles = new Set();
    this.completedTasks = new Map();
    this.currentLevelId = null;
    this.eventListeners = new Map(); // Track listeners for cleanup
  }

  init() {
    this.addEventListener('mousemove', document, this.onMouseMove, false);
    this.addEventListener('click', document, this.onClick, false);
    this.addEventListener('touchstart', document, this.onTouchStart, { passive: false });
    this.addEventListener('touchend', document, this.onTouchEnd, { passive: false });

    this.addEventBusListener('triggerInteraction', () => {
      console.log('[InteractionSystem] triggerInteraction event received at', new Date().toISOString());
      if (this.hoveredObject) {
        console.log('[InteractionSystem] Interacting with hovered object (via gesture):', this.hoveredObject.userData.name);
        this.interact(this.hoveredObject);
      }
    });
    this.resetState();
    console.log('InteractionSystem: Initialized with listeners');
    return this;
  }

  addEventListener(event, target, handler, options) {
    target.addEventListener(event, handler, options);
    this.eventListeners.set(`${event}-${handler.toString()}`, { target, handler, options });
  }

  addEventBusListener(event, handler) {
    eventBus.on(event, handler);
    this.eventListeners.set(`${event}-${handler.toString()}`, { target: eventBus, handler });
  }

  setLevel(levelId) {
    this.currentLevelId = levelId;
    if (!this.completedTasks.has(levelId)) {
      this.completedTasks.set(levelId, new Set());
    }
    console.log(`[InteractionSystem] Set level to ${levelId} at`, new Date().toISOString());
  }

  resetState() {
    this.solvedPuzzles.clear();
    if (this.currentLevelId) {
      this.completedTasks.set(this.currentLevelId, new Set());
    }
    console.log('[InteractionSystem] State reset for level', this.currentLevelId, 'at', new Date().toISOString());
  }

  setInteractiveObjects(objects) {
    this.interactiveObjects = objects.filter(obj => obj.userData && (obj.userData.isInteractive || obj.userData.interactable));
    this.resetState();
    console.log('[DEBUG] InteractionSystem: Set interactive objects for', this.currentLevelId, this.interactiveObjects.map(obj => obj.userData?.name || 'unnamed'));
  }

  onMouseMove(event) {
    if (document.pointerLockElement === document.body) {
      this.mouse.set(0, 0);
    } else {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    this.checkHover();
  }

  onClick(event) {
    console.log('InteractionSystem: Click detected at', new Date().toISOString());
    if (document.pointerLockElement === document.body) {
      this.mouse.set(0, 0);
    } else {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    this.checkHover();
    if (this.hoveredObject) {
      console.log('[InteractionSystem] Interacting with hovered object (via mouse):', this.hoveredObject.userData.name);
      this.interact(this.hoveredObject);
    }
  }

  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
      this.touchPosition.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      this.touchPosition.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
      this.mouse.copy(this.touchPosition);
    }
  }

  onTouchEnd(event) {
    event.preventDefault();
    this.mouse.copy(this.touchPosition);
    this.checkHover();
    if (this.hoveredObject) {
      this.interact(this.hoveredObject);
    }
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (this.hoveredObject) {
      if (this.hoveredObject.userData.onUnhover) {
        this.hoveredObject.userData.onUnhover();
      }
      this.setObjectHover(this.hoveredObject, false);
      this.hoveredObject = null;
      eventBus.emit('object:leave');
    }

    const validIntersects = intersects.filter(intersect => 
      intersect.distance <= this.maxInteractionDistance
    );

    if (validIntersects.length > 0) {
      let interactiveObject = validIntersects[0].object;
      while (interactiveObject && 
             (!interactiveObject.userData || 
              (!interactiveObject.userData.isInteractive && !interactiveObject.userData.interactable))) {
        interactiveObject = interactiveObject.parent;
      }

      if (interactiveObject && 
          (interactiveObject.userData?.isInteractive || interactiveObject.userData?.interactable)) {
        this.hoveredObject = interactiveObject;
        if (this.hoveredObject.userData.onHover) {
          this.hoveredObject.userData.onHover();
        }
        this.setObjectHover(this.hoveredObject, true);
        const hintText = this.getInteractionHint(this.hoveredObject);
        eventBus.emit('object:hover', {
          object: this.hoveredObject,
          name: this.hoveredObject.userData.name,
          action: hintText,
          position: this.hoveredObject.position,
          camera: this.camera
        });
      }
    }
  }

  update() {
    this.checkHover();
  }

  setObjectHover(object, isHovered) {
    if (!object) return;

    if (object.userData?.outlineMesh) {
      object.userData.outlineMesh.visible = isHovered;
    }

    if (isHovered) {
      if (!object.userData.originalScale) {
        object.userData.originalScale = object.scale.clone();
      }
      object.scale.copy(object.userData.originalScale).multiplyScalar(1.1);
    } else {
      if (object.userData.originalScale) {
        object.scale.copy(object.userData.originalScale);
      }
    }

    if (object.userData.name?.startsWith('rune_circle_')) {
      const material = object.material;
      if (material) {
        if (isHovered) {
          material.emissiveIntensity = 1;
          material.emissive.setHex(0xFFD700);
        } else {
          material.emissiveIntensity = 0.5;
          material.emissive.setHex(0x3333FF);
        }
      }
    }
  }

  getInteractionHint(object) {
    const data = object.userData;
    switch (data.name) {
      case 'locked_cabinet': return data.level?.cabinetLocked ? 'Solve to Unlock Cabinet' : 'Open Cabinet';
      case 'riddle_note': return 'Examine Ancient Note'; 
      case 'candelabra': return data.level?.candelabraLit ? 'Lit Candelabra' : 'Ignite with Quill';
      case 'quill': return 'Activate Quill';
      case 'magical_orb': return data.level?.orbActivated ? 'Move to Pedestal' : 'Set Color Sequence (Click to Cycle)';
      case 'floating_tome': return 'Read Arcane Riddle';
      case 'orb_pedestal': return 'Place Glowing Orb';
      case 'victory_scroll': return 'Claim the Ancient Scroll';
      default:
        if (data.name?.startsWith('book_')) {
          const colors = { 0xFF0000: 'Red', 0x00FF00: 'Green', 0x0000FF: 'Blue', 0xFFFF00: 'Yellow', 0xFF00FF: 'Magenta' };
          return `Select ${colors[data.color]} Book`;
        }
        if (data.name?.startsWith('rune_circle_')) {
          return 'Tune Rune Circle (Click to Adjust Speed)';
        }
        if (data.name?.startsWith('floor_trigger_')) {
          const colors = { 0xFF0000: 'Red', 0x00FF00: 'Green', 0x0000FF: 'Blue' };
          return `Step on ${colors[data.material.color.getHex()]} Circle`;
        }
        switch (data.type) {
          case 'collectible': return `Pick up ${data.name || 'item'}`;
          case 'puzzle': return data.requiresItem && (!this.inventory || !this.inventory.hasItem(data.requiresItem))
            ? `Locked - needs ${data.requiresItem}`
            : `Unlock ${data.name || 'puzzle'}`;
          case 'readable': return `Read ${data.name || 'note'}`;
          case 'container': return `Move ${data.name || 'object'}`;
          case 'door': return data.locked ? `Locked door` : `Exit through door`;
          default: return `Interact with ${data.name || 'object'}`;
        }
    }
  }

  setInventory(inventory) {
    if (inventory && typeof inventory.hasItem === 'function') {
      this.inventory = inventory;
    } else {
      console.warn('Invalid inventory provided to InteractionSystem, using default');
      this.inventory = {
        items: [],
        hasItem: (id) => this.inventory.items.some(item => item.id === id)
      };
    }
  }

  interact(object) {
    if (!object || !object.userData || !this.currentLevelId) return;
    const data = object.userData;
    const puzzleId = data.name || data.type || 'unknown';
    console.log(`[InteractionSystem] Interacting with ${data.name} in level ${this.currentLevelId} at`, new Date().toISOString());
    
    const alreadySolved = this.solvedPuzzles.has(puzzleId);
    let levelTasks = this.completedTasks.get(this.currentLevelId);

    if (data.requiresItem && !this.inventory.hasItem(data.requiresItem)) {
      eventBus.emit('showMessage', `You need ${data.requiresItem} to interact with this.`);
      eventBus.emit('puzzleInteracted', { id: puzzleId, success: false });
      return;
    }

    let interactionSuccess = false;
    
    if (typeof data.action === 'function') {
      const actionResult = data.action(this.inventory);
      interactionSuccess = actionResult !== false;
      if (interactionSuccess && !alreadySolved) {
        this.solvedPuzzles.add(puzzleId);
      }
    }

    switch (data.type) {
      case 'puzzle':
        interactionSuccess = data.solved || false;
        eventBus.emit('puzzle:interaction', { id: data.name, solved: interactionSuccess });
        if (interactionSuccess && !alreadySolved) this.solvedPuzzles.add(puzzleId);
        break;
      case 'door':
        if (!data.locked) {
          eventBus.emit('door:opened', { id: data.name });
          interactionSuccess = true;
          if (!alreadySolved) this.solvedPuzzles.add(puzzleId);
        } else {
          eventBus.emit('showMessage', 'This door is locked.');
          interactionSuccess = false;
        }
        break;
      case 'collectible':
        if (data.name === 'victory_scroll') {
          levelTasks.add('victory_scroll');
          console.log(`[DEBUG] Added victory_scroll to ${this.currentLevelId} tasks:`, Array.from(levelTasks));
          interactionSuccess = true;
        } else {
          interactionSuccess = true;
        }
        if (interactionSuccess && !alreadySolved) this.solvedPuzzles.add(puzzleId);
        break;
      case 'readable':
        if (data.name === 'floating_tome') {
          levelTasks.add('floating_tome');
          console.log(`[DEBUG] Added floating_tome to ${this.currentLevelId} tasks:`, Array.from(levelTasks));
        }
        eventBus.emit('note:read', { id: data.name, content: data.content || 'No content available.' });
        interactionSuccess = true;
        if (!alreadySolved) this.solvedPuzzles.add(puzzleId);
        break;
      case 'container':
        interactionSuccess = true;
        if (!alreadySolved) this.solvedPuzzles.add(puzzleId);
        break;
    }

    if (data.name?.startsWith('rune_circle_')) {
      eventBus.emit('rune:interaction', { id: data.name });
      interactionSuccess = true;
      if (!alreadySolved) this.solvedPuzzles.add(puzzleId);
    } else if (data.name === 'candelabra' && data.level?.candelabraLit) {
      levelTasks.add('candelabra');
      console.log(`[DEBUG] Added candelabra to ${this.currentLevelId} tasks:`, Array.from(levelTasks));
    } else if (data.name === 'orb_pedestal' && data.level?.orbActivated) {
      levelTasks.add('orb_pedestal');
      console.log(`[DEBUG] Added orb_pedestal to ${this.currentLevelId} tasks:`, Array.from(levelTasks));
    }
    
    eventBus.emit('object:interaction', { id: data.name, type: data.type });
    const successForMetrics = interactionSuccess && !alreadySolved;
    eventBus.emit('puzzleInteracted', { id: puzzleId, success: successForMetrics });

    if (this.isLevelCompleted()) {
      console.log(`[InteractionSystem] Level ${this.currentLevelId} completed, emitting game:win at`, new Date().toISOString());
      eventBus.emit('game:win');
    }
    
    console.log(`[DEBUG] Interaction with ${puzzleId} in ${this.currentLevelId} complete, success: ${interactionSuccess}`);
  }

  getIntersectedObject(x, y) {
    this.mouse.x = (x / window.innerWidth) * 2 - 1;
    this.mouse.y = -(y / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects);
    return intersects.length > 0 ? intersects[0].object : null;
  }

  isLevelCompleted() {
    if (!this.currentLevelId) return false;
    const requiredTasks = new Set([
      'victory_scroll',
      'floating_tome',
      'candelabra',
      'orb_pedestal'
    ]);
    const levelTasks = this.completedTasks.get(this.currentLevelId) || new Set();
    const isCompleted = [...requiredTasks].every(task => levelTasks.has(task));
    console.log(`[InteractionSystem] Checking completion for ${this.currentLevelId} at`, new Date().toISOString(), {
      required: Array.from(requiredTasks),
      completed: Array.from(levelTasks),
      isCompleted
    });
    return isCompleted;
  }

  destroy() {
    this.eventListeners.forEach(({ target, handler, options }, key) => {
      if (target === eventBus) {
        eventBus.off(key.split('-')[0], handler); // Assuming eventBus has an off method
      } else {
        target.removeEventListener(key.split('-')[0], handler, options);
      }
    });
    this.eventListeners.clear();
    this.resetState();
    console.log('InteractionSystem: All listeners removed and state reset at', new Date().toISOString());
  }
}

export { InteractionSystem };