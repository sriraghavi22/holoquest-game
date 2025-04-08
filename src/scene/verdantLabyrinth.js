import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class VerdantLabyrinth extends THREE.Object3D {
  constructor(scene, difficulty = 'intermediate') {
    super();
    this.scene = scene;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.roomSize = { width: 30, height: 20, depth: 30 };
    this.difficulty = difficulty.toLowerCase();
    this.elementalSources = this.setElementalSources();
    this.vineGrowth = 0;
    this.templeHeartLocked = true;
    this.templeHeart = null;
    this.fireflies = null;
    this.waterFlow = null;
    this.elementalNodes = [];
    this.correctElementOrder = this.setCorrectElementOrder();
    this.playerElementOrder = [];
  }

  setElementalSources() {
    switch (this.difficulty) {
      case 'beginner':
        return { water: false, earth: false };
      case 'expert':
        return { water: false, earth: false, fire: false, air: false, light: false };
      case 'intermediate':
      default:
        return { water: false, fire: false, earth: false, air: false };
    }
  }

  setCorrectElementOrder() {
    switch (this.difficulty) {
      case 'beginner':
        return [];
      case 'expert':
        return ['water', 'earth', 'fire', 'air', 'light'];
      case 'intermediate':
      default:
        return ['water', 'earth', 'fire', 'air'];
    }
  }

  async init() {
    const floorTexture = await this.loadTexture('/assets/textures/mossy-stone.jpg');
    const wallTexture = await this.loadTexture('/assets/textures/jungle-stone.jpg');
    const ceilingTexture = await this.loadTexture('/assets/textures/vine-canopy.jpg');

    await Promise.all([
      this.createJungleTemple(floorTexture, wallTexture, ceilingTexture),
      this.addNaturalFurniture(),
      this.addElementalNodes(),
      this.addInteractiveObjects()
    ]);
    await this.addFireflies();
    await this.addDeer();
    await this.addBushes();
    this.addLighting();
    this.addJungleMist();
    this.addBackgroundAudio();
    console.log(`VerdantLabyrinth (${this.difficulty}) initialized`, this.interactiveObjects);
    return this;
  }

  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (error) => {
          console.error(`Failed to load texture: ${path}`, error);
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const context = canvas.getContext('2d');
          context.fillStyle = '#AAAAAA';
          context.fillRect(0, 0, 256, 256);
          resolve(new THREE.CanvasTexture(canvas));
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

  async createJungleTemple(floorTexture, wallTexture, ceilingTexture) {
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(6, 6);
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(floorGeometry, 'floor');
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.6,
      metalness: 0.2,
      color: 0x4A7043
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const wallGeometries = [
      new THREE.BoxGeometry(this.roomSize.width, this.roomSize.height, 0.5),
      new THREE.BoxGeometry(0.5, this.roomSize.height, this.roomSize.depth),
      new THREE.BoxGeometry(0.5, this.roomSize.height, this.roomSize.depth)
    ];
    wallGeometries.forEach(geo => this.ensureUVs(geo, 'wall'));
    const wallPositions = [
      { x: 0, y: this.roomSize.height / 2, z: -this.roomSize.depth / 2 },
      { x: -this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 },
      { x: this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 }
    ];
    wallGeometries.forEach((geo, i) => {
      const wall = new THREE.Mesh(geo, wallMaterial.clone());
      wall.position.set(wallPositions[i].x, wallPositions[i].y, wallPositions[i].z);
      this.add(wall);
    });

    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(ceilingGeometry, 'ceiling');
    const ceilingMaterial = new THREE.MeshBasicMaterial({
      map: ceilingTexture,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    this.add(ceiling);
  }

  async addNaturalFurniture() {
    let tree;
    try {
      const gltf = await this.loadModel('/assets/models/ancient-tree.glb');
      tree = gltf.scene;
      tree.scale.set(0.5, 0.5, 0.5);
      tree.position.set(0, 0, -5);
      tree.userData.initialScale = new THREE.Vector3(3, 3, 3);
      this.templeHeart = tree;
      this.add(tree);
      this.objects.push(tree);
    } catch (error) {
      console.error('Error loading tree:', error);
      const treeGeometry = new THREE.CylinderGeometry(1, 1, 5, 32);
      this.ensureUVs(treeGeometry, 'tree fallback');
      const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x3C2F2F, roughness: 0.8, emissive: 0xFF0000, emissiveIntensity: 0.5 });
      tree = new THREE.Mesh(treeGeometry, treeMaterial);
      tree.position.set(0, 2.5, -5);
      tree.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.templeHeart = tree;
      this.add(tree);
      this.objects.push(tree);
    }

    this.makeObjectInteractive(tree, {
      name: 'temple_heart',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (this.templeHeartLocked) {
          const hint = this.difficulty === 'beginner' ? 'Activate water and earth.' : 
                      this.difficulty === 'expert' ? 'Align all five elements in order.' : 
                      'Order: Water, Earth, Fire, Air.';
          eventBus.emit('showMessage', `The heart sleeps. ${hint}`);
        } else {
          eventBus.emit('showMessage', 'The heart awakens! Solve the final riddle.');
          this.showFinalPuzzleInput();
        }
      }
    });

    const vineGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 16);
    this.ensureUVs(vineGeometry, 'vine');
    const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.6 });
    this.vineBridge = new THREE.Mesh(vineGeometry, vineMaterial);
    this.vineBridge.position.set(-5, 2, 0);
    this.vineBridge.rotation.z = Math.PI / 2;
    this.vineBridge.scale.set(1, 1, this.vineGrowth);
    this.vineBridge.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.vineBridge);
    this.objects.push(this.vineBridge);
  }

  getInteractiveObjects() {
    console.log('Interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    return this.interactiveObjects;
  }

  async loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }

  makeObjectInteractive(obj, data) {
    obj.userData = { ...data };
    this.interactiveObjects.push(obj);
  }

  addElementalNodes() {
    const elements = this.difficulty === 'beginner' ? [
      { name: 'water', color: 0x00B7EB, pos: [-10, 2, -5] },
      { name: 'earth', color: 0x8B4513, pos: [10, 2, -5] }
    ] : this.difficulty === 'expert' ? [
      { name: 'water', color: 0x00B7EB, pos: [-10, 2, -5] },
      { name: 'earth', color: 0x8B4513, pos: [10, 2, -5] },
      { name: 'fire', color: 0xFF4500, pos: [-5, 2, 5] },
      { name: 'air', color: 0xE0FFFF, pos: [5, 2, 5] },
      { name: 'light', color: 0xFFFF99, pos: [0, 3, 0] }
    ] : [
      { name: 'water', color: 0x00B7EB, pos: [-10, 2, -5] },
      { name: 'earth', color: 0x8B4513, pos: [10, 2, -5] },
      { name: 'fire', color: 0xFF4500, pos: [-5, 2, 5] },
      { name: 'air', color: 0xE0FFFF, pos: [5, 2, 5] }
    ];

    elements.forEach(element => {
      const nodeGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      this.ensureUVs(nodeGeometry, `${element.name} node`);
      const nodeMaterial = new THREE.MeshStandardMaterial({
        color: element.color,
        emissive: element.color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
      });
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.set(...element.pos);
      node.userData.element = element.name;
      node.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(node);
      this.elementalNodes.push(node);
      this.makeObjectInteractive(node, {
        name: `${element.name}_nodeA`,
        type: 'puzzle_piece',
        interactable: true,
        action: () => {
          if (this.difficulty === 'expert' && !this.checkDependencies(element.name)) {
            eventBus.emit('showMessage', `${element.name.charAt(0).toUpperCase() + element.name.slice(1)} needs prior elements!`);
            return;
          }
          this.activateElement(element.name, node);
          if (this.difficulty !== 'beginner') this.playerElementOrder.push(element.name);
          const totalElements = Object.keys(this.elementalSources).length;
          eventBus.emit('showMessage', `${element.name.charAt(0).toUpperCase() + element.name.slice(1)} activated! Progress: ${this.playerElementOrder.length}/${totalElements}`);
          
          if (this.difficulty === 'beginner' && this.elementalSources.water && this.elementalSources.earth) {
            this.templeHeartLocked = false;
            this.triggerHeartPulse();
            eventBus.emit('showMessage', 'The temple heart awakens!');
          } else if (this.playerElementOrder.length === totalElements) {
            if (this.checkElementOrder()) {
              this.templeHeartLocked = false;
              this.triggerHeartPulse();
              eventBus.emit('showMessage', 'The elements align! The temple heart awakens!');
            } else {
              eventBus.emit('showMessage', 'Wrong order! The jungle resets.');
              this.resetPuzzle();
            }
          }
        }
      });
    });
  }

  addInteractiveObjects() {
    const waterGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 32);
    this.ensureUVs(waterGeometry, 'water source');
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x00B7EB, transparent: true, opacity: 0.7 });
    this.waterSource = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterSource.position.set(-10, 0.5, 0);
    this.add(this.waterSource);
    this.makeObjectInteractive(this.waterSource, {
      name: 'water_source',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.elementalSources.water) {
          this.elementalSources.water = true;
          this.startWaterFlow();
          eventBus.emit('showMessage', 'Water begins to flow through the temple!');
        }
      }
    });
  }

  async addFireflies() {
    const fireflyCount = 50;

    try {
      const gltf = await this.loadModel('/assets/models/fireflies.glb');
      console.log("Loading fireflies glb:", gltf);
      const fireflyModel = gltf.scene;
      const fireflyMesh = fireflyModel.children[0];

      fireflyMesh.scale.set(2, 2, 2);

      fireflyMesh.material = new THREE.MeshBasicMaterial({
        color: 0xFFFF99,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });

      this.fireflies = new THREE.Group();

      for (let i = 0; i < fireflyCount; i++) {
        const fireflyClone = fireflyModel.clone();
        fireflyClone.position.set(
          THREE.MathUtils.randFloat(-this.roomSize.width / 2, this.roomSize.width / 2),
          THREE.MathUtils.randFloat(1, 10),
          THREE.MathUtils.randFloat(-this.roomSize.depth / 2, this.roomSize.depth / 2)
        );
        console.log(`Firefly ${i} positioned at:`, fireflyClone.position);
        this.fireflies.add(fireflyClone);
      }

      this.add(this.fireflies);
      console.log("Fireflies added to scene:", this.fireflies);

    } catch (error) {
      console.error('Error loading fireflies GLB:', error);
      const positions = new Float32Array(fireflyCount * 3);
      for (let i = 0; i < fireflyCount; i++) {
        positions[i * 3] = THREE.MathUtils.randFloat(-this.roomSize.width / 2, this.roomSize.width / 2);
        positions[i * 3 + 1] = THREE.MathUtils.randFloat(1, 10);
        positions[i * 3 + 2] = THREE.MathUtils.randFloat(-this.roomSize.depth / 2, this.roomSize.depth / 2);
      }
      const fireflyGeometry = new THREE.BufferGeometry();
      fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const fireflyMaterial = new THREE.PointsMaterial({
        color: 0xFFFF99,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      this.fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
      this.add(this.fireflies);
      console.log("Fallback fireflies (points) added to scene:", this.fireflies);
    }
  }

  async addDeer() {
    try {
      const gltf = await this.loadModel('/assets/models/deer.glb');
      console.log("loading deer glb", gltf);
      const deerModel = gltf.scene;

      deerModel.scale.set(2, 2, 2);
      deerModel.position.set(1, 0, 1);
      deerModel.rotation.y = -Math.PI / 4;

      this.add(deerModel);
      this.objects.push(deerModel);

    } catch (error) {
      console.error('Error loading deer GLB:', error);
      const deerGeometry = new THREE.BoxGeometry(1, 2, 1);
      this.ensureUVs(deerGeometry, 'deer fallback');
      const deerMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const deerFallback = new THREE.Mesh(deerGeometry, deerMaterial);
      deerFallback.position.set(5, 1, 5);
      this.add(deerFallback);
      this.objects.push(deerFallback);
    }
  }

  async addBushes() {
    const bushCount = 10;
    const treePosition = new THREE.Vector3(0, 0, -5); // Tree position from addNaturalFurniture
    const radius = 3; // Distance from tree center

    try {
      const gltf = await this.loadModel('/assets/models/bush.glb');
      console.log("Loading bush glb:", gltf);
      const bushModel = gltf.scene;

      bushModel.scale.set(2, 2, 2); // Match deer size

      // Calculate bounding box for height (post-scaling)
      const box = new THREE.Box3().setFromObject(bushModel);
      const bushHeight = box.max.y - box.min.y;
      const yOffset = -bushHeight / 2; // Sink half into ground

      for (let i = 0; i < bushCount; i++) {
        const angle = (i / bushCount) * Math.PI * 2; // Circular distribution
        const offsetX = Math.cos(angle) * radius * THREE.MathUtils.randFloat(0.8, 1.2);
        const offsetZ = Math.sin(angle) * radius * THREE.MathUtils.randFloat(0.8, 1.2);
        
        const bushClone = bushModel.clone();
        bushClone.position.set(
          treePosition.x + offsetX,
          yOffset,
          treePosition.z + offsetZ
        );
        bushClone.userData.initialScale = new THREE.Vector3(3, 3, 3);
        console.log(`Bush ${i} positioned at:`, bushClone.position, `Height: ${bushHeight}`);
        this.add(bushClone);
        this.objects.push(bushClone);
      }

      console.log("Bushes added to scene next to tree:", bushCount);

    } catch (error) {
      console.error('Error loading bush GLB:', error);
      // Fallback to green cylinders
      const bushHeight = 2; // Fallback height (unscaled)
      const yOffset = -bushHeight / 2; // Sink half into ground (scaled height handled below)
      for (let i = 0; i < bushCount; i++) {
        const angle = (i / bushCount) * Math.PI * 2;
        const offsetX = Math.cos(angle) * radius * THREE.MathUtils.randFloat(0.8, 1.2);
        const offsetZ = Math.sin(angle) * radius * THREE.MathUtils.randFloat(0.8, 1.2);

        const bushGeometry = new THREE.CylinderGeometry(1, 1, bushHeight, 16);
        this.ensureUVs(bushGeometry, 'bush fallback');
        const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 });
        const bushFallback = new THREE.Mesh(bushGeometry, bushMaterial);
        bushFallback.scale.set(2, 2, 2); // Match deer size
        bushFallback.position.set(
          treePosition.x + offsetX,
          yOffset * 2, // Adjust for scale (height * 2, so offset * 2)
          treePosition.z + offsetZ
        );
        bushFallback.userData.initialScale = new THREE.Vector3(3, 3, 3);
        console.log(`Fallback bush ${i} positioned at:`, bushFallback.position);
        this.add(bushFallback);
        this.objects.push(bushFallback);
      }
      console.log("Fallback bushes added to scene next to tree:", bushCount);
    }
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x406040, 0.4);
    this.add(this.ambientLight);
    this.sunLight = new THREE.DirectionalLight(0xFFD700, 0.3);
    this.sunLight.position.set(0, 15, 0);
    this.add(this.sunLight);
  }

  addJungleMist() {
    const fog = new THREE.Fog(0x2F4F4F, 5, 25);
    this.scene.fog = fog;
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/jungle-ambience.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(20);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 10, 0);
    this.add(sound);
  }

  activateElement(element, node) {
    this.elementalSources[element] = true;
    this.animateNode(node);
    if (element === 'earth' && this.elementalSources.water) {
      this.growVines();
    }
    if (this.difficulty === 'expert' && element === 'light') {
      this.triggerLightBurst();
    }
  }

  checkDependencies(element) {
    if (element === 'earth' && !this.elementalSources.water) return false;
    if (element === 'fire' && !this.elementalSources.earth) return false;
    if (element === 'air' && !this.elementalSources.fire) return false;
    if (element === 'light' && !this.elementalSources.air) return false;
    return true;
  }

  checkElementOrder() {
    if (this.difficulty === 'beginner') return true;
    return this.playerElementOrder.every((el, i) => el === this.correctElementOrder[i]);
  }

  resetPuzzle() {
    this.elementalSources = this.setElementalSources();
    this.playerElementOrder = [];
    this.vineGrowth = 0;
    this.vineBridge.scale.set(1, 1, this.vineGrowth);
    if (this.waterFlow) {
      this.remove(this.waterFlow);
      this.waterFlow = null;
    }
  }

  startWaterFlow() {
    const flowGeometry = new THREE.PlaneGeometry(5, 0.5);
    this.ensureUVs(flowGeometry, 'water flow');
    const flowMaterial = new THREE.MeshBasicMaterial({ color: 0x00B7EB, transparent: true, opacity: 0.6 });
    this.waterFlow = new THREE.Mesh(flowGeometry, flowMaterial);
    this.waterFlow.position.set(-7.5, 0.1, 0);
    this.waterFlow.rotation.x = -Math.PI / 2;
    this.add(this.waterFlow);
  }

  growVines() {
    this.vineGrowth = Math.min(this.vineGrowth + 0.5, 1);
    this.vineBridge.scale.set(1, 1, this.vineGrowth * 5);
    eventBus.emit('showMessage', 'The vines grow stronger!');
  }

  triggerHeartPulse() {
    let t = 0;
    const initialScale = this.templeHeart.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 1 + Math.sin(t * 5) * 0.1;
      this.templeHeart.scale.set(initialScale.x * scale, initialScale.y * scale, initialScale.z * scale);
      if (t < 1) requestAnimationFrame(animate);
      else this.templeHeart.scale.copy(initialScale);
    };
    animate();
  }

  triggerLightBurst() {
    const burstGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.ensureUVs(burstGeometry, 'light burst');
    const burstMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF99, transparent: true, opacity: 0.5 });
    const burst = new THREE.Mesh(burstGeometry, burstMaterial);
    burst.position.set(0, 3, 0);
    this.add(burst);
    let t = 0;
    const animate = () => {
      t += 0.05;
      burst.scale.setScalar(1 + t);
      burst.material.opacity = 0.5 - t * 0.5;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(burst);
    };
    animate();
  }

  animateNode(node) {
    let t = 0;
    const initialScale = node.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 1 + Math.sin(t * 5) * 0.2;
      node.scale.set(scale, scale, scale);
      if (t < 1) requestAnimationFrame(animate);
      else node.scale.copy(initialScale);
    };
    animate();
  }

  showFinalPuzzleInput() {
    const existingContainer = document.getElementById('final-puzzle-input');
    if (existingContainer) document.body.removeChild(existingContainer);

    const inputContainer = document.createElement('div');
    inputContainer.id = 'final-puzzle-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(0, 51, 0, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';

    const riddle = this.difficulty === 'beginner' ? 
      { text: 'Riddle: "What has 4 legs and 1 arm?" (3 letters)', maxLength: 3, answer: 'pit' } :
      this.difficulty === 'expert' ? 
      { text: 'Riddle: "I am a mystery, a puzzle within, spoken in silence, where secrets begin. What am I?" (6 letters)', maxLength: 6, answer: 'enigma' } :
      { text: 'Riddle: "I am taken from a mine, and shut up in a wooden case, from which I am never released, and yet I am used by almost every person. What am I?" (6 letters)', maxLength: 6, answer: 'pencil' };

    const label = document.createElement('div');
    label.textContent = riddle.text;
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = riddle.maxLength;
    input.style.padding = '5px';
    inputContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#8B4513';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);

    document.body.appendChild(inputContainer);

    setTimeout(() => input.focus(), 0);

    submitButton.addEventListener('click', () => {
      this.handleFinalPuzzleInput(input.value, riddle.answer);
      document.body.removeChild(inputContainer);
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleFinalPuzzleInput(input.value, riddle.answer);
        document.body.removeChild(inputContainer);
      }
    });
  }

  handleFinalPuzzleInput(input, correctAnswer) {
    if (input.toLowerCase() === correctAnswer) {
      eventBus.emit('showMessage', `The relic is yours! The Verdant Labyrinth (${this.difficulty}) bows to your mastery!`);
      eventBus.emit('game:win');
    } else {
      eventBus.emit('showMessage', 'Incorrect! The vines tighten slightly.');
    }
  }

  // Added to prevent undefined error in SceneManager.render
  update(delta) {
    // Basic update for fireflies or other animations if needed
    if (this.fireflies && this.fireflies instanceof THREE.Points) {
      const positions = this.fireflies.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.01; // Simple bobbing
        if (positions[i + 1] > 10) positions[i + 1] = 1; // Reset if too high
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;
    }
  }
}

export { VerdantLabyrinth };