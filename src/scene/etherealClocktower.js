import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class DesertEscape extends THREE.Object3D {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.desertSize = { width: 50, height: 10, depth: 50 };
    this.waterFound = false;
    this.denUnlocked = false;
    this.puzzlePiecesCollected = 0;
    this.camelFound = false;
    this.cactusTouched = false;
    this.sandParticles = null;

    this.riddles = {
      water: [
        { text: "You can see me in the air, but I am not a bird. I fall down on your head, but I am not a rock. What am I?", answer: "rain" },
        // { text: "we are going to win this hackathon", answer: "yes" },
        // { text: "I rise and fall, but I’m not alive. I can be calm or wild, and without me, sailors wouldn’t survive. What am I?", answer: "ocean" }
      ],
      den: [
        { text: "I guard the way with silence, opened by words. What am I?", answer: "riddle" },
        // { text: "best tesm in this hackathon", answer: "mind mavricks" }
      ],
      camel: [
        { text: "I carry burdens through the sands, a ship of the desert. What am I?", answer: "camel" },
        // { text: "which place will mind mavricks will secure", answer: "1st" }
      ],
      final: [
        { text: "I rise and fall, but I’m not alive. I can be calm or wild, and without me, sailors wouldn’t survive. What am I?", answer: "ocean" }
      ]
    };
  }

  async init(interactionSystem) {
    this.interactionSystem = interactionSystem;
    await Promise.all([
      this.createDesert(),
      this.addDesertFeatures()
    ]);
    this.addLighting();
    this.addSandParticles();
    this.addBackgroundAudio();
    this.addFog();

    if (this.interactionSystem && this.camera) {
      this.interactionSystem.setInteractiveObjects(this.getInteractiveObjects());
    }

    console.log('DesertEscape initialized with interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    eventBus.emit('showMessage', 'Welcome to the Desert Escape! Find water, unlock the den, secure a camel, and escape!');
    return this;
  }

  async createDesert() {
    const sandTexture = await this.loadTexture('/assets/textures/sand.jpg');
    sandTexture.wrapS = THREE.RepeatWrapping;
    sandTexture.wrapT = THREE.RepeatWrapping;
    sandTexture.repeat.set(1, 1);
    const sandGeometry = new THREE.PlaneGeometry(this.desertSize.width, this.desertSize.depth);
    this.ensureUVs(sandGeometry, 'sand');
    const sandMaterial = new THREE.MeshStandardMaterial({
      map: sandTexture,
      roughness: 0.9,
      metalness: 0.1,
      emissive: 0xD4A017,
      emissiveIntensity: 0.2
    });
    const sand = new THREE.Mesh(sandGeometry, sandMaterial);
    sand.rotation.x = -Math.PI / 2;
    this.add(sand);

    const skyTexture = await this.loadTexture('/assets/textures/desert-sky.jpg');
    const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
    this.ensureUVs(skyGeometry, 'sky');
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.add(sky);
  }

  async addDesertFeatures() {
    // Oasis
    const oasis = await this.loadModel('/assets/models/old_well.glb').catch(() => {
      const oasisGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 32);
      this.ensureUVs(oasisGeometry, 'oasis');
      return new THREE.Mesh(oasisGeometry, new THREE.MeshStandardMaterial({ color: 0x00CED1, emissive: 0x00CED1, emissiveIntensity: 0.5 }));
    });
    oasis.scale.set(2, 2, 2);
    oasis.position.set(-15, 0, 10);
    oasis.userData.initialScale = new THREE.Vector3(2, 2, 2);
    oasis.name = 'oasis';
    this.add(oasis);
    this.objects.push(oasis);
    this.makeObjectInteractive(oasis, {
      name: 'oasis',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.waterFound) {
          this.showRiddleInput('water', () => {
            this.waterFound = true;
            this.triggerOasisEffect(oasis);
            eventBus.emit('showMessage', 'Water found! The oasis shimmers with life.');
            this.ambientLight.intensity = 0.7; // Brighten scene
          });
        } else {
          eventBus.emit('showMessage', 'You’ve already secured water from the oasis.');
        }
      }
    });

    // Den
    const den = await this.loadModel('/assets/models/scout_tent.glb').catch(() => {
      const denGeometry = new THREE.BoxGeometry(4, 4, 4);
      this.ensureUVs(denGeometry, 'den');
      return new THREE.Mesh(denGeometry, new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }));
    });
    den.scale.set(3, 3, 3);
    den.position.set(10, 0, -15);
    den.rotation.y = Math.PI;
    den.userData.initialScale = new THREE.Vector3(3, 3, 3);
    den.name = 'den';
    this.add(den);
    this.objects.push(den);
    this.makeObjectInteractive(den, {
      name: 'den',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.waterFound) {
          eventBus.emit('showMessage', 'The den remains sealed. Find water first.');
        } else if (!this.denUnlocked) {
          this.showRiddleInput('den', () => {
            this.denUnlocked = true;
            this.triggerDenEffect(den);
            eventBus.emit('showMessage', 'The den opens! Secrets of the desert unfold.');
          });
        } else {
          eventBus.emit('showMessage', 'The den is already unlocked.');
        }
      }
    });

    // Camel and Puzzle Pieces
    this.camel = await this.loadModel('/assets/models/camel.glb').catch(() => {
      const camelGeometry = new THREE.BoxGeometry(2, 2, 4);
      this.ensureUVs(camelGeometry, 'camel');
      return new THREE.Mesh(camelGeometry, new THREE.MeshStandardMaterial({ color: 0xD2B48C }));
    });
    this.camel.scale.set(220, 220, 220);
    this.camel.position.set(20, 0, 20);
    this.camel.visible = false;
    this.camel.userData.initialScale = new THREE.Vector3(220, 220, 220);
    this.camel.name = 'camel';
    this.add(this.camel);
    this.objects.push(this.camel);

    const puzzlePieceGeometry = new THREE.BoxGeometry(1, 0.2, 1);
    this.ensureUVs(puzzlePieceGeometry, 'puzzle_piece');
    const puzzlePieceMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.5 });
    const puzzlePiecesPositions = [
      new THREE.Vector3(5, 0.1, 5),
      new THREE.Vector3(-5, 0.1, -5),
      new THREE.Vector3(0, 0.1, 10)
    ];
    this.puzzlePieces = [];
    puzzlePiecesPositions.forEach((pos, i) => {
      const piece = new THREE.Mesh(puzzlePieceGeometry, puzzlePieceMaterial.clone());
      piece.position.copy(pos);
      piece.userData.initialScale = new THREE.Vector3(1, 1, 1);
      piece.name = `puzzle_piece_${i}`;
      this.add(piece);
      this.puzzlePieces.push(piece);
      this.makeObjectInteractive(piece, {
        name: `puzzle_piece_${i}`,
        type: 'puzzle_piece',
        interactable: true,
        action: () => {
          if (!this.denUnlocked) {
            eventBus.emit('showMessage', 'The pieces are scattered. Unlock the den first.');
          } else if (!piece.userData.collected) {
            piece.userData.collected = true;
            this.animatePuzzlePiece(piece);
            this.puzzlePiecesCollected++;
            eventBus.emit('showMessage', `Puzzle piece ${this.puzzlePiecesCollected}/3 collected.`);
            if (this.puzzlePiecesCollected === 3) {
              this.showRiddleInput('camel', () => {
                this.camelFound = true;
                this.camel.visible = true;
                this.triggerCamelEffect();
                eventBus.emit('showMessage', 'The camel appears! One final step to escape.');
                this.showFinalRiddleInput();
              });
            }
          }
        }
      });
    });

    // Cactus (Trap)
    const cactus = await this.loadModel('/assets/models/cacti.glb').catch(() => {
      const cactusGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
      this.ensureUVs(cactusGeometry, 'cactus');
      return new THREE.Mesh(cactusGeometry, new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9 }));
    });
    cactus.scale.set(2, 2, 2);
    cactus.position.set(-10, 0, -10);
    cactus.userData.initialScale = new THREE.Vector3(2, 2, 2);
    cactus.name = 'cactus';
    this.add(cactus);
    this.objects.push(cactus);
    this.makeObjectInteractive(cactus, {
      name: 'cactus',
      type: 'trap',
      interactable: true,
      action: () => {
        if (!this.cactusTouched) {
          this.cactusTouched = true;
          this.triggerCactusEffect(cactus);
          eventBus.emit('showMessage', 'Ouch! The cactus stings. Watch your step!');
        } else {
          eventBus.emit('showMessage', 'The cactus stands prickly and silent.');
        }
      }
    });
  }

  showRiddleInput(type, callback) {
    const existingInput = document.getElementById('riddle-input');
    if (existingInput) return;

    const riddleList = this.riddles[type];
    const riddle = riddleList[Math.floor(Math.random() * riddleList.length)];

    const inputContainer = document.createElement('div');
    inputContainer.id = 'riddle-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(139, 69, 19, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';
    inputContainer.style.fontFamily = 'Georgia, serif';

    const label = document.createElement('div');
    label.textContent = riddle.text;
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    input.placeholder = 'Enter answer';
    inputContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#D4A017';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '5px';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);

    document.body.appendChild(inputContainer);
    setTimeout(() => input.focus(), 0);

    const showTryAgainModal = () => {
      const modal = document.createElement('div');
      modal.id = 'try-again-modal';
      modal.style.position = 'absolute';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.background = 'rgba(255, 0, 0, 0.8)';
      modal.style.padding = '20px';
      modal.style.borderRadius = '10px';
      modal.style.zIndex = '3000';
      modal.style.color = '#FFFFFF';
      modal.style.fontFamily = 'Georgia, serif';
      modal.style.textAlign = 'center';

      const message = document.createElement('div');
      message.textContent = 'Incorrect! Try Again.';
      message.style.marginBottom = '10px';
      modal.appendChild(message);

      const tryAgainButton = document.createElement('button');
      tryAgainButton.textContent = 'Try Again';
      tryAgainButton.style.padding = '5px 10px';
      tryAgainButton.style.background = '#D4A017';
      tryAgainButton.style.color = 'white';
      tryAgainButton.style.border = 'none';
      tryAgainButton.style.borderRadius = '5px';
      tryAgainButton.style.cursor = 'pointer';
      modal.appendChild(tryAgainButton);

      document.body.appendChild(modal);

      tryAgainButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        setTimeout(() => input.focus(), 0); // Refocus input after modal closes
      });
    };

    const submitHandler = () => {
      if (input.value.toLowerCase().trim() === riddle.answer) {
        eventBus.emit('showMessage', 'Riddle solved! The desert yields its secrets.');
        callback();
        document.body.removeChild(inputContainer);
        eventBus.emit('resumeGame');
      } else {
        eventBus.emit('showMessage', 'Incorrect. The sands shift uneasily.');
        showTryAgainModal();
      }
    };

    submitButton.addEventListener('click', submitHandler);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitHandler();
    });

    eventBus.emit('pauseGame');
  }

  showFinalRiddleInput() {
    const existingInput = document.getElementById('final-riddle-input');
    if (existingInput) return;

    const riddle = this.riddles.final[0];
    const inputContainer = document.createElement('div');
    inputContainer.id = 'final-riddle-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(139, 69, 19, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';
    inputContainer.style.fontFamily = 'Georgia, serif';

    const label = document.createElement('div');
    label.textContent = riddle.text;
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    input.placeholder = 'Enter answer';
    inputContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#D4A017';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '5px';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);

    document.body.appendChild(inputContainer);
    setTimeout(() => input.focus(), 0);

    const showTryAgainModal = () => {
      const modal = document.createElement('div');
      modal.id = 'try-again-modal';
      modal.style.position = 'absolute';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.background = 'rgba(255, 0, 0, 0.8)';
      modal.style.padding = '20px';
      modal.style.borderRadius = '10px';
      modal.style.zIndex = '3000';
      modal.style.color = '#FFFFFF';
      modal.style.fontFamily = 'Georgia, serif';
      modal.style.textAlign = 'center';

      const message = document.createElement('div');
      message.textContent = 'Wrong Answer! Try Again.';
      message.style.marginBottom = '10px';
      modal.appendChild(message);

      const tryAgainButton = document.createElement('button');
      tryAgainButton.textContent = 'Try Again';
      tryAgainButton.style.padding = '5px 10px';
      tryAgainButton.style.background = '#D4A017';
      tryAgainButton.style.color = 'white';
      tryAgainButton.style.border = 'none';
      tryAgainButton.style.borderRadius = '5px';
      tryAgainButton.style.cursor = 'pointer';
      modal.appendChild(tryAgainButton);

      document.body.appendChild(modal);

      tryAgainButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        setTimeout(() => input.focus(), 0); // Refocus input after modal closes
      });
    };

    const submitHandler = () => {
      if (input.value.toLowerCase().trim() === riddle.answer) {
        eventBus.emit('showMessage', 'Victory! You’ve escaped the desert!');
        eventBus.emit('game:win');
        document.body.removeChild(inputContainer);
        eventBus.emit('resumeGame');
      } else {
        eventBus.emit('showMessage', 'Wrong answer!');
        showTryAgainModal();
      }
    };

    submitButton.addEventListener('click', submitHandler);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitHandler();
    });

    eventBus.emit('pauseGame');
  }

  animatePuzzlePiece(piece) {
    let t = 0;
    const initialY = piece.position.y;
    const animate = () => {
      t += 0.05;
      piece.position.y = initialY + Math.sin(t * 5) * 0.2;
      piece.material.emissiveIntensity = Math.sin(t * 5) * 0.5 + 0.5;
      if (t < 1) requestAnimationFrame(animate);
      else {
        piece.position.y = initialY;
        piece.material.emissiveIntensity = 0.5;
        piece.visible = false;
      }
    };
    animate();
  }

  triggerOasisEffect(oasis) {
    const rippleGeometry = new THREE.CircleGeometry(3, 32);
    this.ensureUVs(rippleGeometry, 'ripple');
    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00CED1,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.copy(oasis.position);
    this.add(ripple);
    let t = 0;
    const animate = () => {
      t += 0.05;
      ripple.scale.setScalar(1 + t * 2);
      ripple.material.opacity = 0.5 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(ripple);
    };
    animate();
  }

  triggerDenEffect(den) {
    let t = 0;
    const initialY = den.position.y;
    const animate = () => {
      t += 0.05;
      den.position.y = initialY + Math.sin(t * 3) * 0.3;
      if (t < 1) requestAnimationFrame(animate);
      else den.position.y = initialY;
    };
    animate();
  }

  triggerCamelEffect() {
    const dustGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.ensureUVs(dustGeometry, 'dust');
    const dustMaterial = new THREE.MeshBasicMaterial({
      color: 0xD4A017,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Mesh(dustGeometry, dustMaterial);
    dust.position.copy(this.camel.position);
    this.add(dust);
    let t = 0;
    const animate = () => {
      t += 0.05;
      dust.scale.setScalar(1 + t * 3);
      dust.material.opacity = 0.7 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(dust);
    };
    animate();
  }

  triggerCactusEffect(cactus) {
    const spikeGeometry = new THREE.ConeGeometry(0.2, 1, 8);
    this.ensureUVs(spikeGeometry, 'spike');
    const spikeMaterial = new THREE.MeshBasicMaterial({
      color: 0x228B22,
      transparent: true,
      opacity: 0.8
    });
    const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    spike.position.copy(cactus.position);
    spike.position.y += 2;
    this.add(spike);
    let t = 0;
    const animate = () => {
      t += 0.05;
      spike.position.y += 0.1;
      spike.material.opacity = 0.8 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(spike);
    };
    animate();
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0xFFF8E1, 0.5);
    this.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xFFD700, 1);
    this.sunLight.position.set(20, 50, 20);
    this.sunLight.castShadow = true;
    this.add(this.sunLight);
  }

  addSandParticles() {
    const particleCount = 300;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.desertSize.width);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0, this.desertSize.height);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.desertSize.depth);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xD4A017,
      size: 0.1,
      transparent: true,
      opacity: 0.6
    });
    this.sandParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.sandParticles);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader(); // Fixed typo here
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/desert-wind.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(50);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 5, 0);
    this.add(sound);
  }

  addFog() {
    const fog = new THREE.FogExp2(0xD4A017, 0.01);
    this.scene.fog = fog;
  }

  update(delta) {
    this.preserveScales();
    if (this.sandParticles) {
      const positions = this.sandParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.005;
        if (positions[i] > this.desertSize.width / 2) positions[i] = -this.desertSize.width / 2;
      }
      this.sandParticles.geometry.attributes.position.needsUpdate = true;
    }
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
      onHover: () => {
        if (object.userData.outlineMesh) object.userData.outlineMesh.visible = true;
      },
      onUnhover: () => {
        if (object.userData.outlineMesh) object.userData.outlineMesh.visible = false;
      }
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

export { DesertEscape };