import * as THREE from 'three';
import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class Room extends THREE.Object3D {
  constructor(scene) {
    super();
    this.scene = scene;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new TextureLoader();
    
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    this.roomSize = { width: 20, height: 10, depth: 20 };
    this.wallThickness = 0.5;
  }

  async init() {
    await this.createRoom();
    await this.addFurniture();
    await this.addInteractiveObjects();
    return this;
  }

  async createRoom() {
    const floorTexture = await this.loadTexture('/assets/textures/wall.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(8, 8);
    
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      map: floorTexture,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.add(floor);
    
    const ceilingTexture = await this.loadTexture('/assets/textures/wall.jpg');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(4, 4);
    
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
      map: ceilingTexture,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    this.add(ceiling);
  
    const wallTexture = await this.loadTexture('/assets/textures/wall.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 2);
    
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      map: wallTexture,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const backWallGeometry = new THREE.BoxGeometry(
      this.roomSize.width, 
      this.roomSize.height, 
      this.wallThickness
    );
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.z = -this.roomSize.depth / 2;
    backWall.position.y = this.roomSize.height / 2;
    this.add(backWall);
    
    const frontWallLeft = new THREE.BoxGeometry(
      this.roomSize.width * 0.3, 
      this.roomSize.height, 
      this.wallThickness
    );
    const frontWallLeftMesh = new THREE.Mesh(frontWallLeft, wallMaterial);
    frontWallLeftMesh.position.set(
      -this.roomSize.width * 0.35,
      this.roomSize.height / 2,
      this.roomSize.depth / 2
    );
    this.add(frontWallLeftMesh);
    
    const frontWallRight = new THREE.BoxGeometry(
      this.roomSize.width * 0.3, 
      this.roomSize.height, 
      this.wallThickness
    );
    const frontWallRightMesh = new THREE.Mesh(frontWallRight, wallMaterial);
    frontWallRightMesh.position.set(
      this.roomSize.width * 0.35,
      this.roomSize.height / 2,
      this.roomSize.depth / 2
    );
    this.add(frontWallRightMesh);
    
    const frontWallTop = new THREE.BoxGeometry(
      this.roomSize.width * 0.4, 
      this.roomSize.height * 0.3, 
      this.wallThickness
    );
    const frontWallTopMesh = new THREE.Mesh(frontWallTop, wallMaterial);
    frontWallTopMesh.position.set(
      0,
      this.roomSize.height * 0.85,
      this.roomSize.depth / 2
    );
    this.add(frontWallTopMesh);
    
    const leftWallGeometry = new THREE.BoxGeometry(
      this.wallThickness, 
      this.roomSize.height, 
      this.roomSize.depth
    );
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.x = -this.roomSize.width / 2;
    leftWall.position.y = this.roomSize.height / 2;
    this.add(leftWall);
    
    const rightWallGeometry = new THREE.BoxGeometry(
      this.wallThickness, 
      this.roomSize.height, 
      this.roomSize.depth
    );
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.x = this.roomSize.width / 2;
    rightWall.position.y = this.roomSize.height / 2;
    this.add(rightWall);
    
    const doorFrameMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, 
      roughness: 0.9, 
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const doorFrameGeometry = new THREE.BoxGeometry(
      this.roomSize.width * 0.4, 
      this.roomSize.height * 0.7, 
      this.wallThickness * 1.5
    );
    const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
    doorFrame.position.set(
      0,
      this.roomSize.height * 0.35,
      this.roomSize.depth / 2
    );
    doorFrame.scale.set(1, 1, 1);
    doorFrame.name = 'doorFrame';
    doorFrame.userData.locked = true;
    this.add(doorFrame);
    this.makeObjectInteractive(doorFrame, {
      name: 'door',
      type: 'door',
      interactable: true,
      action: () => {
        if (doorFrame.userData.locked) {
          eventBus.emit('showMessage', 'The door is locked. There must be a way to open it.');
        } else {
          eventBus.emit('showMessage', 'The door swings open! You escaped!');
          doorFrame.rotation.y = Math.PI / 2;
          eventBus.emit('game:win');
        }
      }
    });
  
    this.addCollisionBox(backWall);
    this.addCollisionBox(frontWallLeftMesh);
    this.addCollisionBox(frontWallRightMesh);
    this.addCollisionBox(frontWallTopMesh);
    this.addCollisionBox(leftWall);
    this.addCollisionBox(rightWall);
  }

  async addFurniture() {
    try {
      const table = await this.loadModel('/assets/models/table.glb');
      table.scale.set(1.5, 1.5, 1.5);
      table.position.set(0, 0, -5);
      this.add(table);
      this.objects.push(table);
      this.addCollisionBox(table, new THREE.Vector3(3, 1.5, 2));
    } catch (error) {
      console.error('Error loading table model:', error);
      this.createSimpleTable();
    }

    try {
      const chair = await this.loadModel('/assets/models/chair.glb');
      chair.scale.set(0.8, 0.8, 0.8);
      chair.position.set(3, 1.2, -4);
      chair.rotation.y = Math.PI / 8;
      this.add(chair);
      this.objects.push(chair);
      this.addCollisionBox(chair, new THREE.Vector3(1, 2, 1));
    } catch (error) {
      console.error('Error loading chair model:', error);
      this.createSimpleChair();
    }

    try {
      const bookshelf = await this.loadModel('/assets/models/bookshelf.glb');
      bookshelf.scale.set(2, 2, 2);
      bookshelf.position.set(-8, 0, -9);
      bookshelf.rotation.y = Math.PI;
      this.add(bookshelf);
      this.objects.push(bookshelf);
      this.addCollisionBox(bookshelf, new THREE.Vector3(2, 4, 1));
    } catch (error) {
      console.error('Error loading bookshelf model:', error);
      this.createSimpleBookshelf();
    }
  }

  async addInteractiveObjects() {
    const boxNote = this.addNote(-5, 1.0, -8); // Initialize at box position
    boxNote.visible = false; // Hide initially
    // Key (on table)
    const keyGeometry = new THREE.TorusGeometry(0.2, 0.06, 8, 24);
    const keyMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
    const key = new THREE.Mesh(keyGeometry, keyMaterial);
    const handleGeometry = new THREE.BoxGeometry(0.4, 0.06, 0.06);
    const handle = new THREE.Mesh(handleGeometry, keyMaterial);
    handle.position.x = 0.3;
    key.add(handle);
    const stemGeometry = new THREE.BoxGeometry(0.3, 0.06, 0.06);
    const stem = new THREE.Mesh(stemGeometry, keyMaterial);
    stem.position.x = -0.15;
    stem.rotation.z = Math.PI / 2;
    key.add(stem);
    key.scale.set(0.5, 0.5, 0.5);
    key.position.set(0, 0.8, -5); // Reverted to original position
    key.rotation.x = Math.PI / 2;
    this.add(key);
    this.makeObjectInteractive(key, {
      name: 'key',
      type: 'collectible',
      interactable: true,
      action: () => {
        eventBus.emit('collectItem', { 
          id: 'key', 
          name: 'Key', 
          description: 'A golden key that might unlock something.' 
        });
        eventBus.emit('showMessage', 'You picked up the key!');
        key.visible = false;
      }
    });

    // Locked Box
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.2 });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    const lockGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
    const lockMaterial = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.2 });
    const lock = new THREE.Mesh(lockGeometry, lockMaterial);
    lock.rotation.x = Math.PI / 2;
    lock.position.z = 0.5;
    box.add(lock);
    box.position.set(-5, 0.5, -8);
    this.add(box);
    this.makeObjectInteractive(box, {
      name: 'locked_box',
      type: 'puzzle',
      interactable: true,
      requiresItem: 'key',
      action: (inventory) => {
          // console.log('[DEBUG] Box action triggered. Inventory:', inventory);
          
          if (!inventory) {
              // console.log('[DEBUG] No inventory provided to action handler');
              return;
          }

          if (inventory.hasItem('key')) {
              // console.log('[DEBUG] Key found in inventory, proceeding with unlock');
              eventBus.emit('unlockPuzzle', { id: 'locked_box' });
              eventBus.emit('showMessage', 'You unlocked the box with the key!');
              box.remove(lock);
              box.rotation.x = Math.PI / 6;
              
              // Just make the pre-initialized note visible
              boxNote.visible = true;
              // console.log('[DEBUG] Box note made visible');
          } else {
              // console.log('[DEBUG] No key in inventory');
              eventBus.emit('showMessage', 'The box is locked. You need a key.');
          }
      }
  });

    // Note (on bookshelf)
    const noteGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    const noteMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFF0, side: THREE.DoubleSide });
    const note = new THREE.Mesh(noteGeometry, noteMaterial);
    note.position.set(5, 0.001, -8); // Reverted to original position
    note.rotation.x = -Math.PI / 2;
    this.add(note);
    this.makeObjectInteractive(note, {
      name: 'note',
      type: 'readable',
      interactable: true,
      action: () => {
        eventBus.emit('showReadable', {
          text: 'The note reads: "Look behind the bookshelf for the next clue."'
        });
      }
    });

    // Hidden lever behind bookshelf
    const leverGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
    const leverMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.2 });
    const lever = new THREE.Mesh(leverGeometry, leverMaterial);
    lever.position.set(-8.5, 0.5, -9.5);
    lever.visible = false;
    this.add(lever);
    this.makeObjectInteractive(lever, {
      name: 'lever',
      type: 'puzzle',
      interactable: true,
      action: () => {
        lever.rotation.x = Math.PI / 4; // Visual feedback for pulling
        eventBus.emit('showMessage', 'You pulled the lever! A click sounds from the door.');
        this.scene.getObjectByName('doorFrame').userData.locked = false;
        return true;
      }
    });

    // Bookshelf interaction with toggle
    const bookshelf = this.objects.find(obj => obj.position.x === -8 && obj.position.z === -9);
    if (bookshelf) {
      bookshelf.userData.moved = false; // Track state
      this.makeObjectInteractive(bookshelf, {
        name: 'bookshelf',
        type: 'container',
        interactable: true,
        action: () => {
          if (!bookshelf.userData.moved) {
            bookshelf.position.z += 2; // Move forward to -7
            eventBus.emit('showMessage', 'You moved the bookshelf, revealing a lever!');
            lever.visible = true;
            bookshelf.userData.moved = true;
          } else {
            bookshelf.position.z -= 2; // Move back to -9
            eventBus.emit('showMessage', 'You moved the bookshelf back.');
            lever.visible = false; // Optional: hide lever when moved back
            bookshelf.userData.moved = false;
          }
        }
      });
    }
  }

  addNote(x, y, z) {
    // console.log('[DEBUG] Creating new note at position:', x, y, z);
    
    const noteGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    const noteMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFF0, 
        side: THREE.DoubleSide 
    });
    const note = new THREE.Mesh(noteGeometry, noteMaterial);
    note.position.set(x, y, z);
    note.rotation.x = -Math.PI / 3;
    this.add(note);
    
    // Give this note a unique name and make it interactive
    this.makeObjectInteractive(note, {
      name: 'box_note',
      type: 'readable',
      interactable: true,
      action: () => {
        // console.log('[DEBUG] Box note interaction triggered');
        eventBus.emit('showReadable', {
          text: 'The note reads: "Look behind the bookshelf for the next clue."'
        });
      }
    });
    
    // console.log('[DEBUG] Note created:', note);
    return note;
}

  makeObjectInteractive(object, data) {
    object.userData = { ...object.userData, ...data, isInteractive: true };
    this.interactiveObjects.push(object);
    // console.log(`[DEBUG] Interactive object added: ${data.name}`);
    
    if (object instanceof THREE.Mesh && object.geometry) {
      const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.BackSide });
      const outlineGeometry = object.geometry.clone();
      const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.05);
      outlineMesh.visible = false;
      object.add(outlineMesh);
      object.userData.outlineMesh = outlineMesh;
    } else {
      console.log(`No outline created for ${data.name} - not a Mesh or no geometry`);
    }
  }

  createSimpleTable() {
    const tableTopGeometry = new THREE.BoxGeometry(3, 0.2, 2);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 });
    const tableTop = new THREE.Mesh(tableTopGeometry, tableMaterial);
    tableTop.position.set(0, 1.5, -5);
    
    const legGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const legPositions = [
      [1.3, 0.75, 0.8], [-1.3, 0.75, 0.8], [1.3, 0.75, -0.8], [-1.3, 0.75, -0.8]
    ];
    
    const table = new THREE.Group();
    table.add(tableTop);
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, tableMaterial);
      leg.position.set(pos[0], pos[1], pos[2]);
      table.add(leg);
    });
    
    table.position.set(0, 0, -5);
    this.add(table);
    this.objects.push(table);
    this.addCollisionBox(table, new THREE.Vector3(3, 1.5, 2));
  }

  createSimpleChair() {
    const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 });
    const seatGeometry = new THREE.BoxGeometry(1, 0.1, 1);
    const seat = new THREE.Mesh(seatGeometry, chairMaterial);
    seat.position.y = 0.5;
    const backGeometry = new THREE.BoxGeometry(1, 1, 0.1);
    const back = new THREE.Mesh(backGeometry, chairMaterial);
    back.position.set(0, 1, -0.5);
    const legGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const legPositions = [
      [0.4, 0.25, 0.4], [-0.4, 0.25, 0.4], [0.4, 0.25, -0.4], [-0.4, 0.25, -0.4]
    ];
    
    const chair = new THREE.Group();
    chair.add(seat);
    chair.add(back);
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, chairMaterial);
      leg.position.set(pos[0], pos[1], pos[2]);
      chair.add(leg);
    });
    
    chair.position.set(3, 0, -4);
    chair.rotation.y = Math.PI / 4;
    this.add(chair);
    this.objects.push(chair);
    this.addCollisionBox(chair, new THREE.Vector3(1, 2, 1));
  }

  createSimpleBookshelf() {
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 });
    const frameGeometry = new THREE.BoxGeometry(2, 4, 0.5);
    const frame = new THREE.Mesh(frameGeometry, shelfMaterial);
    const shelfGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.4);
    const shelfPositions = [
      [0, -1.5, 0], [0, -0.5, 0], [0, 0.5, 0], [0, 1.5, 0]
    ];
    
    const bookshelf = new THREE.Group();
    bookshelf.add(frame);
    shelfPositions.forEach(pos => {
      const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
      shelf.position.set(pos[0], pos[1], pos[2]);
      bookshelf.add(shelf);
    });
    
    const bookColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
    const bookPositions = [
      [-0.6, -1.2, 0], [-0.3, -1.2, 0], [0.0, -1.2, 0], [0.3, -1.2, 0],
      [-0.5, -0.2, 0], [0.0, -0.2, 0], [0.5, -0.2, 0],
      [-0.6, 0.8, 0], [0.0, 0.8, 0], [0.4, 0.8, 0]
    ];
    
    bookPositions.forEach((pos, index) => {
      const bookGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.3);
      const bookMaterial = new THREE.MeshStandardMaterial({ 
        color: bookColors[index % bookColors.length],
        roughness: 0.7,
        metalness: 0.1
      });
      const book = new THREE.Mesh(bookGeometry, bookMaterial);
      book.position.set(pos[0], pos[1], pos[2]);
      bookshelf.add(book);
    });
    
    bookshelf.position.set(-8, 2, -9);
    this.add(bookshelf);
    this.objects.push(bookshelf);
    this.addCollisionBox(bookshelf, new THREE.Vector3(2, 4, 1));
  }

  // Room.js (relevant part)
