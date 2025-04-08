// src/game/AICompanion.js
import { eventBus } from './eventBus.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

class AICompanion {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.speech = window.speechSynthesis;
    this.isSpeaking = false;

    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;

    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.bobSpeed = 1;
    this.bobAmplitude = 0.15;
    this.time = 0;
    this.lastHintTime = 0;
    this.hintCooldown = 30000; // 30 seconds cooldown
    this.loadModel();
    this.currentMessage = null;
    this.messageSprite = null;
    this.messageTimeout = null;

    // Generic messages for fallback
    this.genericMessages = {
      welcome: "Greetings, traveler! I'll guide you through this journey.",
      hint: ["Look around carefully.", "Interact with your surroundings.", "Something here will lead the way."],
      victory: "Victory! You’ve conquered the challenge!"
    };

    // Messages for Room
    this.roomMessages = {
      welcome: "Welcome to this dusty room! Let's find a way out.",
      hint: [
        "Check the table for something useful.",
        "Look at the bookshelf—there might be a clue.",
        "Move the bookshelf to see what's behind it.",
        "Pull the lever to unlock the door."
      ],
      victory: "You've escaped the room! Congratulations!"
    };

    // Messages for ScholarsLibrary
    this.scholarsLibraryMessages = {
      welcome: "Greetings, scholar! I'll guide you through this arcane library.",
      beginner: {
        hint: ["Light the candelabra with the quill to begin.", "Awaken the floating tome for a riddle.", "Enter the orb sequence: Red (1), Green (2), Blue (3).", "The orb is ready—check the cabinet."],
        victory: "The library's secrets are yours (Beginner)! Victory!"
      },
      intermediate: {
        hint: ["Use the quill to light the candelabra.", "Sync the rune circles by matching their speeds.", "Increase the candelabra intensity to 3.", "Place the activated orb on the pedestal.", "The cabinet awaits—open it!"],
        victory: "The library's mysteries are yours (Intermediate)! Victory!"
      },
      expert: {
        hint: ["Ignite the candelabra with the quill.", "Awaken the tome for a riddle.", "Enter the orb sequence: Red (1), Green (2), Blue (3).", "Arrange the books: Red, Green, Blue.", "Place the orb on the pedestal to unlock the cabinet."],
        victory: "The library's mastery is yours (Expert)! Victory!"
      }
    };

    // Messages for DesertEscape (assumed structure)
    this.desertEscapeMessages = {
      welcome: "Welcome to the scorching desert! Let's escape this sandy trap.",
      hint: [
        "Find the hidden key in the sand.",
        "Use the key to unlock the chest.",
        "Solve the riddle from the scroll.",
        "Activate the oasis mechanism."
      ],
      victory: "You've escaped the desert! Victory under the sun!"
    };

    // Messages for VerdantLabyrinth
    this.verdantLabyrinthMessages = {
      welcome: "Welcome to the Verdant Labyrinth! I’ll help you awaken the temple’s heart.",
      beginner: {
        hint: [
          "Activate the water source to begin.",
          "Tap the earth node next.",
          "Unlock the temple heart with both elements."
        ],
        victory: "The relic is yours (Beginner)! The jungle honors you!"
      },
      intermediate: {
        hint: [
          "Start with the water source.",
          "Activate elements in order: Water, Earth, Fire, Air.",
          "Awaken the temple heart when all align."
        ],
        victory: "The relic shines (Intermediate)! Master of the jungle!"
      },
      expert: {
        hint: [
          "Begin with the water source.",
          "Follow the sequence: Water, Earth, Fire, Air, Light.",
          "Unlock the heart with perfect harmony."
        ],
        victory: "The relic blazes (Expert)! Legendary triumph!"
      }
    };

    // Messages for LunarCommandNexus
    this.lunarCommandNexusMessages = {
      welcome: "Welcome to the Lunar Command Nexus! I’ll assist you in launching the ship.",
      intermediate: {
        hint: [
          "Activate the quantum probe to start.",
          "Power the thruster next.",
          "Align the frequencies to charge the core.",
          "Place the core in the resonator.",
          "Solve the cosmic riddle at the console."
        ],
        victory: "The ship escapes the void (Intermediate)! Stellar victory!"
      },
      expert: {
        hint: [
          "Begin with the quantum probe.",
          "Awaken the thruster.",
          "Tune the frequencies precisely.",
          "Set the core in the resonator.",
          "Decrypt the cosmic signal at the console."
        ],
        victory: "The ship breaks free (Expert)! Legendary cosmic mastery!"
      }
    };

