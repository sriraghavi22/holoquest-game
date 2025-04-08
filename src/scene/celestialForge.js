import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class CelestialForge extends THREE.Object3D {
  constructor(scene, skillLevel = 'beginner') {
    super();
    this.scene = scene;
    this.skillLevel = skillLevel.toLowerCase();
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.roomSize = { width: 25, height: 15, depth: 35 };
    this.wallThickness = 0.8;
    this.starShards = [];
    this.correctShardOrder = [0xFF3333, 0x33FF33, 0x3333FF]; // Red, Green, Blue (for Hard)
    this.shardOrder = []; // For Hard mode tracking
    this.anvilActive = false;
    this.gravityWells = [];
    this.forgeHeat = 0;
    this.requiredHeat = this.skillLevel === 'beginner' ? 20 : this.skillLevel === 'hard' ? 120 : 100;
    this.bladeForged = false;
    this.nebulaParticles = null;
    this.hintsEnabled = false;

    // Bind methods
    this.loadTexture = this.loadTexture.bind(this);
    this.loadModel = this.loadModel.bind(this);
    this.createForge = this.createForge.bind(this);
    this.init = this.init.bind(this);
    this.makeObjectInteractive = this.makeObjectInteractive.bind(this);
    this.ensureUVs = this.ensureUVs.bind(this);
    this.toggleHints = this.toggleHints.bind(this);
  }

  async init() {
    await Promise.all([
      this.createForge(),
      this.addFurniture(),
      this.addGravityWells(),
      this.addInteractiveObjects()
    ]);
    this.addLighting();
    this.addNebulaParticles();
    this.addBackgroundAudio();
    this.addFog();
    console.log(`CelestialForge initialized for ${this.skillLevel} level`, this.interactiveObjects);

    // eventBus.emit('showMessage', `Welcome to the Celestial Forge (${this.skillLevel})! Forge the legendary blade. ${this.getWelcomeMessage()}`);
    return this;
  }

  getWelcomeMessage() {
    switch (this.skillLevel) {
      case 'beginner':
        return 'Activate one gravity well, align one star shard, and heat the forge to 20%.';
      case 'intermediate':
        return 'Activate three gravity wells, align three star shards, and heat the forge to 100%.';
      case 'hard':
        return 'Activate three gravity wells, align three star shards in order (Red, Green, Blue), and heat the forge to 120%.';
      default:
        return 'Need help? Toggle hints with the hints button.';
    }
  }

  toggleHints() {
    this.hintsEnabled = !this.hintsEnabled;
    if (this.hintsEnabled) {
      eventBus.emit('showMessage', 'Hints enabled! I’ll guide you step-by-step.');
      this.provideHint();
    } else {
      eventBus.emit('showMessage', 'Hints disabled. Forge on your own!');
    }
  }

  provideHint() {
    if (!this.hintsEnabled || this.bladeForged) return;

    const activeWells = this.gravityWells.filter(w => w.userData.active).length;
    const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
    const alignedShards = this.starShards.filter(s => s.userData.aligned).length;
    const requiredShards = this.skillLevel === 'beginner' ? 1 : 3;

    if (activeWells < requiredWells) {
      eventBus.emit('showMessage', `Hint: Activate ${requiredWells - activeWells} more gravity well${requiredWells - activeWells > 1 ? 's' : ''} to stabilize the forge.`);
    } else if (alignedShards < requiredShards) {
      eventBus.emit('showMessage', `Hint: Align ${requiredShards - alignedShards} more star shard${requiredShards - alignedShards > 1 ? 's' : ''} above the anvil.`);
    } else if (this.skillLevel === 'hard' && !this.checkShardOrder()) {
      eventBus.emit('showMessage', 'Hint: Arrange the star shards in order: Red, Green, Blue.');
    } else if (this.forgeHeat < this.requiredHeat) {
      eventBus.emit('showMessage', `Hint: Pump the bellows to heat the forge to ${this.requiredHeat}%. (${Math.ceil((this.requiredHeat - this.forgeHeat) / 20)} more times)`);
    } else {
      eventBus.emit('showMessage', 'Hint: The forge is ready! Use the anvil to craft the blade.');
    }
  }

  async createForge() {
    const floorTexture = await this.loadTexture('/assets/textures/molten-metal.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(1, 1);
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(floorGeometry, 'floor');
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x1A1A33,
      emissiveIntensity: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    const wallTexture = await this.loadTexture('/assets/textures/molten-metal.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(1, 1);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.6,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x1A1A33,
      emissiveIntensity: 0.3
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
      this.add(wall);
      wall.userData.emissiveBase = 0.3;
    });

    const ceilingTexture = await this.loadTexture('/assets/textures/molten-metal.jpg');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(1, 1);
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(ceilingGeometry, 'ceiling');
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      emissive: 0x1A1A331,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    this.add(ceiling);
    ceiling.userData.emissiveBase = 0.1;

    const vortexTexture = await this.loadTexture('/assets/textures/molten-metal.jpg');
    const vortexGeometry = new THREE.CircleGeometry(8, 64);
    this.ensureUVs(vortexGeometry, 'vortex');
    const vortexMaterial = new THREE.MeshBasicMaterial({
      map: vortexTexture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      emissive: 0xFF00FF,
      emissiveIntensity: 0.5
    });
    this.cosmicVortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
    this.cosmicVortex.position.set(0, 7, -17);
    this.add(this.cosmicVortex);
  }

  async addFurniture() {
    try {
      const anvil = await this.loadModel('/assets/models/light_fighter_spaceship_-_free_-.glb');
      anvil.scale.set(0.5, 0.5, 0.5);
      anvil.position.set(0, 1.5, -5);
      anvil.userData.initialScale = new THREE.Vector3(0.5, 0.5, 0.5);
      this.anvil = anvil;
      this.add(anvil);
      this.objects.push(anvil);
      this.makeObjectInteractive(anvil, {
        name: 'cosmic_anvil',
        type: 'puzzle',
        interactable: true,
        action: () => {
          const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
          const requiredShards = this.skillLevel === 'beginner' ? 1 : 3;
          if (this.gravityWells.filter(w => w.userData.active).length < requiredWells) {
            eventBus.emit('showMessage', `The anvil is dormant. Activate ${requiredWells} gravity well${requiredWells > 1 ? 's' : ''} first.`);
          } else if (this.starShards.filter(s => s.userData.aligned).length < requiredShards) {
            eventBus.emit('showMessage', `The anvil hums faintly. Align ${requiredShards} star shard${requiredShards > 1 ? 's' : ''}.`);
          } else if (this.skillLevel === 'hard' && !this.checkShardOrder()) {
            eventBus.emit('showMessage', 'The anvil pulses. Align the shards in order: Red, Green, Blue.');
          } else if (this.forgeHeat < this.requiredHeat) {
            eventBus.emit('showMessage', `The anvil glows softly. Heat the forge to ${this.requiredHeat}%.`);
          } else {
            this.forgeBlade();
            eventBus.emit('showMessage', `The blade is forged! Victory at ${this.skillLevel} level!`);
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    } catch (error) {
      console.error('Error loading anvil model:', error);
      const anvilGeometry = new THREE.BoxGeometry(4, 2, 3);
      this.ensureUVs(anvilGeometry, 'anvil fallback');
      const anvilMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
      this.anvil = new THREE.Mesh(anvilGeometry, anvilMaterial);
      this.anvil.position.set(0, 1, -5);
      this.anvil.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(this.anvil);
      this.objects.push(this.anvil);
      this.makeObjectInteractive(this.anvil, {
        name: 'cosmic_anvil',
        type: 'puzzle',
        interactable: true,
        action: () => {
          const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
          const requiredShards = this.skillLevel === 'beginner' ? 1 : 3;
          if (this.gravityWells.filter(w => w.userData.active).length < requiredWells) {
            eventBus.emit('showMessage', `The anvil is dormant. Activate ${requiredWells} gravity well${requiredWells > 1 ? 's' : ''} first.`);
          } else if (this.starShards.filter(s => s.userData.aligned).length < requiredShards) {
            eventBus.emit('showMessage', `The anvil hums faintly. Align ${requiredShards} star shard${requiredShards > 1 ? 's' : ''}.`);
          } else if (this.skillLevel === 'hard' && !this.checkShardOrder()) {
            eventBus.emit('showMessage', 'The anvil pulses. Align the shards in order: Red, Green, Blue.');
          } else if (this.forgeHeat < this.requiredHeat) {
            eventBus.emit('showMessage', `The anvil glows softly. Heat the forge to ${this.requiredHeat}%.`);
          } else {
            this.forgeBlade();
            eventBus.emit('showMessage', `The blade is forged! Victory at ${this.skillLevel} level!`);
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    }

    // Updated bellows with GLB model
    try {
      const bellows = await this.loadModel('/assets/models/modofire_square_fire_table_-_36x36x16.glb'); // Adjust path as needed
      bellows.scale.set(15, 15, 15); // Adjust scale as needed for your model
      bellows.position.set(-5, 1, 1);
      bellows.userData.initialScale = new THREE.Vector3(1, 1, 1);
      
      // Apply material to all meshes in the model
      bellows.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513, 
            roughness: 0.5 
          });
        }
      });
      
      this.bellows = bellows;
      this.add(bellows);
      this.objects.push(bellows);
      this.makeObjectInteractive(bellows, {
        name: 'bellows',
        type: 'puzzle',
        interactable: true,
        action: () => {
          const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
          if (this.gravityWells.filter(w => w.userData.active).length < requiredWells) {
            eventBus.emit('showMessage', `The bellows are sluggish. Activate ${requiredWells} gravity well${requiredWells > 1 ? 's' : ''} first.`);
          } else {
            this.forgeHeat = Math.min(this.forgeHeat + 20, this.requiredHeat);
            this.animateBellows();
            eventBus.emit('showMessage', `Forge heat: ${this.forgeHeat}/${this.requiredHeat}%. Keep pumping!`);
            this.updateForgeGlow();
            if (this.forgeHeat === this.requiredHeat) {
              eventBus.emit('showMessage', 'The forge is at full heat! Use the anvil.');
            }
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    } catch (error) {
      console.error('Error loading bellows model:', error);
      // Fallback to original box geometry
      const bellowsGeometry = new THREE.BoxGeometry(2, 1, 3);
      this.ensureUVs(bellowsGeometry, 'bellows');
      const bellowsMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.5 });
      this.bellows = new THREE.Mesh(bellowsGeometry, bellowsMaterial);
      this.bellows.position.set(-5, 0.5, -5);
      this.bellows.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(this.bellows);
      this.objects.push(this.bellows);
      this.makeObjectInteractive(this.bellows, {
        name: 'bellows',
        type: 'puzzle',
        interactable: true,
        action: () => {
          const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
          if (this.gravityWells.filter(w => w.userData.active).length < requiredWells) {
            eventBus.emit('showMessage', `The bellows are sluggish. Activate ${requiredWells} gravity well${requiredWells > 1 ? 's' : ''} first.`);
          } else {
            this.forgeHeat = Math.min(this.forgeHeat + 20, this.requiredHeat);
            this.animateBellows();
            eventBus.emit('showMessage', `Forge heat: ${this.forgeHeat}/${this.requiredHeat}%. Keep pumping!`);
            this.updateForgeGlow();
            if (this.forgeHeat === this.requiredHeat) {
              eventBus.emit('showMessage', 'The forge is at full heat! Use the anvil.');
            }
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    }

    const crucibleGeometry = new THREE.CylinderGeometry(1, 1.5, 2, 32);
    this.ensureUVs(crucibleGeometry, 'crucible');
    const crucibleMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF4500,
      emissive: 0xFF4500,
      emissiveIntensity: 0.3,
      metalness: 0.8
    });
    this.crucible = new THREE.Mesh(crucibleGeometry, crucibleMaterial);
    this.crucible.position.set(5, 1, -5);
    this.crucible.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.crucible);
    this.objects.push(this.crucible);
  }

  async addInteractiveObjects() {
    const shardGeometry = new THREE.TetrahedronGeometry(0.5, 0);
    this.ensureUVs(shardGeometry, 'star shard');
    const shardCount = this.skillLevel === 'beginner' ? 1 : 3;
    const shardPositions = [
      new THREE.Vector3(-8, 3, -10),
      new THREE.Vector3(0, 4, -12),
      new THREE.Vector3(8, 2, -8)
    ].slice(0, shardCount);

    shardPositions.forEach((pos, i) => {
      const shardMaterial = new THREE.MeshStandardMaterial({
        color: this.correctShardOrder[i],
        emissive: this.correctShardOrder[i],
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
      });
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      shard.position.copy(pos);
      shard.userData.initialScale = new THREE.Vector3(1, 1, 1);
      shard.userData.aligned = false;
      shard.userData.color = this.correctShardOrder[i];
      this.add(shard);
      this.starShards.push(shard);
      this.makeObjectInteractive(shard, {
        name: `star_shard_${i}`,
        type: 'puzzle_piece',
        interactable: true,
        action: () => {
          const requiredWells = this.skillLevel === 'beginner' ? 1 : 3;
          if (this.gravityWells.filter(w => w.userData.active).length < requiredWells) {
            eventBus.emit('showMessage', `The shard floats aimlessly. Activate ${requiredWells} gravity well${requiredWells > 1 ? 's' : ''} first.`);
            return;
          }
          if (!shard.userData.aligned) {
            this.alignShard(shard);
            if (this.skillLevel === 'hard') {
              this.shardOrder.push(shard.userData.color);
              eventBus.emit('showMessage', `Shard aligned (${this.shardOrder.length}/${shardCount}). Order: ${this.colorToName(shard.userData.color)}`);
            } else {
              eventBus.emit('showMessage', `Shard aligned (${this.starShards.filter(s => s.userData.aligned).length}/${shardCount}).`);
            }
            if (this.starShards.every(s => s.userData.aligned)) {
              this.anvilActive = true;
              this.triggerStellarPulse();
              eventBus.emit('showMessage', 'All shards aligned! Heat the forge next.');
            }
          } else {
            eventBus.emit('showMessage', 'This shard is already aligned.');
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    });

    if (this.skillLevel !== 'beginner') {
      const lensGeometry = new THREE.SphereGeometry(0.7, 32, 32);
      this.ensureUVs(lensGeometry, 'lens');
      const lensMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.6,
        refractionRatio: 0.98
      });
      this.lens = new THREE.Mesh(lensGeometry, lensMaterial);
      this.lens.position.set(-2, 5, -15);
      this.lens.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(this.lens);
      this.makeObjectInteractive(this.lens, {
        name: 'light_lens',
        type: 'puzzle',
        interactable: true,
        action: () => {
          this.rotateLens();
          eventBus.emit('showMessage', 'The lens shifts, focusing cosmic light.');
          if (this.hintsEnabled) this.provideHint();
        }
      });
    }
  }

  async addGravityWells() {
    const wellGeometry = new THREE.CircleGeometry(1.5, 32);
    this.ensureUVs(wellGeometry, 'gravity well');
    const wellMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const wellCount = this.skillLevel === 'beginner' ? 1 : 3;
    for (let i = 0; i < wellCount; i++) {
      const well = new THREE.Mesh(wellGeometry, wellMaterial.clone());
      well.position.set(-5 + i * 5, 0.01, -10);
      well.rotation.x = -Math.PI / 2;
      well.userData.active = false;
      well.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(well);
      this.gravityWells.push(well);
      this.makeObjectInteractive(well, {
        name: `gravity_well_${i}`,
        type: 'puzzle',
        interactable: true,
        action: () => {
          if (!well.userData.active) {
            well.userData.active = true;
            well.material.opacity = 0.8;
            this.triggerGravityShift();
            const activeCount = this.gravityWells.filter(w => w.userData.active).length;
            eventBus.emit('showMessage', `Gravity well ${activeCount}/${wellCount} activated.`);
            if (this.gravityWells.every(w => w.userData.active)) {
              eventBus.emit('showMessage', 'All wells active! Align the star shards.');
            }
          } else {
            eventBus.emit('showMessage', 'This gravity well is already active.');
          }
          if (this.hintsEnabled) this.provideHint();
        }
      });
    }
  }

  addFog() {
    const fog = new THREE.FogExp2(0x1A0033, 0.02);
    this.scene.fog = fog;
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x333366, 0.3);
    this.add(this.ambientLight);

    this.anvilLight = new THREE.PointLight(0xFF4500, 0.5, 20);
    this.anvilLight.position.set(0, 3, -5);
    this.add(this.anvilLight);

    this.vortexLight = new THREE.PointLight(0xFF00FF, 0.7, 25);
    this.vortexLight.position.set(0, 7, -17);
    this.add(this.vortexLight);
  }

  addNebulaParticles() {
    const particleCount = this.skillLevel === 'beginner' ? 100 : 200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.roomSize.width);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0, this.roomSize.height);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.roomSize.depth);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFF99FF,
      size: 0.05,
      transparent: true,
      opacity: 0.4
    });
    this.nebulaParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.nebulaParticles);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/cosmic-forge-ambience.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(25);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 7.5, -5);
    this.add(sound);
  }

  alignShard(shard) {
    shard.userData.aligned = true;
    const targetPos = this.anvil.position.clone().add(new THREE.Vector3(0, 2, 0));
    let tIt = 0;
    const initialPos = shard.position.clone();
    const animate = () => {
      tIt += 0.05;
      shard.position.lerpVectors(initialPos, targetPos, tIt);
      shard.material.emissiveIntensity = 0.5 + tIt;
      if (tIt < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  animateBellows() {
    let tIt = 0;
    const initialScale = this.bellows.scale.clone();
    const animate = () => {
      tIt += 0.1;
      const scaleY = 1 + Math.sin(tIt * 5) * 0.2;
      this.bellows.scale.set(initialScale.x, scaleY, initialScale.z);
      if (tIt < 1) requestAnimationFrame(animate);
      else this.bellows.scale.copy(initialScale);
    };
    animate();
  }

  rotateLens() {
    let tIt = 0;
    const initialRot = this.lens.rotation.y;
    const targetRot = initialRot + Math.PI / 2;
    const animate = () => {
      tIt += 0.05;
      this.lens.rotation.y = THREE.MathUtils.lerp(initialRot, targetRot, tIt);
      if (tIt < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  triggerGravityShift() {
    this.objects.forEach(obj => {
      if (!obj.userData.fixed) {
        obj.position.y += 0.5;
        let tIt = 0;
        const initialY = obj.position.y;
        const animate = () => {
          tIt += 0.05;
          obj.position.y = initialY - Math.sin(tIt * 3) * 0.3;
          if (tIt < 1) requestAnimationFrame(animate);
        };
        animate();
      }
    });
  }

  triggerStellarPulse() {
    const pulseGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.ensureUVs(pulseGeometry, 'stellar pulse');
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.position.copy(this.anvil.position);
    this.add(pulse);
    let tIt = 0;
    const animate = () => {
      tIt += 0.05;
      pulse.scale.setScalar(1 + tIt * 3);
      pulse.material.opacity = 0.7 - tIt;
      if (tIt < 1) requestAnimationFrame(animate);
      else this.remove(pulse);
    };
    animate();
  }

  updateForgeGlow() {
    this.anvilLight.intensity = 0.5 + this.forgeHeat / 50;
    this.crucible.material.emissiveIntensity = 0.3 + this.forgeHeat / 100;
  }

  forgeBlade() {
    const bladeGeometry = new THREE.BoxGeometry(0.2, 3, 0.5);
    this.ensureUVs(bladeGeometry, 'blade');
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0xFF00FF,
      emissiveIntensity: 1
    });
    this.blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.set(0, 3, -5);
    this.blade.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.blade);
    this.bladeForged = true;
    this.triggerForgeBurst();
    eventBus.emit('game:win');
  }

  triggerForgeBurst() {
    const burstGeometry = new THREE.SphereGeometry(3, 32, 32);
    this.ensureUVs(burstGeometry, 'forge burst');
    const burstMaterial = new THREE.MeshBasicMaterial({
      color: 0xFF4500,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const burst = new THREE.Mesh(burstGeometry, burstMaterial);
    burst.position.copy(this.anvil.position);
    this.add(burst);
    let tIt = 0;
    const animate = () => {
      tIt += 0.05;
      burst.scale.setScalar(1 + tIt * 4);
      burst.material.opacity = 0.8 - tIt;
      if (tIt < 1) requestAnimationFrame(animate);
      else this.remove(burst);
    };
    animate();
  }

  checkShardOrder() {
    return this.skillLevel !== 'hard' || (
      this.shardOrder.length === this.correctShardOrder.length &&
      this.shardOrder.every((color, index) => color === this.correctShardOrder[index])
    );
  }

  colorToName(color) {
    switch (color) {
      case 0xFF3333: return 'Red';
      case 0x33FF33: return 'Green';
      case 0x3333FF: return 'Blue';
      default: return 'Unknown';
    }
  }

  update(delta) {
    this.preserveScales();
    if (this.nebulaParticles) {
      const positions = this.nebulaParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.001;
        if (positions[i] > this.roomSize.width / 2) positions[i] = -this.roomSize.width / 2;
      }
      this.nebulaParticles.geometry.attributes.position.needsUpdate = true;
    }
    this.cosmicVortex.rotation.z += 0.01 * delta;
    this.children.forEach(child => {
      if (child.material && child.userData.emissiveBase) {
        child.material.emissiveIntensity = child.userData.emissiveBase + Math.sin(Date.now() * 0.0007) * 0.1;
      }
    });
  }

  preserveScales() {
    this.objects.forEach(obj => {
      if (obj.userData.initialScale) {
        obj.scale.copy(obj.userData.initialScale);
      }
    });
  }

  makeObjectInteractive(object, data) {
    object.userData = {
      ...object.userData,
      ...data,
      isInteractive: true,
      onHover: data.onHover || (() => {}),
      onUnhover: data.onUnhover || (() => {})
    };
    this.interactiveObjects.push(object);

    if (object instanceof THREE.Mesh && object.geometry) {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFD700,
        side: THREE.BackSide
      });
      const outlineMesh = new THREE.Mesh(object.geometry.clone(), outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.07);
      outlineMesh.visible = false;
      object.add(outlineMesh);
      object.userData.outlineMesh = outlineMesh;
    }
    console.log(`Made ${data.name} interactive with hover effects`);
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

  getInteractiveObjects() {
    console.log('Interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    return this.interactiveObjects;
  }
}

export { CelestialForge };