addCollisionBox(object, size = null) {
  if (!size) {
    const box = new THREE.Box3().setFromObject(object);
    size = new THREE.Vector3();
    box.getSize(size);
  }
  object.userData.isCollider = true;
  object.userData.collider = { type: 'box', size: size, position: object.position.clone() };
  // console.log(`[DEBUG] Collider added to ${object.name || 'unnamed object'} at ${object.position.toArray()} with size:`, size.toArray());
}

  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        texture => resolve(texture),
        undefined,
        error => {
          console.error(`Error loading texture ${path}:`, error);
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const context = canvas.getContext('2d');
          context.fillStyle = '#AAAAAA';
          context.fillRect(0, 0, 256, 256);
          const fallbackTexture = new THREE.CanvasTexture(canvas);
          resolve(fallbackTexture);
        }
      );
    });
  }

  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        gltf => resolve(gltf.scene),
        undefined,
        error => {
          console.error(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  getInteractiveObjects() {
    console.log('Room: Returning', this.interactiveObjects.length, 'interactive objects');
    return this.interactiveObjects;
  }

  getAllObjects() {
    return this.objects.concat(this.interactiveObjects);
  }

  highlightObject(object, highlight = true) {
    if (object.userData.outlineMesh) {
      object.userData.outlineMesh.visible = highlight;
    }
  }
}

export { Room };