    // Messages for CelestialForge (assumed steampunk theme)
    this.celestialForgeMessages = {
      welcome: "Welcome to the Celestial Forge! Let’s craft the key to the stars.",
      beginner: {
        hint: [
          "Turn on the bellows to heat the forge.",
          "Place the gear in the mechanism.",
          "Solve the steam valve puzzle."
        ],
        victory: "The forge’s treasure is yours (Beginner)! Stellar work!"
      },
      intermediate: {
        hint: [
          "Activate the bellows to start the fire.",
          "Align the gears in sequence: Small, Medium, Large.",
          "Adjust the steam pressure to medium."
        ],
        victory: "The forge’s creation shines (Intermediate)! Masterful craft!"
      },
      expert: {
        hint: [
          "Start the bellows to ignite the forge.",
          "Set the crucible with the right alloy mix.",
          "Tune the gear rhythm and steam flow perfectly."
        ],
        victory: "The forge’s masterpiece is yours (Expert)! Celestial triumph!"
      }
    };

    console.log('[AICompanion] Initialized');
    this.setupListeners();
  }

  async loadModel() {
    try {
      const gltf = await this.gltfLoader.loadAsync('/assets/models/buzz-a-tron_drone.glb');
      this.model = gltf.scene;

      this.model.scale.set(0.5, 0.5, 0.5);
      this.baseScale = this.model.scale.clone();

      this.scene.add(this.model);
      this.createTextSprite();
      
      console.log('[AICompanion] Model loaded');
    } catch (error) {
      console.error('[AICompanion] Error loading model:', error);
      const geometry = new THREE.SphereGeometry(0.2, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF }); // Cyan default
      this.model = new THREE.Mesh(geometry, material);
      this.scene.add(this.model);
      this.baseScale = this.model.scale.clone();
      this.createTextSprite();
    }
  }

  createTextSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    this.messageSprite = new THREE.Sprite(spriteMaterial);
    this.messageSprite.scale.set(2, 0.5, 1);
    this.messageSprite.position.set(0, 0.8, 0);
    this.messageSprite.visible = false;
    
    if (this.model) {
      this.model.add(this.messageSprite);
    }
    
    this.messageCanvas = canvas;
    this.messageContext = context;
  }

  showMessage(message) {
    if (!message || !this.messageSprite || !this.messageContext) return;
    
    this.currentMessage = message;
    
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    
    const ctx = this.messageContext;
    const canvas = this.messageCanvas;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dynamic styling based on level
    const level = this.sceneManager.currentLevel;
    let fillStyle = 'rgba(20, 20, 40, 0.85)'; // Default dark blue
    let strokeStyle = '#00BFFF'; // Default cyan
    if (level) {
      switch (level.constructor.name) {
        case 'VerdantLabyrinth':
          fillStyle = 'rgba(0, 51, 0, 0.85)'; // Jungle dark green
          strokeStyle = '#FFD700'; // Golden
          break;
        case 'LunarCommandNexus':
          fillStyle = 'rgba(15, 25, 45, 0.85)'; // Lunar dark blue
          strokeStyle = '#FF00CC'; // Magenta
          break;
        case 'CelestialForge':
          fillStyle = 'rgba(50, 30, 20, 0.85)'; // Steampunk brown
          strokeStyle = '#FFA500'; // Orange
          break;
        case 'DesertEscape':
          fillStyle = 'rgba(80, 50, 20, 0.85)'; // Desert brown
          strokeStyle = '#FFD700'; // Golden
          break;
      }
    }
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 4;
    
    const borderRadius = 16;
    const width = canvas.width - 20;
    const height = canvas.height - 20;
    const x = 10;
    const y = 10;
    
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + width - borderRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
    ctx.lineTo(x + width, y + height - borderRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
    ctx.lineTo(x + borderRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
    ctx.lineTo(x, y + borderRadius);
    ctx.quadraticCurveTo(x, y, x + borderRadius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    this.wrapText(ctx, message, canvas.width / 2, canvas.height / 2, canvas.width - 40, 28);
    
    this.messageSprite.material.map.needsUpdate = true;
    this.messageSprite.visible = true;
    
    this.messageTimeout = setTimeout(() => {
      this.messageSprite.visible = false;
      this.currentMessage = null;
    }, 4000);
  }
  
  wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = 0;
    const maxLines = 2;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        if (lines < maxLines) {
          context.fillText(line, x, y - lineHeight/2 + (lines * lineHeight));
          line = words[i] + ' ';
          lines++;
        } else {
          context.fillText(line.slice(0, -1) + '...', x, y - lineHeight/2 + (lines * lineHeight));
          break;
        }
      } else {
        line = testLine;
      }
    }
    
    if (lines < maxLines) {
      context.fillText(line, x, y - lineHeight/2 + (lines * lineHeight));
    }
  }

  setupListeners() {
    eventBus.on('scene:ready', () => this.speak(this.getWelcomeMessage()));
    eventBus.on('game:win', () => this.speak(this.getVictoryMessage()));
    eventBus.on('requestHint', () => this.provideHint());
    eventBus.on('showMessage', (message) => this.showMessage(message)); // Optional: syncs with level messages
  }

  update(delta) {
    if (!this.model || !this.camera) return;

    this.time += delta * this.bobSpeed;
    const bobOffset = Math.sin(this.time) * this.bobAmplitude;

    const offset = new THREE.Vector3(-0.5, 0.3, -1.5);
    offset.applyQuaternion(this.camera.quaternion);
    const newPos = this.camera.position.clone().add(offset);
    this.model.position.copy(newPos);

    this.model.position.y += bobOffset;
    this.model.lookAt(this.camera.position);

    const pulse = 1 + Math.sin(this.time * 2) * 0.05;
    this.model.scale.copy(this.baseScale).multiplyScalar(pulse);
  }

  speak(message) {
    if (this.isSpeaking || !message) return;
    this.isSpeaking = true;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    utterance.onend = () => { this.isSpeaking = false; };
    this.speech.speak(utterance);
    
    this.showMessage(message);
    
    console.log('[AICompanion] Speaking:', message);
  }

  getWelcomeMessage() {
    const level = this.sceneManager.currentLevel;
    if (!level) return this.genericMessages.welcome;
    switch (level.constructor.name) {
      case 'Room': return this.roomMessages.welcome;
      case 'ScholarsLibrary': return this.scholarsLibraryMessages.welcome;
      case 'DesertEscape': return this.desertEscapeMessages.welcome;
      case 'VerdantLabyrinth': return this.verdantLabyrinthMessages.welcome;
      case 'LunarCommandNexus': return this.lunarCommandNexusMessages.welcome;
      case 'CelestialForge': return this.celestialForgeMessages.welcome;
      default: return this.genericMessages.welcome;
    }
  }

  getVictoryMessage() {
    const level = this.sceneManager.currentLevel;
    if (!level) return this.genericMessages.victory;
    switch (level.constructor.name) {
      case 'Room': return this.roomMessages.victory;
      case 'ScholarsLibrary':
        return this.scholarsLibraryMessages[level.skillLevel || 'beginner'].victory;
      case 'DesertEscape': return this.desertEscapeMessages.victory;
      case 'VerdantLabyrinth':
        return this.verdantLabyrinthMessages[level.difficulty || 'intermediate'].victory;
      case 'LunarCommandNexus':
        return this.lunarCommandNexusMessages[level.skillLevel || 'intermediate'].victory;
      case 'CelestialForge':
        return this.celestialForgeMessages[level.difficulty || 'intermediate'].victory;
      default: return this.genericMessages.victory;
    }
  }

  provideHint() {
    const level = this.sceneManager.currentLevel;
    if (!level) {
      this.speak("I can’t find the level to guide you.");
      return;
    }

    const now = Date.now();
    if (this.lastHintTime !== 0 && (now - this.lastHintTime < this.hintCooldown)) {
      this.speak("Please wait a moment before asking for another hint.");
      return;
    }

    this.lastHintTime = now;

    const inventory = this.sceneManager.inventory || { hasItem: () => false }; // Fallback if inventory not available
    let hints, skillLevel;

    switch (level.constructor.name) {
      case 'Room':
        hints = this.roomMessages.hint;
        const door = level.getObjectByName('doorFrame');
        const bookshelf = level.objects?.find(obj => obj.position.x === -8);
        const leverVisible = level.children?.find(obj => obj.userData.name === 'lever')?.visible;
        if (!inventory.hasItem('key')) this.speak(hints[0]);
        else if (!bookshelf?.userData.moved) this.speak(hints[1]);
        else if (leverVisible && door?.userData.locked) this.speak(hints[2]);
        else this.speak(hints[3]);
        break;

      case 'ScholarsLibrary':
        skillLevel = level.skillLevel || 'beginner';
        hints = this.scholarsLibraryMessages[skillLevel].hint;
        if (!level.candelabraLit) this.speak(hints[0]);
        else if ((skillLevel === 'beginner' || skillLevel === 'expert') && !level.tomeActivated) this.speak(hints[1]);
        else if ((skillLevel === 'beginner' || skillLevel === 'expert') && !level.orbActivated) this.speak(hints[2]);
        else if (skillLevel === 'intermediate' && !level.runeSynced) this.speak(hints[1]);
        else if (skillLevel === 'intermediate' && level.candelabraIntensity < 3) this.speak(hints[2]);
        else if (skillLevel === 'expert' && !level.booksCorrect) this.speak(hints[3]);
        else if (level.cabinetLocked) this.speak(hints[skillLevel === 'beginner' ? 3 : 4]);
        else this.speak("All puzzles are solved—open the cabinet!");
        break;

      case 'DesertEscape':
        hints = this.desertEscapeMessages.hint;
        if (!inventory.hasItem('key')) this.speak(hints[0]);
        else if (!level.chestOpened) this.speak(hints[1]);
        else if (!level.scrollSolved) this.speak(hints[2]);
        else this.speak(hints[3]);
        break;

      case 'VerdantLabyrinth':
        skillLevel = level.difficulty || 'intermediate';
        hints = this.verdantLabyrinthMessages[skillLevel].hint;
        if (!level.elementalSources.water) this.speak(hints[0]);
        else if (level.playerElementOrder.length < Object.keys(level.elementalSources).length) this.speak(hints[1]);
        else if (level.templeHeartLocked) this.speak(hints[2]);
        else this.speak("The heart is awake—solve the final riddle!");
        break;

      case 'LunarCommandNexus':
        skillLevel = level.skillLevel || 'intermediate';
        hints = this.lunarCommandNexusMessages[skillLevel].hint;
        if (!level.dataProbe?.userData.activated) this.speak(hints[0]);
        else if (!level.thruster?.userData.active) this.speak(hints[1]);
        else if (!level.energyCoreActive) this.speak(hints[2]);
        else if (level.energyCore.position.distanceTo(level.resonator.position) > 1) this.speak(hints[3]);
        else this.speak(hints[4]);
        break;

      case 'CelestialForge':
        skillLevel = level.difficulty || 'intermediate';
        hints = this.celestialForgeMessages[skillLevel].hint;
        if (!level.bellowsActive) this.speak(hints[0]);
        else if (!level.gearsAligned) this.speak(hints[1]);
        else if (!level.steamAdjusted) this.speak(hints[2]);
        else this.speak("The forge is ready—craft the key!");
        break;

      default:
        this.speak(this.genericMessages.hint[Math.floor(Math.random() * this.genericMessages.hint.length)]);
    }
  }

  destroy() {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject(this.model);
    }
    
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }
    
    if (this.messageSprite) {
      if (this.messageSprite.material) {
        if (this.messageSprite.material.map) {
          this.messageSprite.material.map.dispose();
        }
        this.messageSprite.material.dispose();
      }
    }
    
    this.speech.cancel();
    console.log('[AICompanion] Destroyed');
  }

  disposeObject(object) {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
    if (object.children) object.children.forEach(child => this.disposeObject(child));
  }
}

export { AICompanion };