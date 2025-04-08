import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class ScholarsLibrary extends THREE.Object3D {
  constructor(scene, skillLevel = 'expert') {
    super();
    this.scene = scene;
    this.skillLevel = skillLevel.toLowerCase();
    console.log(`ScholarsLibrary initialized for ${this.skillLevel} level`);
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.roomSize = { width: 20, height: 10, depth: 30 };
    this.wallThickness = 0.5;
    this.bookOrder = []; // Only used in Hard
    this.correctBookOrder = [0xFF0000, 0x00FF00, 0x0000FF]; // Only for Hard
    this.cabinetLocked = true;
    this.cabinet = null;
    this.bookshelf = null;
    this.dustParticles = null;
    this.runeCircles = [];
    this.magicAura = null;
    this.orbActivated = false;
    this.runeSynced = false;
    this.candelabraLit = false;
    this.orbColorSequence = []; // Only for Beginner/Hard
    this.correctOrbSequence = [0xFF0000, 0x00FF00, 0x0000FF]; // Only for Beginner/Hard
    this.booksCorrect = false; // Only for Hard
    this.tomeActivated = false; // Only for Hard
    this.candelabraIntensity = 0; // For Intermediate
  }

  async init() {
    await this.createRoom();
    await this.addFurniture();
    if (this.skillLevel !== 'beginner') await this.addRuneCircles();
    await this.addInteractiveObjects();
    this.addLighting();
    this.addDustParticles();
    this.addBackgroundAudio();
    this.addMagicAura();
    this.addFog();
    console.log(`ScholarsLibrary initialized for ${this.skillLevel} level`, this.interactiveObjects);
    return this;
  }

  async createRoom() {
    const floorTexture = await this.loadTexture('/assets/textures/polished-wood-floor.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 6);
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(floorGeometry, 'floor');
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      map: floorTexture, 
      roughness: 0.4, 
      metalness: 0.1,
      color: 0x8B5A2B 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);
    // No collider for floor since player walks on it

    const wallTexture = await this.loadTexture('/assets/textures/wooden-panels-carved.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(3, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      map: wallTexture, 
      roughness: 0.5, 
      metalness: 0.1, 
      side: THREE.DoubleSide,
      emissive: 0x1A0F0A,
      emissiveIntensity: 0.2
    });

    const wallGeometries = [
      new THREE.BoxGeometry(this.roomSize.width, this.roomSize.height, this.wallThickness), // Back wall
      new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth), // Left wall
      new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth)  // Right wall
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
      wall.name = `wall_${index}`; // Name for debugging
      this.add(wall);
      this.addCollisionBox(wall, new THREE.Vector3(
        index === 0 ? this.roomSize.width : this.wallThickness,
        this.roomSize.height,
        index === 0 ? this.wallThickness : this.roomSize.depth
      ));
      wall.userData.emissiveBase = 0.2;
    });

    const ceilingTexture = await this.loadTexture('/assets/textures/runes-glow.jpg');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(2, 3);
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    this.ensureUVs(ceilingGeometry, 'ceiling');
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x3333FF,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    ceiling.name = 'ceiling';
    this.add(ceiling);
    this.addCollisionBox(ceiling, new THREE.Vector3(this.roomSize.width, 0.1, this.roomSize.depth)); // Thin collider for ceiling
    ceiling.userData.emissiveBase = 0.1;

    const windowTexture = await this.loadTexture('/assets/textures/stained-glass.jpg');
    const windowGeometry = new THREE.PlaneGeometry(6, 6);
    this.ensureUVs(windowGeometry, 'window');
    const windowMaterial = new THREE.MeshBasicMaterial({
      map: windowTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      emissive: 0xFFD700,
      emissiveIntensity: 0.3
    });
    this.stainedGlass = new THREE.Mesh(windowGeometry, windowMaterial);
    this.stainedGlass.position.set(0, 5, -14.9);
    this.stainedGlass.name = 'stained_glass';
    this.add(this.stainedGlass);
    this.addCollisionBox(this.stainedGlass, new THREE.Vector3(6, 6, 0.1)); // Thin collider for window
  }

  async addFurniture() {
    try {
      const desk = await this.loadModel('/assets/models/vintage-desk-1.glb');
      desk.scale.set(2.5, 2.5, 2.5);
      desk.position.set(0, 0, -4.5);
      desk.userData.initialScale = new THREE.Vector3(2.5, 2.5, 2.5);
      desk.name = 'desk';
      this.add(desk);
      this.objects.push(desk);
      this.addCollisionBox(desk, new THREE.Vector3(8, 5, 5)); // Adjust size based on model
    } catch (error) {
      console.error('Error loading desk model:', error);
      const deskGeometry = new THREE.BoxGeometry(8, 0.5, 5);
      this.ensureUVs(deskGeometry, 'desk fallback');
      const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.4 });
      const desk = new THREE.Mesh(deskGeometry, deskMaterial);
      desk.position.set(0, 2.5, -4.5);
      desk.userData.initialScale = new THREE.Vector3(1, 1, 1);
      desk.name = 'desk_fallback';
      this.add(desk);
      this.objects.push(desk);
      this.addCollisionBox(desk, new THREE.Vector3(8, 0.5, 5));
    }

    if (this.skillLevel !== 'beginner') { // Bookshelf for aesthetics in Intermediate/Hard
      try {
        const bookshelf = await this.loadModel('/assets/models/bookshelf-library.glb');
        bookshelf.scale.set(2, 2, 2);
        bookshelf.position.set(-8, 0, -9);
        bookshelf.rotation.y = 0;
        bookshelf.userData.initialScale = new THREE.Vector3(2, 2, 2);
        bookshelf.name = 'bookshelf';
        this.bookshelf = bookshelf;
        this.add(bookshelf);
        this.objects.push(bookshelf);
        this.addCollisionBox(bookshelf, new THREE.Vector3(5, 7, 0.7)); // Adjust size based on model
      } catch (error) {
        console.error('Error loading bookshelf model:', error);
        const bookshelfGeometry = new THREE.BoxGeometry(5, 7, 0.7);
        this.ensureUVs(bookshelfGeometry, 'bookshelf fallback');
        const bookshelfMaterial = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.4 });
        const bookshelf = new THREE.Mesh(bookshelfGeometry, bookshelfMaterial);
        bookshelf.position.set(-8, 3.5, -4);
        bookshelf.rotation.y = 0;
        bookshelf.userData.initialScale = new THREE.Vector3(1, 1, 1);
        bookshelf.name = 'bookshelf_fallback';
        this.bookshelf = bookshelf;
        this.add(bookshelf);
        this.objects.push(bookshelf);
        this.addCollisionBox(bookshelf, new THREE.Vector3(5, 7, 0.7));
      }
    }

    try {
      const cabinet = await this.loadModel('/assets/models/cabinet.glb');
      cabinet.scale.set(8, 8, 8);
      cabinet.position.set(7, 0, -9);
      cabinet.userData.initialScale = new THREE.Vector3(8, 8, 8);
      cabinet.name = 'cabinet';
      this.cabinet = cabinet;
      this.add(cabinet);
      this.objects.push(cabinet);
      this.addCollisionBox(cabinet, new THREE.Vector3(5, 6, 1)); // Adjust size based on model
      this.makeObjectInteractive(cabinet, {
        name: 'locked_cabinet',
        type: 'puzzle',
        interactable: true,
        action: () => {
          if (this.cabinetLocked) {
            eventBus.emit('showMessage', this.getCabinetLockedMessage());
          } else {
            eventBus.emit('showMessage', 'The cabinet opens! Solve the riddle to claim victory.');
            this.openCabinetDrawer();
            this.showFinalPuzzleInput();
          }
        }
      });
    } catch (error) {
      console.error('Error loading cabinet model:', error);
      const cabinetGeometry = new THREE.BoxGeometry(5, 6, 1);
      this.ensureUVs(cabinetGeometry, 'cabinet fallback');
      const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.4 });
      const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
      cabinet.position.set(7, 3, -4);
      cabinet.userData.initialScale = new THREE.Vector3(1, 1, 1);
      cabinet.name = 'cabinet_fallback';
      this.cabinet = cabinet;
      this.add(cabinet);
      this.objects.push(cabinet);
      this.addCollisionBox(cabinet, new THREE.Vector3(5, 6, 1));
      this.makeObjectInteractive(cabinet, {
        name: 'locked_cabinet',
        type: 'puzzle',
        interactable: true,
        action: () => {
          if (this.cabinetLocked) {
            eventBus.emit('showMessage', this.getCabinetLockedMessage());
          } else {
            eventBus.emit('showMessage', 'The cabinet opens! Solve the riddle to claim victory.');
            this.openCabinetDrawer();
            this.showFinalPuzzleInput();
          }
        }
      });
    }

    try {
      const bookModel = await this.loadModel('/assets/models/antique_book_small.glb');
      for (let i = 0; i < 3; i++) {
        const book = bookModel.clone();
        book.scale.set(0.2, 0.2, 0.2);
        book.position.set(
          THREE.MathUtils.randFloat(-3, 3),
          0.1,
          THREE.MathUtils.randFloat(3.5, 0.5)
        );
        book.rotation.set(
          0,
          THREE.MathUtils.randFloat(0, Math.PI * 2),
          THREE.MathUtils.randFloat(-0.2, 0.2)
        );
        book.userData.initialScale = new THREE.Vector3(0.5, 0.5, 0.5);
        book.name = `book_decoration_${i}`;
        this.add(book);
        this.objects.push(book);
        this.addCollisionBox(book, new THREE.Vector3(0.8, 0.2, 1.2)); // Small collider for books
      }
    } catch (error) {
      console.error('Error loading antique book model:', error);
      const bookGeometry = new THREE.BoxGeometry(0.8, 0.2, 1.2);
      this.ensureUVs(bookGeometry, 'book');
      const bookMaterial = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        const book = new THREE.Mesh(bookGeometry, bookMaterial.clone());
        book.position.set(
          THREE.MathUtils.randFloat(-3, 3),
          0.1,
          THREE.MathUtils.randFloat(-3.5, -0.5)
        );
        book.rotation.set(
          0,
          THREE.MathUtils.randFloat(0, Math.PI * 2),
          THREE.MathUtils.randFloat(-0.2, 0.2)
        );
        book.name = `book_decoration_${i}`;
        this.add(book);
        this.objects.push(book);
        this.addCollisionBox(book, new THREE.Vector3(0.8, 0.2, 1.2));
      }
    }

    this.chandelierGroup = new THREE.Group();
    const chandelierBaseGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    this.ensureUVs(chandelierBaseGeometry, 'chandelier base');
    const chandelierBaseMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      emissive: 0xFFD700,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2
    });
    const chandelierBase = new THREE.Mesh(chandelierBaseGeometry, chandelierBaseMaterial);
    this.chandelierGroup.add(chandelierBase);

    for (let i = 0; i < 6; i++) {
      const crystalGeometry = new THREE.ConeGeometry(0.1, 0.3, 16);
      this.ensureUVs(crystalGeometry, 'chandelier crystal');
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0x00FFFF,
        emissive: 0x00FFFF,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.8
      });
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      const angle = (i / 6) * Math.PI * 2;
      crystal.position.set(Math.cos(angle) * 0.8, -0.5, Math.sin(angle) * 0.8);
      this.chandelierGroup.add(crystal);
    }
    this.chandelierGroup.position.set(0, 9, 0);
    this.chandelierGroup.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.chandelierGroup.name = 'chandelier';
    this.add(this.chandelierGroup);
    this.objects.push(this.chandelierGroup);
    this.addCollisionBox(this.chandelierGroup, new THREE.Vector3(1.6, 1, 1.6)); // Collider for chandelier group

    const candelabraGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 32);
    this.ensureUVs(candelabraGeometry, 'candelabra');
    const candelabraMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      metalness: 0.9,
      roughness: 0.2
    });
    this.candelabra = new THREE.Mesh(candelabraGeometry, candelabraMaterial);
    this.candelabra.position.set(-3, 1, -4.5);
    this.candelabra.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.candelabra.name = 'candelabra';
    this.add(this.candelabra);
    this.objects.push(this.candelabra);
    this.addCollisionBox(this.candelabra, new THREE.Vector3(0.3, 2, 0.3));
    this.makeObjectInteractive(this.candelabra, {
      name: 'candelabra',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.candelabraLit && this.quill.userData.activated) {
          this.igniteCandelabra();
          eventBus.emit('showMessage', this.skillLevel === 'intermediate' ? 
            'The candelabra ignites! Click again to adjust its intensity.' : 
            'The candelabra ignites, illuminating the library!');
        } else if (!this.candelabraLit) {
          eventBus.emit('showMessage', 'The candelabra is cold. Use the quill to ignite it.');
        } else if (this.skillLevel === 'intermediate' && this.candelabraIntensity < 3) {
          this.candelabraIntensity++;
          this.chandelierLight.intensity = 3 + this.candelabraIntensity * 0.5;
          eventBus.emit('showMessage', `Candelabra intensity: ${this.candelabraIntensity}/3.`);
          if (this.candelabraIntensity === 3 && this.runeSynced) {
            this.orbActivated = true;
            this.triggerOrbPulse(this.orb);
            this.orb.material.color.setHex(0xFFFFFF);
            eventBus.emit('showMessage', 'The orb activates! Place it on the pedestal.');
          }
        } else {
          eventBus.emit('showMessage', 'The candelabra burns brightly.');
        }
      }
    });
  }

  async addInteractiveObjects() {
    const orbGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    this.ensureUVs(orbGeometry, 'orb');
    const orbMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x6666FF, 
      emissive: 0x0000FF, 
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9 
    });
    this.orb = new THREE.Mesh(orbGeometry, orbMaterial);
    this.orb.scale.set(0.5, 0.5, 0.5);
    this.orb.position.set(1.5, 2.25, -4.5);
    this.orb.userData.initialScale = new THREE.Vector3(0.5, 0.5, 0.5);
    this.orb.name = 'magical_orb';
    this.add(this.orb);
    // No collider for orb since it’s a puzzle piece that moves
    this.makeObjectInteractive(this.orb, {
      name: 'magical_orb',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.candelabraLit) {
          eventBus.emit('showMessage', 'The orb is dim. Light the candelabra first.');
        } else if (this.skillLevel === 'beginner' && !this.tomeActivated) {
          eventBus.emit('showMessage', 'The orb hums softly. Awaken the floating tome for a hint.');
        } else if (this.skillLevel === 'intermediate' && !this.runeSynced) {
          eventBus.emit('showMessage', 'The orb pulses faintly. Sync the rune circles.');
        } else if (this.skillLevel === 'intermediate' && this.candelabraIntensity < 3) {
          eventBus.emit('showMessage', 'The orb hums. Adjust the candelabra intensity to 3.');
        } else if (this.skillLevel === 'expert' && !this.tomeActivated) {
          eventBus.emit('showMessage', 'The orb hums softly. Awaken the floating tome.');
        } else if (!this.orbActivated && (this.skillLevel === 'beginner' || this.skillLevel === 'expert')) {
          this.showOrbInput();
        } else {
          eventBus.emit('showMessage', this.skillLevel === 'beginner' ? 
            'The orb is activated! Check the cabinet.' : 
            'The orb is activated. Place it on the pedestal.');
        }
      }
    });

    if (this.skillLevel === 'expert') { // Books only for Hard
      const bookColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
      const bookshelfPos = new THREE.Vector3(-8, 0, -9);
      const bookshelfScale = 2;
      const shelfWidth = 1.8 * bookshelfScale;
      const bookWidth = 0.2;
      const bookHeight = 0.4;
      const bookDepth = 0.15;
      const spaceBetweenBooks = 0.01;
      const startX = bookshelfPos.x - (shelfWidth / 2) + (bookWidth / 2);
      const bookPositions = [
        [startX + 1.5, 1.5, -9],
        [startX + bookWidth + spaceBetweenBooks + 1.5, 1.5, -9],
        [startX + (bookWidth + spaceBetweenBooks) * 2 + 1.5, 1.5, -9],
        [startX + 1.5, 2.1, -9],
        [startX + bookWidth + spaceBetweenBooks + 1.5, 2.1, -9]
      ];

      const bookGeometry = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
      this.ensureUVs(bookGeometry, 'interactive book');
      bookPositions.forEach((pos, index) => {
        const bookMaterial = new THREE.MeshStandardMaterial({ 
          color: bookColors[index % bookColors.length], 
          roughness: 0.5,
          metalness: 0.1,
          emissive: bookColors[index % bookColors.length],
          emissiveIntensity: 0.3 
        });
        const book = new THREE.Mesh(bookGeometry, bookMaterial);
        book.position.set(...pos);
        book.rotation.y = -Math.PI / 2;
        book.userData.color = bookColors[index % bookColors.length];
        book.userData.initialPosition = book.position.clone();
        book.userData.initialScale = new THREE.Vector3(1, 1, 1);
        book.name = `book_${index}`;
        this.add(book);
        this.addCollisionBox(book, new THREE.Vector3(bookWidth, bookHeight, bookDepth));
        this.makeObjectInteractive(book, {
          name: `book_${index}`,
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.orbActivated) {
              eventBus.emit('showMessage', 'The books remain still. Activate the orb first.');
              return;
            }
            console.log(`Book clicked: ${this.colorToName(book.userData.color)}`);
            this.bookOrder.push(book.userData.color);
            this.animateBook(book);
            eventBus.emit('showMessage', `Book selected. Sequence: ${this.bookOrder.length}/${this.correctBookOrder.length}`);
            if (this.bookOrder.length === 3) {
              if (this.checkBookOrder()) {
                this.booksCorrect = true;
                this.triggerBookEffect();
                eventBus.emit('showMessage', 'The books resonate with arcane power! Place the orb on the pedestal.');
              } else {
                eventBus.emit('showMessage', 'Wrong order! The books reset.');
                this.bookOrder = [];
              }
            }
          }
        });
      });
    }

    const quillGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16);
    this.ensureUVs(quillGeometry, 'quill');
    const quillMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    this.quill = new THREE.Mesh(quillGeometry, quillMaterial);
    this.quill.position.set(-0.5, 2.15, -4);
    this.quill.rotation.x = Math.PI / 3;
    this.quill.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.quill.userData.activated = false;
    this.quill.name = 'quill';
    this.add(this.quill);
    // No collider for quill since it’s small and interactable
    this.makeObjectInteractive(this.quill, {
      name: 'quill',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.quill.userData.activated) {
          this.animateQuill(this.quill);
          this.quill.userData.activated = true;
          eventBus.emit('showMessage', 'The quill glows with magic. Use it on the candelabra.');
        } else {
          eventBus.emit('showMessage', 'The quill is ready to ignite the candelabra.');
        }
      }
    });

    if (this.skillLevel !== 'beginner') { // Pedestal for Intermediate/Hard
      const pedestalGeometry = new THREE.CylinderGeometry(0.3, 0.5, 1, 32);
      this.ensureUVs(pedestalGeometry, 'pedestal');
      const pedestalMaterial = new THREE.MeshStandardMaterial({
        color: 0x00FFFF,
        emissive: 0x00FFFF,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
      });
      this.pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
      this.pedestal.position.set(0, 0.5, -4.5);
      this.pedestal.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.pedestal.name = 'orb_pedestal';
      this.add(this.pedestal);
      this.addCollisionBox(this.pedestal, new THREE.Vector3(0.5, 1, 0.5));
      this.makeObjectInteractive(this.pedestal, {
        name: 'orb_pedestal',
        type: 'puzzle',
        interactable: true,
        action: () => {
          if (!this.orbActivated) {
            eventBus.emit('showMessage', 'The pedestal hums. Activate the orb first.');
          } else if (this.skillLevel === 'expert' && !this.booksCorrect) {
            eventBus.emit('showMessage', 'The pedestal awaits the orb, but the books must resonate first.');
          } else if (this.orb.position.distanceTo(this.pedestal.position) > 1) {
            this.orb.position.set(0, 1, -4.5);
            this.triggerOrbBeam();
            this.cabinetLocked = false;
            eventBus.emit('showMessage', 'The orb is placed! The cabinet unlocks.');
          } else {
            eventBus.emit('showMessage', 'The orb is already on the pedestal. Check the cabinet.');
          }
        }
      });
    }

    if (this.skillLevel === 'beginner' || this.skillLevel === 'expert') { // Tome for Beginner and Hard
      try {
        const tome = await this.loadModel('/assets/models/paladins_book.glb');
        tome.scale.set(2.5, 2.5, 2.5);
        tome.position.set(-2, 4, -2.5);
        tome.userData.initialScale = new THREE.Vector3(2.5, 2.5, 2.5);
        tome.name = 'floating_tome';
        this.floatingTome = tome;
        this.add(tome);
        this.addCollisionBox(tome, new THREE.Vector3(1, 0.3, 1.5)); // Adjust size based on model
        this.makeObjectInteractive(tome, {
          name: 'floating_tome',
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.candelabraLit) {
              eventBus.emit('showMessage', 'The tome is silent. Light the candelabra first.');
            } else if (!this.tomeActivated) {
              this.animateTome(tome);
              this.tomeActivated = true;
              eventBus.emit('showMessage', 'Riddle: "First of flames, heart of earth, tears of sky—what order births power?" (Red=1, Green=2, Blue=3)');
            } else {
              eventBus.emit('showMessage', 'The tome hums with power. Use its riddle to activate the orb.');
            }
          }
        });
      } catch (error) {
        console.error('Error loading magic book model:', error);
        const tomeGeometry = new THREE.BoxGeometry(1, 0.3, 1.5);
        this.ensureUVs(tomeGeometry, 'tome');
        const tomeMaterial = new THREE.MeshStandardMaterial({
          color: 0x4B2E2A,
          emissive: 0xFF00FF,
          emissiveIntensity: 0.5,
          roughness: 0.6
        });
        this.floatingTome = new THREE.Mesh(tomeGeometry, tomeMaterial);
        this.floatingTome.position.set(-2, 4, -2.5);
        this.floatingTome.userData.initialScale = new THREE.Vector3(1, 1, 1);
        this.floatingTome.name = 'floating_tome_fallback';
        this.add(this.floatingTome);
        this.addCollisionBox(this.floatingTome, new THREE.Vector3(1, 0.3, 1.5));
        this.makeObjectInteractive(this.floatingTome, {
          name: 'floating_tome',
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.candelabraLit) {
              eventBus.emit('showMessage', 'The tome is silent. Light the candelabra first.');
            } else if (!this.tomeActivated) {
              this.animateTome(this.floatingTome);
              this.tomeActivated = true;
              eventBus.emit('showMessage', 'Riddle: "First of flames, heart of earth, tears of sky—what order births power?" (Red=1, Green=2, Blue=3)');
            } else {
              eventBus.emit('showMessage', 'The tome hums with power. Use its riddle to activate the orb.');
            }
          }
        });
      }
    }
  }

  // New method: Add collision box like in Room.js
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

  getCabinetLockedMessage() {
    switch (this.skillLevel) {
      case 'beginner':
        return 'The cabinet is sealed. Activate the orb.';
      case 'intermediate':
        return 'The cabinet is sealed. Place the orb on the pedestal.';
      case 'expert':
        return 'The cabinet is sealed. Place the orb on the pedestal after arranging the books.';
      default:
        return 'The cabinet is sealed with arcane runes. Solve the library’s puzzles.';
    }
  }

  handleFinalPuzzleInput(input) {
    const correctAnswer = 'cold';
    if (input.toLowerCase() === correctAnswer) {
      eventBus.emit('showMessage', `Victory! The riddle is solved, and the Scholar’s Library is mastered (${this.skillLevel} level)!`);
      eventBus.emit('game:win');
    } else {
      eventBus.emit('showMessage', 'Wrong answer! Try again.');
    }
  }

  showFinalPuzzleInput() {
    const existingInput = document.getElementById('final-puzzle-input');
    if (existingInput) return;
  
    const inputContainer = document.createElement('div');
    inputContainer.id = 'final-puzzle-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(0, 0, 51, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';
    inputContainer.style.fontFamily = 'Georgia, serif';
  
    const label = document.createElement('div');
    label.textContent = 'Riddle: "What can you catch but can\'t throw?" (4 letters)';
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);
  
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 4;
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    input.placeholder = 'e.g., cold';
    inputContainer.appendChild(input);
  
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#8B4513';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '5px';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);
  
    document.body.appendChild(inputContainer);
  
    setTimeout(() => input.focus(), 0);
  
    const submitHandler = () => {
      this.handleFinalPuzzleInput(input.value);
      document.body.removeChild(inputContainer);
      eventBus.emit('resumeGame');
    };
  
    submitButton.addEventListener('click', submitHandler.bind(this));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitHandler();
      }
    });
  
    eventBus.emit('pauseGame');
  }

  async addInteractiveObjects() {
    const orbGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    this.ensureUVs(orbGeometry, 'orb');
    const orbMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x6666FF, 
      emissive: 0x0000FF, 
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9 
    });
    this.orb = new THREE.Mesh(orbGeometry, orbMaterial);
    this.orb.scale.set(0.5, 0.5, 0.5);
    this.orb.position.set(1.5, 2.25, -4.5);
    this.orb.userData.initialScale = new THREE.Vector3(0.5, 0.5, 0.5);
    this.add(this.orb);
    this.makeObjectInteractive(this.orb, {
      name: 'magical_orb',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.candelabraLit) {
          eventBus.emit('showMessage', 'The orb is dim. Light the candelabra first.');
        } else if (this.skillLevel === 'beginner' && !this.tomeActivated) {
          eventBus.emit('showMessage', 'The orb hums softly. Awaken the floating tome for a hint.');
        } else if (this.skillLevel === 'intermediate' && !this.runeSynced) {
          eventBus.emit('showMessage', 'The orb pulses faintly. Sync the rune circles.');
        } else if (this.skillLevel === 'intermediate' && this.candelabraIntensity < 3) {
          eventBus.emit('showMessage', 'The orb hums. Adjust the candelabra intensity to 3.');
        } else if (this.skillLevel === 'expert' && !this.tomeActivated) {
          eventBus.emit('showMessage', 'The orb hums softly. Awaken the floating tome.');
        } else if (!this.orbActivated && (this.skillLevel === 'beginner' || this.skillLevel === 'expert')) {
          this.showOrbInput();
        } else {
          eventBus.emit('showMessage', this.skillLevel === 'beginner' ? 
            'The orb is activated! Check the cabinet.' : 
            'The orb is activated. Place it on the pedestal.');
        }
      }
    });

    if (this.skillLevel === 'expert') { // Books only for Hard
      const bookColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
      const bookshelfPos = new THREE.Vector3(-8, 0, -9);
      const bookshelfScale = 2;
      const shelfWidth = 1.8 * bookshelfScale;
      const bookWidth = 0.2;
      const bookHeight = 0.4;
      const bookDepth = 0.15;
      const spaceBetweenBooks = 0.01;
      const startX = bookshelfPos.x - (shelfWidth / 2) + (bookWidth / 2);
      const bookPositions = [
        [startX + 1.5, 1.5, -9],
        [startX + bookWidth + spaceBetweenBooks + 1.5, 1.5, -9],
        [startX + (bookWidth + spaceBetweenBooks) * 2 + 1.5, 1.5, -9],
        [startX + 1.5, 2.1, -9],
        [startX + bookWidth + spaceBetweenBooks + 1.5, 2.1, -9]
      ];

      const bookGeometry = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
      this.ensureUVs(bookGeometry, 'interactive book');
      bookPositions.forEach((pos, index) => {
        const bookMaterial = new THREE.MeshStandardMaterial({ 
          color: bookColors[index % bookColors.length], 
          roughness: 0.5,
          metalness: 0.1,
          emissive: bookColors[index % bookColors.length],
          emissiveIntensity: 0.3 
        });
        const book = new THREE.Mesh(bookGeometry, bookMaterial);
        book.position.set(...pos);
        book.rotation.y = -Math.PI / 2;
        book.userData.color = bookColors[index % bookColors.length];
        book.userData.initialPosition = book.position.clone();
        book.userData.initialScale = new THREE.Vector3(1, 1, 1);
        this.add(book);
        this.makeObjectInteractive(book, {
          name: `book_${index}`,
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.orbActivated) {
              eventBus.emit('showMessage', 'The books remain still. Activate the orb first.');
              return;
            }
            console.log(`Book clicked: ${this.colorToName(book.userData.color)}`);
            this.bookOrder.push(book.userData.color);
            this.animateBook(book);
            eventBus.emit('showMessage', `Book selected. Sequence: ${this.bookOrder.length}/${this.correctBookOrder.length}`);
            if (this.bookOrder.length === 3) {
              if (this.checkBookOrder()) {
                this.booksCorrect = true;
                this.triggerBookEffect();
                eventBus.emit('showMessage', 'The books resonate with arcane power! Place the orb on the pedestal.');
              } else {
                eventBus.emit('showMessage', 'Wrong order! The books reset.');
                this.bookOrder = [];
              }
            }
          }
        });
      });
    }

    const quillGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16);
    this.ensureUVs(quillGeometry, 'quill');
    const quillMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    this.quill = new THREE.Mesh(quillGeometry, quillMaterial);
    this.quill.position.set(-0.5, 2.15, -4);
    this.quill.rotation.x = Math.PI / 3;
    this.quill.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.quill.userData.activated = false;
    this.add(this.quill);
    this.makeObjectInteractive(this.quill, {
      name: 'quill',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.quill.userData.activated) {
          this.animateQuill(this.quill);
          this.quill.userData.activated = true;
          eventBus.emit('showMessage', 'The quill glows with magic. Use it on the candelabra.');
        } else {
          eventBus.emit('showMessage', 'The quill is ready to ignite the candelabra.');
        }
      }
    });

    if (this.skillLevel !== 'beginner') { // Pedestal for Intermediate/Hard
      const pedestalGeometry = new THREE.CylinderGeometry(0.3, 0.5, 1, 32);
      this.ensureUVs(pedestalGeometry, 'pedestal');
      const pedestalMaterial = new THREE.MeshStandardMaterial({
        color: 0x00FFFF,
        emissive: 0x00FFFF,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
      });
      this.pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
      this.pedestal.position.set(0, 0.5, -4.5);
      this.pedestal.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(this.pedestal);
      this.makeObjectInteractive(this.pedestal, {
  name: 'orb_pedestal',
  type: 'puzzle',
  interactable: true,
  action: () => {
    console.log('Pedestal clicked', { orbActivated: this.orbActivated, booksCorrect: this.booksCorrect, orbPosition: this.orb.position.toArray() });
    if (!this.orbActivated) {
      eventBus.emit('showMessage', 'The pedestal hums. Activate the orb first.');
    } else if (this.skillLevel === 'expert' && !this.booksCorrect) {
      eventBus.emit('showMessage', 'The pedestal awaits the orb, but the books must resonate first.');
    } else {
      this.orb.position.set(0, 1, -4.5);
      this.triggerOrbBeam();
      this.cabinetLocked = false;
      eventBus.emit('showMessage', 'The orb is placed! The cabinet unlocks.');
    }
  }
});
    }

    if (this.skillLevel === 'beginner' || this.skillLevel === 'expert') { // Tome for Beginner and Hard
      try {
        const tome = await this.loadModel('/assets/models/paladins_book.glb');
        tome.scale.set(2.5, 2.5, 2.5);
        tome.position.set(-2, 4, -2.5);
        tome.userData.initialScale = new THREE.Vector3(2.5, 2.5, 2.5);
        this.floatingTome = tome;
        this.add(tome);
        this.makeObjectInteractive(tome, {
          name: 'floating_tome',
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.candelabraLit) {
              eventBus.emit('showMessage', 'The tome is silent. Light the candelabra first.');
            } else if (!this.tomeActivated) {
              this.animateTome(tome);
              this.tomeActivated = true;
              eventBus.emit('showMessage', 'Riddle: "First of flames, heart of earth, tears of sky—what order births power?" (Red=1, Green=2, Blue=3)');
            } else {
              eventBus.emit('showMessage', 'The tome hums with power. Use its riddle to activate the orb.');
            }
          }
        });
      } catch (error) {
        console.error('Error loading magic book model:', error);
        const tomeGeometry = new THREE.BoxGeometry(1, 0.3, 1.5);
        this.ensureUVs(tomeGeometry, 'tome');
        const tomeMaterial = new THREE.MeshStandardMaterial({
          color: 0x4B2E2A,
          emissive: 0xFF00FF,
          emissiveIntensity: 0.5,
          roughness: 0.6
        });
        this.floatingTome = new THREE.Mesh(tomeGeometry, tomeMaterial);
        this.floatingTome.position.set(-2, 4, -2.5);
        this.floatingTome.userData.initialScale = new THREE.Vector3(1, 1, 1);
        this.add(this.floatingTome);
        this.makeObjectInteractive(this.floatingTome, {
          name: 'floating_tome',
          type: 'puzzle_piece',
          interactable: true,
          action: () => {
            if (!this.candelabraLit) {
              eventBus.emit('showMessage', 'The tome is silent. Light the candelabra first.');
            } else if (!this.tomeActivated) {
              this.animateTome(this.floatingTome);
              this.tomeActivated = true;
              eventBus.emit('showMessage', 'Riddle: "First of flames, heart of earth, tears of sky—what order births power?" (Red=1, Green=2, Blue=3)');
            } else {
              eventBus.emit('showMessage', 'The tome hums with power. Use its riddle to activate the orb.');
            }
          }
        });
      }
    }
  }

  async addRuneCircles() {
    const runeTexture = await this.loadTexture('/assets/textures/rune-circle.png');
    const runeMaterial = new THREE.MeshStandardMaterial({
      map: runeTexture,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x3333FF),
      emissiveIntensity: 0.5
    });

    for (let i = 0; i < 2; i++) {
      const runeGeometry = new THREE.CircleGeometry(1, 32);
      this.ensureUVs(runeGeometry, 'rune circle');
      const rune = new THREE.Mesh(runeGeometry, runeMaterial.clone());
      rune.position.set(i === 0 ? -4 : 4, 6, -4);
      rune.rotation.x = -Math.PI / 2;
      rune.userData.rotationSpeed = i === 0 ? 0.01 : 0.03;
      rune.userData.targetSpeed = 0.02;
      rune.userData.initialScale = new THREE.Vector3(1, 1, 1);
      rune.userData.isHovered = false;
      rune.userData.defaultEmissive = new THREE.Color(0x3333FF);
      rune.userData.hoverEmissive = new THREE.Color(0xFFD700);
      rune.userData.defaultOpacity = 0.6;
      rune.userData.hoverOpacity = 0.8;

      this.makeObjectInteractive(rune, {
        name: `rune_circle_${i}`,
        type: 'puzzle',
        interactable: true,
        onHover: () => {
          if (!rune.userData.isHovered) {
            rune.material.emissive.copy(rune.userData.hoverEmissive);
            rune.material.emissiveIntensity = 1;
            rune.material.opacity = rune.userData.hoverOpacity;
            rune.scale.multiplyScalar(1.1);
            rune.userData.isHovered = true;
            console.log(`Hovering rune ${i}`);
          }
        },
        onUnhover: () => {
          if (rune.userData.isHovered) {
            rune.material.emissive.copy(rune.userData.defaultEmissive);
            rune.material.emissiveIntensity = 0.5;
            rune.material.opacity = rune.userData.defaultOpacity;
            rune.scale.multiplyScalar(1 / 1.1);
            rune.userData.isHovered = false;
            console.log(`Unhovered rune ${i}`);
          }
        },
        action: () => {
          console.log(`Rune ${i} clicked, speed: ${rune.userData.rotationSpeed}`);
          if (!this.candelabraLit) {
            eventBus.emit('showMessage', 'The runes are dormant. Light the candelabra first.');
            return;
          }
          const currentSpeed = rune.userData.rotationSpeed;
          let newSpeed;
          if (currentSpeed <= 0.01) newSpeed = 0.02;
          else if (currentSpeed <= 0.02) newSpeed = 0.03;
          else newSpeed = 0.01;
          rune.userData.rotationSpeed = newSpeed;
          const speedColor = new THREE.Color(
            newSpeed === 0.01 ? 0xFF0000 :
            newSpeed === 0.02 ? 0x00FF00 :
            0x0000FF
          );
          rune.material.emissive.copy(speedColor);
          setTimeout(() => {
            rune.material.emissive.copy(rune.userData.isHovered ? rune.userData.hoverEmissive : rune.userData.defaultEmissive);
          }, 500);
          eventBus.emit('showMessage', `Rune ${i + 1} speed adjusted to ${newSpeed.toFixed(2)}. Match both to sync.`);
          this.checkRuneSync();
        }
      });

      this.runeCircles.push(rune);
      this.add(rune);
      console.log(`Rune ${i} added at ${rune.position.toArray()}`);
    }
  }

  addMagicAura() {
    const auraGeometry = new THREE.SphereGeometry(8, 32, 32);
    this.ensureUVs(auraGeometry, 'magic aura');
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x3333FF,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.magicAura = new THREE.Mesh(auraGeometry, auraMaterial);
    this.magicAura.position.set(0, 5, -2.5);
    this.magicAura.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.magicAura);
  }

  addFog() {
    const fog = new THREE.Fog(0x1A1A2E, 5, 25);
    this.scene.fog = fog;
  }

  igniteCandelabra() {
    this.candelabraLit = true;
    const flameGeometry = new THREE.ConeGeometry(0.05, 0.2, 16);
    this.ensureUVs(flameGeometry, 'flame');
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 1 });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(0, 1.1, 0);
    flame.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.candelabra.add(flame);
    this.ambientLight.intensity = 1;
    this.chandelierLight.intensity = 3;
    this.orbLight.intensity = 1;
  }

  checkRuneSync() {
    const speed1 = this.runeCircles[0].userData.rotationSpeed;
    const speed2 = this.runeCircles[1].userData.rotationSpeed;
    if (speed1 === speed2) {
      this.runeSynced = true;
      this.runeCircles.forEach(rune => {
        rune.userData.rotationSpeed = 0.02;
        rune.material.opacity = 1;
        rune.material.emissive = new THREE.Color(0xFFD700);
        rune.material.emissiveIntensity = 0.5;
      });
      eventBus.emit('showMessage', this.skillLevel === 'intermediate' ? 
        'The rune circles are synced! The orb begins to hum.' : 
        'The rune circles are synced! The tome awakens.');
    }
  }

  triggerOrbBeam() {
    const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 10, 16);
    this.ensureUVs(beamGeometry, 'beam');
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7 });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, 5, -9.5);
    beam.rotation.x = Math.PI / 2;
    beam.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(beam);
    this.stainedGlass.material.emissiveIntensity = 1;
    setTimeout(() => this.remove(beam), 2000);
  }

  triggerDustTrap() {
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x8B5A2B,
      size: 0.05,
      transparent: true,
      opacity: 0.8
    });
    const dustGeometry = this.dustParticles.geometry.clone();
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    this.add(dust);
    let t = 0;
    const animate = () => {
      t += 0.05;
      dust.material.opacity = 0.8 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(dust);
    };
    animate();
  }

  triggerRuneShock() {
    this.runeCircles.forEach(rune => {
      rune.userData.rotationSpeed = 0.1;
      setTimeout(() => rune.userData.rotationSpeed = 0.02, 2000);
    });
    const shockGeometry = new THREE.SphereGeometry(3, 32, 32);
    this.ensureUVs(shockGeometry, 'shock');
    const shockMaterial = new THREE.MeshBasicMaterial({ color: 0x3333FF, transparent: true, opacity: 0.5 });
    const shock = new THREE.Mesh(shockGeometry, shockMaterial);
    shock.position.set(0, 5, -2.5);
    shock.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(shock);
    let t = 0;
    const animate = () => {
      t += 0.05;
      shock.scale.setScalar(1 + t * 2);
      shock.material.opacity = 0.5 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(shock);
    };
    animate();
  }

  triggerMagicBurst() {
    const burstGeometry = new THREE.SphereGeometry(1, 32, 32);
    this.ensureUVs(burstGeometry, 'magic burst');
    const burstMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const burst = new THREE.Mesh(burstGeometry, burstMaterial);
    burst.position.set(7, 3, -4);
    burst.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(burst);
    let t = 0;
    const animate = () => {
      t += 0.05;
      burst.scale.setScalar(1 + t * 2);
      burst.material.opacity = 0.8 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(burst);
    };
    animate();
  }

  checkBookOrder() { // Only used in Hard
    return this.bookOrder.length === this.correctBookOrder.length &&
           this.bookOrder.every((color, index) => color === this.correctBookOrder[index]);
  }

  openCabinetDrawer() {
    if (!this.cabinet) return;
    let drawer = null;
    this.cabinet.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('drawer')) drawer = child;
    });
    if (drawer) {
      const initialPosition = drawer.position.clone();
      const targetPosition = initialPosition.clone().add(new THREE.Vector3(0, 0, 1));
      let t = 0;
      const animate = () => {
        t += 0.05;
        drawer.position.lerpVectors(initialPosition, targetPosition, t);
        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
    } else {
      const initialRotation = this.cabinet.rotation.y;
      let t = 0;
      const animate = () => {
        t += 0.05;
        this.cabinet.rotation.y = THREE.MathUtils.lerp(initialRotation, initialRotation + Math.PI / 4, t);
        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
    }
  }

  colorToName(color) { // Only used in Hard
    switch (color) {
      case 0xFF0000: return 'Red';
      case 0x00FF00: return 'Green';
      case 0x0000FF: return 'Blue';
      case 0xFFFF00: return 'Yellow';
      case 0xFF00FF: return 'Magenta';
      default: return 'Unknown';
    }
  }

  triggerBookEffect() { // Only used in Hard
    this.interactiveObjects.forEach(obj => {
      if (obj.userData.name && obj.userData.name.startsWith('book_')) {
        let t = 0;
        const initialY = obj.userData.initialPosition.y;
        const animate = () => {
          t += 0.05;
          obj.position.y = initialY + Math.sin(t * 5) * 0.2;
          obj.material.emissiveIntensity = Math.sin(t * 5) * 0.5 + 0.3;
          if (t < 2) requestAnimationFrame(animate);
          else {
            obj.position.y = initialY;
            obj.material.emissiveIntensity = 0.3;
          }
        };
        animate();
      }
    });
  }

  triggerOrbPulse(orb) {
    let t = 0;
    const initialScale = orb.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 0.7 + Math.sin(t * 5) * 0.1;
      orb.scale.set(scale, scale, scale);
      orb.material.emissiveIntensity = 2 + Math.sin(t * 5) * 0.5;
      if (t < 2) requestAnimationFrame(animate);
      else {
        orb.scale.copy(initialScale);
        orb.material.emissiveIntensity = 2;
      }
    };
    animate();
  }

  animateBook(book) { // Only used in Hard
    console.log('Animating book:', book.userData.name);
    let t = 0;
    const initialY = book.userData.initialPosition.y;
    const animate = () => {
      t += 0.05;
      book.position.y = initialY + Math.sin(t * 5) * 0.2;
      if (t < 1) requestAnimationFrame(animate);
      else {
        book.position.y = initialY;
        console.log('Book animation complete');
      }
    };
    requestAnimationFrame(animate);
  }

  animateQuill(quill) {
    let t = 0;
    const initialRotX = quill.rotation.x;
    const animate = () => {
      t += 0.05;
      quill.rotation.x = initialRotX + Math.sin(t * 5) * 0.2;
      if (t < 1) requestAnimationFrame(animate);
      else quill.rotation.x = initialRotX;
    };
    animate();
  }

  animateTome(tome) { // Only used in Hard
    let t = 0;
    const initialY = tome.position.y;
    const animate = () => {
      t += 0.05;
      tome.position.y = initialY + Math.sin(t * 5) * 0.2;
      tome.rotation.y += 0.05;
      if (t < 2) requestAnimationFrame(animate);
      else tome.position.y = initialY;
    };
    animate();
  }

  showOrbInput() { // Only for Beginner/Hard
    const existingInput = document.getElementById('orb-input');
    if (existingInput) return;

    const inputContainer = document.createElement('div');
    inputContainer.id = 'orb-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(0, 0, 51, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';
    inputContainer.style.fontFamily = 'Georgia, serif';

    const label = document.createElement('div');
    label.textContent = 'Enter sequence (1=Red, 2=Green, 3=Blue):';
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 3;
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    input.placeholder = 'e.g., 123';
    inputContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#8B4513';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '5px';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);

    document.body.appendChild(inputContainer);

    setTimeout(() => input.focus(), 0);

    const submitHandler = () => {
      this.handleOrbInput(input.value);
      document.body.removeChild(inputContainer);
      eventBus.emit('resumeGame');
    };

    submitButton.addEventListener('click', submitHandler.bind(this));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitHandler();
      }
    });

    eventBus.emit('pauseGame');
  }

  handleOrbInput(input) { // Only for Beginner/Hard
    const colors = { '1': 0xFF0000, '2': 0x00FF00, '3': 0x0000FF };
    this.orbColorSequence = input.split('').map(num => colors[num]).filter(Boolean);
    if (this.orbColorSequence.length !== 3) {
      eventBus.emit('showMessage', 'Invalid input! Enter exactly 3 numbers (1-3).');
      this.orbColorSequence = [];
      this.orb.material.color.setHex(0x6666FF);
      return;
    }
    if (this.orbColorSequence.every((c, i) => c === this.correctOrbSequence[i])) {
      this.orbActivated = true;
      this.triggerOrbPulse(this.orb);
      this.orb.material.color.setHex(0xFFFFFF);
      eventBus.emit('showMessage', this.skillLevel === 'beginner' ? 
        'The orb is fully activated! Check the cabinet.' : 
        'The orb is fully activated! Click the pedestal to place it.');
      if (this.skillLevel === 'beginner') this.cabinetLocked = false;
    } else {
      eventBus.emit('showMessage', 'Wrong sequence! Try again.');
      this.orbColorSequence = [];
      this.orb.material.color.setHex(0x6666FF);
    }
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.2);
    this.add(this.ambientLight);
  
    this.orbLight = new THREE.PointLight(0x6666FF, 0.1, 15);
    this.orbLight.position.set(1.5, 2.25, -4.5);
    this.add(this.orbLight);
  
    this.chandelierLight = new THREE.PointLight(0xFFD700, 0.2, 20);
    this.chandelierLight.position.set(0, 9, 0);
    this.add(this.chandelierLight);
  
    const windowLight = new THREE.PointLight(0xFFD700, 0.3, 20);
    windowLight.position.set(0, 5, -14);
    this.add(windowLight);
  }

  addDustParticles() {
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(this.roomSize.width);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0, this.roomSize.height);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(this.roomSize.depth);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xCCCCCC,
      size: 0.03,
      transparent: true,
      opacity: 0.3
    });
    this.dustParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.dustParticles);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/ambient-library.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(20);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 5, 0);
    this.add(sound);
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

  update(delta) {
    this.preserveScales();
    if (this.dustParticles) {
      const positions = this.dustParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.001;
        if (positions[i + 1] > this.roomSize.height) positions[i + 1] = 0;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
    this.runeCircles.forEach(rune => {
      if (rune && rune.userData) {
        rune.rotation.z += rune.userData.rotationSpeed * delta;
        if (!this.runeSynced) {
          rune.position.y = 3 + Math.sin(Date.now() * 0.001) * 0.1;
        } else {
          rune.position.y = 3;
        }
      }
    });
    if (this.magicAura) {
      this.magicAura.position.y = 5 + Math.sin(Date.now() * 0.0005) * 0.1;
    }
    this.children.forEach(child => {
      if (child.material && child.userData.emissiveBase) {
        child.material.emissiveIntensity = child.userData.emissiveBase + Math.sin(Date.now() * 0.0005) * 0.05;
      }
    });
  }

  getInteractiveObjects() {
    console.log('Interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    return this.interactiveObjects;
  }
}

export { ScholarsLibrary };