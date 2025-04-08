import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class LunarCommandNexus extends THREE.Object3D {
  constructor(scene, level = 5) {
    super();
    this.scene = scene;
    this.skillLevel = level === 5 ? 'expert' : 'intermediate';
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();
    this.holoPanels = [];

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.roomSize = { width: 25, height: 12, depth: 35 };
    this.wallThickness = 0.5;
    this.energyCoreActive = false;
    this.frequencyAligned = false;
    this.cosmicSignal = [Math.random() * 100, Math.random() * 100, Math.random() * 100];
    this.currentFrequencies = [50, 50, 50];
    this.dialValues = [0, 0, 0];
    console.log(`LunarCommandNexus initialized for level ${level} (${this.skillLevel})`);
  }

  async init() {
    await this.createControlRoom();
    await this.addFurniture();
    await this.addHoloPanels();
    await this.addInteractiveObjects();
    this.addLighting();
    this.addLunarParticles();
    this.addBackgroundAudio();
    this.addFog();
    console.log(`LunarCommandNexus fully initialized for level ${this.skillLevel}`);
    return this;
  }

  async createControlRoom() {
    const floorTexture = await this.loadTexture('/assets/textures/lunar-metal-cracked.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 7);
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(floorGeometry, 'floor');
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.6,
      metalness: 0.8,
      color: 0x4A5A6B
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    const wallTexture = await this.loadTexture('/assets/textures/spaceship-panels.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 3);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.4,
      metalness: 0.9,
      side: THREE.DoubleSide,
      emissiveIntensity: 0.1
    });

    const wallGeometries = [
      new THREE.BoxGeometry(this.roomSize.width, this.roomSize.height, this.wallThickness),
      new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth),
      new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth)
    ];
    wallGeometries.forEach(geo => this.ensureUVs(geo, 'wall'));
    const wallPositions = [
      { x: 0, y: this.roomSize.height / 2, z: -this.roomSize.depth / 2 },
      { x: -this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 },
      { x: this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 }
    ];

    wallGeometries.forEach((geometry, index) => {
      const wall = new THREE.Mesh(geometry, wallMaterial.clone());
      wall.position.set(wallPositions[index].x, wallPositions[index].y, wallPositions[index].z);
      wall.name = `wall_${index}`;
      this.add(wall);
      this.addCollisionBox(wall, new THREE.Vector3(
        index === 0 ? this.roomSize.width : this.wallThickness,
        this.roomSize.height,
        index === 0 ? this.wallThickness : this.roomSize.depth
      ));
      wall.userData.emissiveBase = 0.1;
    });

    const ceilingTexture = await this.loadTexture('/assets/textures/star-map-holo.jpg');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(3, 4);
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(ceilingGeometry, 'ceiling');
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.5,
      metalness: 0.7,
      // emissive: 0xFFFFFF,
      emissiveIntensity: 0.05,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    ceiling.name = 'ceiling';
    this.add(ceiling);
    this.addCollisionBox(ceiling, new THREE.Vector3(this.roomSize.width, 0.1, this.roomSize.depth));

    const viewportTexture = await this.loadTexture('/assets/textures/gas-giant.jpg');
    const viewportGeometry = new THREE.PlaneGeometry(10, 8);
    this.ensureUVs(viewportGeometry, 'viewport');
    const viewportMaterial = new THREE.MeshBasicMaterial({
      map: viewportTexture,
      emissive: 0xFF4500,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide
    });
    this.viewport = new THREE.Mesh(viewportGeometry, viewportMaterial);
    this.viewport.position.set(0, 6, -17.4);
    this.viewport.name = 'viewport';
    this.add(this.viewport);
    this.addCollisionBox(this.viewport, new THREE.Vector3(10, 8, 0.1));
  }

  async addFurniture() {
    let consoleModel;
    try {
      consoleModel = await this.loadModel('/assets/models/control-console.glb');
      consoleModel.scale.set(3, 3, 3);
      consoleModel.position.set(0, 0.5, -10);
      consoleModel.rotation.y = Math.PI ;
      consoleModel.userData.initialScale = new THREE.Vector3(3, 3, 3);
      consoleModel.name = 'control_console';
      this.console = consoleModel;
    } catch (error) {
      const consoleGeometry = new THREE.BoxGeometry(6, 4, 3);
      this.ensureUVs(consoleGeometry, 'console fallback');
      const consoleMaterial = new THREE.MeshStandardMaterial({ color: 0x2F4F4F, roughness: 0.5 });
      consoleModel = new THREE.Mesh(consoleGeometry, consoleMaterial);
      consoleModel.position.set(0, 2, -10);
      consoleModel.userData.initialScale = new THREE.Vector3(1, 1, 1);
      consoleModel.name = 'control_console_fallback';
      this.console = consoleModel;
      console.error('Error loading console model:', error);
    }
    this.add(consoleModel);
    this.objects.push(consoleModel);
    this.addCollisionBox(consoleModel, new THREE.Vector3(6, 4, 3));
    this.makeObjectInteractive(consoleModel, {
      name: 'control_console',
      type: 'puzzle',
      interactable: true,
      action: () => {
        console.log('Console interaction - energyCoreActive:', this.energyCoreActive);
        if (!this.energyCoreActive) {
          eventBus.emit('showMessage', 'The console is locked. Place the energy core in the resonator.');
        } else {
          eventBus.emit('showMessage', 'The console pulses with energy! Solve the cosmic riddle to launch.');
          this.showFinalPuzzleUI();
        }
      }
    });

    const thrusterGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 32);
    this.ensureUVs(thrusterGeometry, 'thruster');
    const thrusterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4682B4,
      metalness: 0.8,
      roughness: 0.3
    });
    this.thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    this.thruster.position.set(-8, 1, -5);
    this.thruster.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.thruster.userData.active = false;
    this.thruster.name = 'thruster_node';
    this.add(this.thruster);
    this.objects.push(this.thruster);
    this.addCollisionBox(this.thruster, new THREE.Vector3(0.4, 2, 0.4));
    this.makeObjectInteractive(this.thruster, {
      name: 'thruster_node',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.dataProbe?.userData.activated) {
          eventBus.emit('showMessage', 'The thruster is dormant. Activate the quantum probe first.');
        } else if (!this.thruster.userData.active) {
          this.thruster.userData.active = true;
          eventBus.emit('showMessage', 'The thruster awakens with lunar energy!');
        } else {
          eventBus.emit('showMessage', 'The thruster is active and resonating.');
        }
      }
    });

    const projectorGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    this.ensureUVs(projectorGeometry, 'projector');
    const projectorMaterial = new THREE.MeshStandardMaterial({
      color: 0x00CED1,
      emissive: 0x00CED1,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.8
    });
    this.projector = new THREE.Mesh(projectorGeometry, projectorMaterial);
    this.projector.position.set(0, 10, 0);
    this.projector.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.projector.name = 'holo_projector';
    this.add(this.projector);
    this.objects.push(this.projector);
    this.addCollisionBox(this.projector, new THREE.Vector3(1, 1, 1));
  }

  async addInteractiveObjects() {
    const coreGeometry = new THREE.IcosahedronGeometry(0.5, 2);
    this.ensureUVs(coreGeometry, 'energy_core');
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF00FF,
      emissive: 0xFF00FF,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.85
    });
    this.energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.energyCore.position.set(6, 2.5, -5);
    this.energyCore.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.energyCore.name = 'energy_core';
    this.add(this.energyCore);
    this.makeObjectInteractive(this.energyCore, {
      name: 'energy_core',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.thruster.userData.active) {
          eventBus.emit('showMessage', 'The core flickers faintly. Power the thruster first.');
        } else if (!this.energyCoreActive) {
          this.showFrequencyUI();
        } else {
          eventBus.emit('showMessage', 'The core is ready! Place it in the resonator.');
        }
      }
    });

    const probeGeometry = new THREE.TetrahedronGeometry(0.2);
    this.ensureUVs(probeGeometry, 'probe');
    const probeMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.5 });
    this.dataProbe = new THREE.Mesh(probeGeometry, probeMaterial);
    this.dataProbe.position.set(-4, 2.2, -2);
    this.dataProbe.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.dataProbe.userData.activated = false;
    this.dataProbe.name = 'quantum_probe';
    this.add(this.dataProbe);
    this.makeObjectInteractive(this.dataProbe, {
      name: 'quantum_probe',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.dataProbe.userData.activated) {
          this.dataProbe.userData.activated = true;
          eventBus.emit('showMessage', 'The quantum probe hums to life!');
        } else {
          eventBus.emit('showMessage', 'The probe is already active.');
        }
      }
    });

    const resonatorGeometry = new THREE.TorusKnotGeometry(0.5, 0.15, 64, 8);
    this.ensureUVs(resonatorGeometry, 'resonator');
    const resonatorMaterial = new THREE.MeshStandardMaterial({
      color: 0x00FFFF,
      emissive: 0x00FFFF,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.9
    });
    this.resonator = new THREE.Mesh(resonatorGeometry, resonatorMaterial);
    this.resonator.position.set(0, 1, 0);
    this.resonator.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.resonator.name = 'lunar_resonator';
    this.add(this.resonator);
    this.addCollisionBox(this.resonator, new THREE.Vector3(1, 1, 1));
    this.makeObjectInteractive(this.resonator, {
      name: 'lunar_resonator',
      type: 'puzzle',
      interactable: true,
      action: () => {
        console.log('Resonator interaction - energyCoreActive:', this.energyCoreActive);
        if (!this.energyCoreActive) {
          eventBus.emit('showMessage', 'The resonator is silent. Align the frequencies to charge the core.');
        } else if (this.energyCore.position.distanceTo(this.resonator.position) > 1) {
          this.energyCore.position.copy(this.resonator.position);
          this.triggerResonanceWave();
          this.energyCoreActive = true;
          console.log('Core placed in resonator - energyCoreActive set to true');
          eventBus.emit('showMessage', 'The core resonates! The console is now accessible.');
        } else {
          eventBus.emit('showMessage', 'The core is already placed in the resonator.');
        }
      }
    });
  }

  async addHoloPanels() {
    const holoTexture = await this.loadTexture('/assets/textures/holo-grid.png');
    const holoMaterial = new THREE.MeshStandardMaterial({
      map: holoTexture,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      emissive: 0xFF00FF,
      emissiveIntensity: 0.5
    });

    for (let i = 0; i < 3; i++) {
      const holoGeometry = new THREE.CircleGeometry(1, 32);
      this.ensureUVs(holoGeometry, 'holo_dial');
      const dial = new THREE.Mesh(holoGeometry, holoMaterial.clone());
      dial.position.set(-2 + i * 2, 6, -10);
      dial.rotation.x = -Math.PI / 2;
      dial.userData.rotationSpeed = 0.02 * (i + 1);
      dial.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.holoPanels.push(dial);
      this.add(dial);
    }
  }

  addFog() {
    const fog = new THREE.FogExp2(0x1C2526, 0.02);
    this.scene.fog = fog;
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.15);
    this.add(this.ambientLight);

    this.energyLight = new THREE.PointLight(0xFF00FF, 0.5, 20);
    this.energyLight.position.set(6, 2.5, -5);
    this.add(this.energyLight);

    const viewportLight = new THREE.PointLight(0xFF4500, 0.6, 25);
    viewportLight.position.set(0, 6, -16);
    this.add(viewportLight);
  }

  addLunarParticles() {
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.roomSize.width);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0, this.roomSize.height);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.roomSize.depth);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFF00FF,
      size: 0.05,
      transparent: true,
      opacity: 0.3
    });
    this.lunarParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.lunarParticles);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/lunar-ambience.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(25);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 6, 0);
    this.add(sound);
  }

  showFrequencyUI() {
    const existingUI = document.getElementById('frequency-ui');
    if (existingUI) return;

    const uiContainer = document.createElement('div');
    uiContainer.id = 'frequency-ui';
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '50%';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translate(-50%, -50%)';
    uiContainer.style.background = 'linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(20, 10, 30, 0.95)), url(/assets/textures/lunar-metal-bg.jpg)';
    uiContainer.style.backgroundSize = 'cover';
    uiContainer.style.padding = '40px';
    uiContainer.style.borderRadius = '20px';
    uiContainer.style.border = '3px solid #00AACC';
    uiContainer.style.boxShadow = '0 0 30px rgba(0, 170, 204, 0.7), inset 0 0 15px rgba(0, 255, 255, 0.3)';
    uiContainer.style.zIndex = '2000';
    uiContainer.style.fontFamily = "'Courier New', monospace";
    uiContainer.style.color = '#E0E0FF';
    uiContainer.style.textShadow = '0 0 8px #00FFFF, 0 0 4px #00AACC';

    const title = document.createElement('h2');
    title.textContent = `Lunar Frequency Alignment [${this.skillLevel}]`;
    title.style.margin = '0 0 25px 0';
    title.style.textAlign = 'center';
    title.style.fontSize = '28px';
    title.style.animation = 'pulse 2s infinite';
    uiContainer.appendChild(title);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { text-shadow: 0 0 8px #00FFFF, 0 0 4px #00AACC; }
        50% { text-shadow: 0 0 12px #00FFFF, 0 0 6px #00AACC; }
        100% { text-shadow: 0 0 8px #00FFFF, 0 0 4px #00AACC; }
      }
    `;
    document.head.appendChild(style);

    const dialContainer = document.createElement('div');
    dialContainer.style.display = 'flex';
    dialContainer.style.gap = '30px';
    dialContainer.style.justifyContent = 'center';
    dialContainer.style.background = 'rgba(0, 0, 0, 0.5)';
    dialContainer.style.padding = '20px';
    dialContainer.style.borderRadius = '10px';
    dialContainer.style.border = '1px solid #00FFFF';

    const labels = ['Alpha', 'Beta', 'Gamma'];
    const dials = [];
    labels.forEach((label, index) => {
      const dialWrapper = document.createElement('div');
      dialWrapper.style.textAlign = 'center';
      dialWrapper.style.width = '120px';

      const dialLabel = document.createElement('div');
      dialLabel.textContent = `${label} Wave`;
      dialLabel.style.fontSize = '18px';
      dialLabel.style.color = '#00AACC';
      dialLabel.style.marginBottom = '10px';
      dialLabel.style.textTransform = 'uppercase';
      dialWrapper.appendChild(dialLabel);

      const dial = document.createElement('input');
      dial.type = 'range';
      dial.min = '-180';
      dial.max = '180';
      dial.value = '0';
      dial.style.width = '100%';
      dial.style.appearance = 'none';
      dial.style.background = 'linear-gradient(to right, #1E90FF, #00FFFF)';
      dial.style.height = '10px';
      dial.style.borderRadius = '5px';
      dial.style.outline = 'none';
      dial.style.cursor = 'pointer';
      dial.style.boxShadow = 'inset 0 0 5px #00AACC';
      dial.oninput = () => {
        this.dialValues[index] = parseInt(dial.value);
        this.currentFrequencies[index] = 50 + (this.dialValues[index] / 180) * 50;
        freqDisplay.textContent = `Current: ${this.currentFrequencies.map(f => f.toFixed(1)).join(' | ')} Hz`;
        this.updateDialVisuals(index);
      };
      dialWrapper.appendChild(dial);
      dials.push(dial);

      const freqValue = document.createElement('div');
      freqValue.textContent = `${this.currentFrequencies[index].toFixed(1)} Hz`;
      freqValue.style.fontSize = '14px';
      freqValue.style.color = '#E0E0FF';
      freqValue.style.marginTop = '5px';
      dialWrapper.appendChild(freqValue);

      dialContainer.appendChild(dialWrapper);
    });

    uiContainer.appendChild(dialContainer);

    const freqDisplay = document.createElement('div');
    freqDisplay.style.marginTop = '25px';
    freqDisplay.style.fontSize = '16px';
    freqDisplay.style.textAlign = 'center';
    freqDisplay.style.color = '#00FFFF';
    freqDisplay.textContent = `Current: ${this.currentFrequencies.map(f => f.toFixed(1)).join(' | ')} Hz`;
    uiContainer.appendChild(freqDisplay);

    const targetDisplay = document.createElement('div');
    targetDisplay.style.marginTop = '10px';
    targetDisplay.style.fontSize = '14px';
    targetDisplay.style.textAlign = 'center';
    targetDisplay.style.color = '#FF00FF';
    targetDisplay.textContent = `Target: ${this.cosmicSignal.map(f => f.toFixed(1)).join(' | ')} Hz`;
    uiContainer.appendChild(targetDisplay);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Sync Frequencies';
    submitButton.style.marginTop = '30px';
    submitButton.style.width = '100%';
    submitButton.style.padding = '12px';
    submitButton.style.background = 'linear-gradient(45deg, #1E90FF, #00FFFF)';
    submitButton.style.border = '2px solid #00AACC';
    submitButton.style.borderRadius = '8px';
    submitButton.style.color = '#FFFFFF';
    submitButton.style.fontSize = '18px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.textShadow = '0 0 6px #00FFFF';
    submitButton.style.transition = 'all 0.3s ease';
    submitButton.onmouseover = () => {
      submitButton.style.background = 'linear-gradient(45deg, #00AACC, #1E90FF)';
      submitButton.style.transform = 'scale(1.05)';
    };
    submitButton.onmouseout = () => {
      submitButton.style.background = 'linear-gradient(45deg, #1E90FF, #00FFFF)';
      submitButton.style.transform = 'scale(1)';
    };
    submitButton.onclick = () => {
      this.handleFrequencyAlignment();
      document.body.removeChild(uiContainer);
      eventBus.emit('resumeGame');
    };
    uiContainer.appendChild(submitButton);

    document.body.appendChild(uiContainer);
    eventBus.emit('pauseGame');
  }

  updateDialVisuals(index) {
    const dial = this.holoPanels[index];
    dial.rotation.z = (this.dialValues[index] / 180) * Math.PI;
    dial.material.emissiveIntensity = 0.5 + Math.abs(this.dialValues[index]) / 360;
  }

  handleFrequencyAlignment() {
    const tolerance = 5;
    const isAligned = this.currentFrequencies.every((freq, i) => 
      Math.abs(freq - this.cosmicSignal[i]) <= tolerance
    );
    if (isAligned) {
      this.energyCoreActive = true;
      this.triggerCorePulse(this.energyCore);
      this.energyCore.material.color.setHex(0xFFFFFF);
      eventBus.emit('showMessage', 'Frequencies aligned! The core is charged.');
    } else {
      eventBus.emit('showMessage', 'Frequencies misaligned! Adjust the dials closer to the cosmic signal.');
    }
  }

  showFinalPuzzleUI() {
    const uiContainer = document.createElement('div');
    uiContainer.id = 'final-puzzle-ui';
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '50%';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translate(-50%, -50%)';
    uiContainer.style.background = 'linear-gradient(135deg, rgba(15, 25, 45, 0.95), rgba(25, 15, 35, 0.95)), url(/assets/textures/lunar-metal-bg.jpg)';
    uiContainer.style.backgroundSize = 'cover';
    uiContainer.style.padding = '45px';
    uiContainer.style.borderRadius = '25px';
    uiContainer.style.border = '3px solid #FF00CC';
    uiContainer.style.boxShadow = '0 0 35px rgba(255, 0, 204, 0.7), inset 0 0 20px rgba(255, 100, 255, 0.3)';
    uiContainer.style.zIndex = '2000';
    uiContainer.style.fontFamily = "'Courier New', monospace";
    uiContainer.style.color = '#E0E0FF';
    uiContainer.style.textShadow = '0 0 10px #FF00CC, 0 0 5px #FF66CC';

    const title = document.createElement('h2');
    title.textContent = `Cosmic Decryption [${this.skillLevel}]`;
    title.style.margin = '0 0 30px 0';
    title.style.textAlign = 'center';
    title.style.fontSize = '30px';
    title.style.animation = 'glow 2s infinite';
    uiContainer.appendChild(title);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes glow {
        0% { text-shadow: 0 0 10px #FF00CC, 0 0 5px #FF66CC; }
        50% { text-shadow: 0 0 15px #FF00CC, 0 0 8px #FF66CC; }
        100% { text-shadow: 0 0 10px #FF00CC, 0 0 5px #FF66CC; }
      }
    `;
    document.head.appendChild(style);

    const riddle = document.createElement('div');
    // Level 5 (expert) gets a unique riddle with 7 letters, others use the default with 6 letters
    riddle.textContent = this.skillLevel === 'expert' 
      ? 'Decrypt: "I dance in the dark, binding worlds unseen. What am I?" (7 letters)' 
      : 'Decrypt: "I am the void’s breath, fueling stars unseen. What am I?" (6 letters)';
    riddle.style.fontSize = '18px';
    riddle.style.marginBottom = '25px';
    riddle.style.textAlign = 'center';
    riddle.style.padding = '10px';
    riddle.style.background = 'rgba(0, 0, 0, 0.6)';
    riddle.style.borderRadius = '5px';
    uiContainer.appendChild(riddle);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = this.skillLevel === 'expert' ? 7 : 6; // Adjust maxLength for level 5
    input.style.width = '100%';
    input.style.padding = '15px';
    input.style.background = 'rgba(0, 0, 0, 0.7)';
    input.style.border = '2px solid #FF00CC';
    input.style.borderRadius = '10px';
    input.style.color = '#E0E0FF';
    input.style.fontSize = '18px';
    input.style.textAlign = 'center';
    input.style.outline = 'none';
    input.style.boxShadow = 'inset 0 0 10px #FF66CC';
    input.placeholder = 'Enter code...';
    uiContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Initiate Launch Sequence';
    submitButton.style.marginTop = '35px';
    submitButton.style.width = '100%';
    submitButton.style.padding = '15px';
    submitButton.style.background = 'linear-gradient(45deg, #FF00CC, #FF66CC)';
    submitButton.style.border = '2px solid #FF00CC';
    submitButton.style.borderRadius = '10px';
    submitButton.style.color = '#FFFFFF';
    submitButton.style.fontSize = '20px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.textShadow = '0 0 8px #FF00CC';
    submitButton.style.transition = 'all 0.3s ease';
    submitButton.onmouseover = () => {
      submitButton.style.background = 'linear-gradient(45deg, #FF66CC, #FF00CC)';
      submitButton.style.transform = 'scale(1.05)';
    };
    submitButton.onmouseout = () => {
      submitButton.style.background = 'linear-gradient(45deg, #FF00CC, #FF66CC)';
      submitButton.style.transform = 'scale(1)';
    };
    submitButton.onclick = () => {
      this.handleFinalPuzzle(input.value);
      document.body.removeChild(uiContainer);
      eventBus.emit('resumeGame');
    };
    uiContainer.appendChild(submitButton);

    document.body.appendChild(uiContainer);
    setTimeout(() => input.focus(), 0);
    eventBus.emit('pauseGame');
  }

  handleFinalPuzzle(input) {
    const correctAnswer = this.skillLevel === 'expert' ? 'gravity' : 'plasma';
    if (input.toLowerCase() === correctAnswer) {
      eventBus.emit('showMessage', `Victory! The ship tears through the void, escaping the Lunar Nexus (${this.skillLevel})!`);
      eventBus.emit('game:win');
    } else {
      eventBus.emit('showMessage', 'Signal decryption failed! Try again.');
    }
  }

  triggerResonanceWave() {
    const waveGeometry = new THREE.RingGeometry(0.1, 2, 32);
    this.ensureUVs(waveGeometry, 'wave');
    const waveMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });
    const wave = new THREE.Mesh(waveGeometry, waveMaterial);
    wave.position.copy(this.resonator.position);
    wave.rotation.x = -Math.PI / 2;
    this.add(wave);
    let scale = 1;
    const animate = () => {
      scale += 0.1;
      wave.scale.set(scale, scale, 1);
      wave.material.opacity -= 0.05;
      if (scale < 5) requestAnimationFrame(animate);
      else this.remove(wave);
    };
    animate();
  }

  triggerCorePulse(core) {
    let t = 0;
    const initialScale = core.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 1 + Math.sin(t * 6) * 0.3;
      core.scale.set(scale, scale, scale);
      core.material.emissiveIntensity = 1.8 + Math.sin(t * 6) * 0.5;
      if (t < 2) requestAnimationFrame(animate);
      else {
        core.scale.copy(initialScale);
        core.material.emissiveIntensity = 1.8;
      }
    };
    animate();
  }

  animateProbe(probe) {
    let t = 0;
    const initialRot = probe.rotation.clone();
    const animate = () => {
      t += 0.05;
      probe.rotation.x = initialRot.x + Math.sin(t * 5) * 0.4;
      probe.rotation.y = initialRot.y + Math.cos(t * 5) * 0.4;
      if (t < 1) requestAnimationFrame(animate);
      else probe.rotation.copy(initialRot);
    };
    animate();
  }

  update(delta) {
    this.preserveScales();
    if (this.lunarParticles) {
      const positions = this.lunarParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.003;
        if (positions[i + 1] > this.roomSize.height) positions[i + 1] = 0;
      }
      this.lunarParticles.geometry.attributes.position.needsUpdate = true;
    }
    this.holoPanels.forEach(dial => {
      dial.rotation.z += dial.userData.rotationSpeed * delta;
    });
    if (this.resonator) {
      this.resonator.rotation.y += 0.02 * delta;
    }
  }

  addCollisionBox(object, size = null) {
    if (!size) {
      const box = new THREE.Box3().setFromObject(object);
      size = new THREE.Vector3();
      box.getSize(size);
    }
    object.userData.isCollider = true;
    object.userData.collider = { type: 'box', size: size, position: object.position.clone() };
    console.log(`[DEBUG] Collider added to ${object.name || 'unnamed object'} at ${object.position.toArray()} with size:`, size.toArray());
  }

  makeObjectInteractive(object, data) {
    object.userData = { 
      ...object.userData, 
      ...data, 
      isInteractive: true,
      onHover: data.onHover || (() => {
        if (object.userData.outlineMesh) object.userData.outlineMesh.visible = true;
      }),
      onUnhover: data.onUnhover || (() => {
        if (object.userData.outlineMesh) object.userData.outlineMesh.visible = false;
      })
    };
    this.interactiveObjects.push(object);
    if (object instanceof THREE.Mesh && object.geometry) {
      const outlineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF00FF, 
        side: THREE.BackSide 
      });
      const outlineMesh = new THREE.Mesh(object.geometry.clone(), outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.1);
      outlineMesh.visible = false;
      object.add(outlineMesh);
      object.userData.outlineMesh = outlineMesh;
    }
    console.log(`Made ${data.name} interactive with hover effects`);
  }

  loadTexture(path) {
    return new Promise((resolve) => {
      this.textureLoader.load(path, resolve, undefined, (error) => {
        console.error(`Failed to load texture: ${path}`, error);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        context.fillStyle = '#AAAAAA';
        context.fillRect(0, 0, 256, 256);
        resolve(new THREE.CanvasTexture(canvas));
      });
    });
  }

  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (!child.geometry.attributes.uv) {
                console.warn(`Model ${path} mesh missing UVs, adding fallback`, child);
                const uvs = new Float32Array(child.geometry.attributes.position.count * 2);
                child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                for (let i = 0; i < uvs.length; i += 2) {
                  uvs[i] = (i / 2) % 2;
                  uvs[i + 1] = Math.floor((i / 2) / 2) % 2;
                }
              }
            }
          });
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  ensureUVs(geometry, name) {
    if (!geometry.attributes.uv) {
      console.warn(`Geometry for ${name} missing UVs, adding fallback`);
      const uvs = new Float32Array(geometry.attributes.position.count * 2);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = (i / 2) % 2;
        uvs[i + 1] = Math.floor((i / 2) / 2) % 2;
      }
    }
  }

  preserveScales() {
    this.objects.forEach(obj => {
      if (obj.userData.initialScale) {
        obj.scale.copy(obj.userData.initialScale);
      }
    });
  }

  getInteractiveObjects() {
    console.log('Interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    return this.interactiveObjects;
  }
}

export { LunarCommandNexus };